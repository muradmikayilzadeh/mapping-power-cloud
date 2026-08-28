# Self-hosting

This app is a React frontend backed by a small Node/Express API and MongoDB — you run all of
it yourself (no Firebase, no other cloud service required). Uploaded files (map images, vector
files, pin images/videos, the site logo) are stored on local disk under `server/uploads/`.

## 1. Install MongoDB

Install MongoDB Community Server for your OS and have it running locally (e.g. `mongod` as a
system service, or run the `mongod` binary directly) — see
https://www.mongodb.com/docs/manual/administration/install-community/. No Docker needed; a
default install listening on `mongodb://127.0.0.1:27017` is all the server expects out of the box.

## 2. Configure and start the API server

```
cd server
cp .env.example .env
```

Fill in `server/.env`:

```
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/mapping_power
SESSION_SECRET=...              # any long random string
CORS_ORIGIN=http://localhost:3000

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...         # generate below
```

Generate the admin password hash:

```
npm install
npm run hash-password -- 'your-password'
```

Paste the printed hash into `ADMIN_PASSWORD_HASH`, then start the server:

```
npm start        # API at http://localhost:4000
```

## 3. Configure and run the frontend

Back in the repo root:

```
cp .env.example .env
```

```
REACT_APP_API_URL=http://localhost:4000
REACT_APP_MAPTILER_KEY=   # optional — get your own free key at maptiler.com; falls back to a shared default otherwise
```

```
npm install
npm start        # dev server at http://localhost:3000
```

## 4. Migrating existing content from Firebase (optional)

If you're moving an existing Firebase-backed instance of this app over, keep the old
`REACT_APP_FIREBASE_*` values in the root `.env` (temporarily) and run, once:

```
cd server
npm run migrate-from-firebase
```

This copies every era, map, map group, narrative, and the settings document out of Firestore
into MongoDB, and downloads every file referenced in Firebase Storage into `server/uploads/`.
It only runs against an empty MongoDB database (to avoid double-importing) — clear the
collections first if you need to re-run it. Once you've confirmed the migrated content looks
right, the `REACT_APP_FIREBASE_*` values and the Firebase project itself are no longer needed.

## 5. Deploying

```
npm run build
```

In production, run the API server with `NODE_ENV=production` — it will also serve the built
`build/` folder itself (and `/uploads`), so a single Node process (`node server/src/index.js`,
optionally under a process manager like `pm2` for restart-on-crash) is all you need to keep
running on your host, alongside `mongod`.

## 6. Using the admin panel

Go to `/admin` on your deployed site and log in with the admin username/password you configured
in `server/.env`. From `/dashboard` you can manage eras, maps, map groups, narratives, and
settings — these routes now require that login (unlike earlier versions of this app, where the
admin area had no real access control).

The first time you visit **Settings**, fill in the project title, geolocation, and other fields
and click Save — this creates your settings document. Everything else (eras, maps, narratives)
is created through the admin pages the same way.
