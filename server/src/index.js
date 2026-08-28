require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { connectDB } = require('./db');

const authRoutes = require('./routes/auth');
const eraRoutes = require('./routes/eras');
const mapRoutes = require('./routes/maps');
const mapGroupRoutes = require('./routes/mapGroups');
const narrativeRoutes = require('./routes/narratives');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/uploads');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mapping_power';
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

async function start() {
  await connectDB();

  const app = express();
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(
    session({
      name: 'mapping_power.sid',
      secret: process.env.SESSION_SECRET || 'change-me',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: MONGO_URI }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use('/uploads', express.static(UPLOAD_ROOT));

  app.use('/api/auth', authRoutes);
  app.use('/api/eras', eraRoutes);
  app.use('/api/maps', mapRoutes);
  app.use('/api/map-groups', mapGroupRoutes);
  app.use('/api/narratives', narrativeRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/uploads', uploadRoutes);

  // In production this server also hosts the built React app, so a
  // self-hoster only has to keep one process running.
  const buildDir = path.join(__dirname, '..', '..', 'build');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(buildDir)) {
    app.use(express.static(buildDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(buildDir, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
