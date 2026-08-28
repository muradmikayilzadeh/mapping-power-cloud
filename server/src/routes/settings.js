const express = require('express');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

async function getSingleton() {
  let doc = await Settings.findOne();
  if (!doc) doc = await Settings.create({});
  return doc;
}

// Admin: full document, including the raw preview token (needed to show/copy
// the preview link in the Settings page).
router.get('/', requireAuth, async (req, res) => {
  res.json(await getSingleton());
});

router.put('/', requireAuth, async (req, res) => {
  const doc = await getSingleton();
  Object.assign(doc, req.body);
  await doc.save();
  res.json(doc);
});

// Public: everything the public site needs (logo, title, geolocation, the
// long-form text fields, ...) except the raw preview token itself — the
// visitor's browser already knows whichever token it's presenting (from the
// URL or a previous visit), it doesn't need the server's copy echoed back.
// `previewParam`/`storedToken` are checked independently, mirroring the old
// client-side check that accepted either the URL's ?preview= or a
// previously-unlocked token stored in localStorage.
router.get('/public', async (req, res) => {
  const doc = await getSingleton();
  const isLive = doc.siteLive !== false;
  const { previewParam, storedToken } = req.query;
  const tokenMatches =
    !!doc.previewToken && (previewParam === doc.previewToken || storedToken === doc.previewToken);
  const allowed = isLive || tokenMatches;
  const preview = !isLive && allowed;

  const { previewToken, ...rest } = doc.toJSON();
  res.json({ ...rest, access: { allowed, preview, siteLive: isLive } });
});

module.exports = router;
