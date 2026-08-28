const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUsername || !expectedHash) {
    return res.status(500).json({ error: 'Admin credentials are not configured on the server.' });
  }

  if (username !== expectedUsername) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const ok = await bcrypt.compare(password || '', expectedHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.isAdmin = true;
  res.json({ authenticated: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mapping_power.sid');
    res.json({ authenticated: false });
  });
});

router.get('/me', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
