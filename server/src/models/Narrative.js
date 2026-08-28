const mongoose = require('mongoose');
const { toJSONPlugin } = require('./plugin');

// `chapters` is a dynamically-keyed object (chapter id -> chapter data), not
// a fixed shape, so it's stored as Mixed rather than modeled field-by-field.
const narrativeSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
  public: { type: Boolean, default: true },
  chapters: { type: mongoose.Schema.Types.Mixed, default: {} },
});

narrativeSchema.plugin(toJSONPlugin);

module.exports = mongoose.model('Narrative', narrativeSchema);
