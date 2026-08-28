// One-off migration: copies every doc out of the live Firestore project
// (eras, maps, map_groups, narratives, settings) into MongoDB, downloads
// every file referenced by a Storage download URL into server/uploads/, and
// rewrites cross-collection id references (era.maps[], era.map_groups[],
// map_group.map_ids[], narrative chapter maps[].id) to the new Mongo ids.
//
// Run once, from server/:  npm run migrate-from-firebase
//
// Reads Firebase project config from the root .env (the same
// REACT_APP_FIREBASE_* values the old frontend used) and the Mongo
// connection from server/.env — nothing to hand-copy.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const { connectDB } = require('../src/db');
const Era = require('../src/models/Era');
const MapModel = require('../src/models/Map');
const MapGroup = require('../src/models/MapGroup');
const Narrative = require('../src/models/Narrative');
const Settings = require('../src/models/Settings');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

function firebaseApp() {
  const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };
  if (!config.projectId) {
    throw new Error(
      'No REACT_APP_FIREBASE_* config found in the repo root .env — nothing to migrate from.'
    );
  }
  return initializeApp(config);
}

// Pulls the original file name out of a Firebase Storage download URL
// (`.../o/<encoded-path>?...`) so the local copy keeps its extension.
function fileNameFromDownloadUrl(url) {
  const encodedPath = url.split('/o/')[1]?.split('?')[0];
  if (!encodedPath) return 'file';
  const decoded = decodeURIComponent(encodedPath);
  return decoded.split('/').pop() || 'file';
}

async function downloadTo(url, destRelPath) {
  const destAbsPath = path.join(UPLOAD_ROOT, destRelPath);
  fs.mkdirSync(path.dirname(destAbsPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destAbsPath, buffer);
  return `/uploads/${destRelPath}`;
}

async function migrateMaps(db) {
  const idMap = {};
  const snap = await getDocs(collection(db, 'maps'));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const payload = {
      title: data.title || '',
      years: data.years || '',
      description: data.description || '',
      footnotes: data.footnotes || '',
      map_type: data.map_type || '',
      rotation: data.rotation || 0,
      public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
    };

    if (data.map_type === 'raster') {
      payload.image_bounds_coords = data.image_bounds_coords || [];
      if (data.raster_image) {
        const fileName = fileNameFromDownloadUrl(data.raster_image);
        payload.raster_image = await downloadTo(
          data.raster_image,
          `maps/raster/${docSnap.id}/${fileName}`
        );
        console.log(`  downloaded raster image for map ${docSnap.id}`);
      }
    } else if (data.map_type === 'vector') {
      if (Array.isArray(data.focus_bounds)) payload.focus_bounds = data.focus_bounds;
      if (data.vector_file) {
        const fileName = fileNameFromDownloadUrl(data.vector_file);
        payload.vector_file = await downloadTo(
          data.vector_file,
          `maps/vector/${docSnap.id}/${fileName}`
        );
        console.log(`  downloaded vector file for map ${docSnap.id}`);
      }
      if (Array.isArray(data.vector_points)) {
        payload.vector_points = await Promise.all(
          data.vector_points.map(async (point, index) => {
            if (!point.image) return point;
            const fileName = fileNameFromDownloadUrl(point.image);
            const url = await downloadTo(
              point.image,
              `maps/vector/${docSnap.id}/point_${index + 1}_${fileName}`
            );
            console.log(`  downloaded point ${index + 1} media for map ${docSnap.id}`);
            return { ...point, image: url };
          })
        );
      }
    }

    const created = await MapModel.create(payload);
    idMap[docSnap.id] = created.id;
  }

  console.log(`Migrated ${Object.keys(idMap).length} maps.`);
  return idMap;
}

async function migrateMapGroups(db, mapIdMap) {
  const idMap = {};
  const snap = await getDocs(collection(db, 'map_groups'));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const created = await MapGroup.create({
      title: data.title || '',
      years: data.years || '',
      description: data.description || '',
      map_ids: (data.map_ids || []).map((oldId) => mapIdMap[oldId] || oldId),
      public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
    });
    idMap[docSnap.id] = created.id;
  }

  console.log(`Migrated ${Object.keys(idMap).length} map groups.`);
  return idMap;
}

async function migrateEras(db, mapIdMap, mapGroupIdMap) {
  const snap = await getDocs(collection(db, 'eras'));
  const remap = (oldId) => mapIdMap[oldId] || mapGroupIdMap[oldId] || oldId;

  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    await Era.create({
      title: data.title || '',
      years: data.years || '',
      description: data.description || '',
      maps: (data.maps || []).map((oldId) => mapIdMap[oldId] || oldId),
      map_groups: (data.map_groups || []).map((oldId) => mapGroupIdMap[oldId] || oldId),
      indented: (data.indented || []).map(remap),
      public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
      order: typeof data.order === 'number' ? data.order : 0,
    });
    count += 1;
  }
  console.log(`Migrated ${count} eras.`);
}

async function migrateNarratives(db, mapIdMap) {
  const snap = await getDocs(collection(db, 'narratives'));

  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const chapters = {};
    Object.entries(data.chapters || {}).forEach(([key, chapter]) => {
      chapters[key] = {
        ...chapter,
        maps: (chapter.maps || []).map((m) => ({
          ...m,
          id: mapIdMap[m.id] || m.id,
        })),
      };
    });

    await Narrative.create({
      title: data.title || '',
      description: data.description || '',
      order: typeof data.order === 'number' ? data.order : 0,
      public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
      chapters,
    });
    count += 1;
  }
  console.log(`Migrated ${count} narratives.`);
}

async function migrateSettings(db) {
  const snap = await getDoc(doc(db, 'settings', 'settingsData'));
  if (!snap.exists()) {
    console.log('No settings document found — skipping.');
    return;
  }
  const data = snap.data();
  const payload = {
    projectTitle: data.projectTitle || '',
    introduction: data.introduction || '',
    bibliography: data.bibliography || '',
    credits: data.credits || '',
    feedback: data.feedback || '',
    geolocation: Array.isArray(data.geolocation) ? data.geolocation : [0, 0],
    mapZoom: typeof data.mapZoom === 'number' ? data.mapZoom : 10,
    siteLive: data.siteLive !== false,
    previewToken: data.previewToken || '',
  };

  if (data.logo && data.logo.startsWith('http')) {
    const fileName = fileNameFromDownloadUrl(data.logo);
    payload.logo = await downloadTo(data.logo, `logos/${fileName}`);
    console.log('  downloaded logo');
  } else {
    payload.logo = data.logo || '';
  }

  await Settings.findOneAndUpdate({}, payload, { upsert: true });
  console.log('Migrated settings.');
}

async function main() {
  const app = firebaseApp();
  const db = getFirestore(app);

  await connectDB();

  const existingCounts = await Promise.all([
    Era.countDocuments(),
    MapModel.countDocuments(),
    MapGroup.countDocuments(),
    Narrative.countDocuments(),
  ]);
  if (existingCounts.some((c) => c > 0)) {
    throw new Error(
      'MongoDB already has content in it. This script is meant to run once against an ' +
        'empty database — clear the collections first if you want to re-run it.'
    );
  }

  console.log('Migrating maps...');
  const mapIdMap = await migrateMaps(db);

  console.log('Migrating map groups...');
  const mapGroupIdMap = await migrateMapGroups(db, mapIdMap);

  console.log('Migrating eras...');
  await migrateEras(db, mapIdMap, mapGroupIdMap);

  console.log('Migrating narratives...');
  await migrateNarratives(db, mapIdMap);

  console.log('Migrating settings...');
  await migrateSettings(db);

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
