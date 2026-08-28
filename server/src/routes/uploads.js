const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const sanitizeSegment = (s) => (s || '').replace(/[^a-zA-Z0-9_.-]/g, '');
const sanitizeDir = (dir) =>
  (dir || '')
    .split('/')
    .filter(Boolean)
    .map(sanitizeSegment)
    .join('/');

// memoryStorage (rather than diskStorage) so the destination/filename aren't
// decided until the route handler runs, once the whole multipart body — file
// AND fields — has been parsed. multer's diskStorage callbacks only see
// `req.body` fields that happen to appear before the file part in the
// stream, which is a fragile thing to depend on for `category`/`dir`.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const category = sanitizeSegment(req.body.category) || 'misc';
  const dir = sanitizeDir(req.body.dir);
  const prefix = sanitizeSegment(req.body.filenamePrefix);
  const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filename = `${prefix}${safeOriginal}`;

  const destDir = path.join(UPLOAD_ROOT, category, dir);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, filename), req.file.buffer);

  const relPath = [category, dir, filename].filter(Boolean).join('/');
  res.json({ url: `/uploads/${relPath}` });
});

module.exports = router;
