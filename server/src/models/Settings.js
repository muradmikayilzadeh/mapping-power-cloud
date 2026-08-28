const mongoose = require('mongoose');
const { toJSONPlugin } = require('./plugin');

// Singleton: exactly one document ever exists in this collection.
const settingsSchema = new mongoose.Schema({
  logo: { type: String, default: '' },
  projectTitle: { type: String, default: '' },
  introduction: { type: String, default: '' },
  bibliography: { type: String, default: '' },
  credits: { type: String, default: '' },
  feedback: { type: String, default: '' },
  geolocation: { type: [Number], default: [0, 0] },
  mapZoom: { type: Number, default: 10 },
  siteLive: { type: Boolean, default: true },
  previewToken: { type: String, default: '' },
});

settingsSchema.plugin(toJSONPlugin);

module.exports = mongoose.model('Settings', settingsSchema);
