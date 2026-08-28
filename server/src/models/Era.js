const mongoose = require('mongoose');
const { toJSONPlugin } = require('./plugin');

const eraSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  years: { type: String, default: '' },
  description: { type: String, default: '' },
  maps: { type: [String], default: [] },
  map_groups: { type: [String], default: [] },
  indented: { type: [String], default: [] },
  public: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
});

eraSchema.plugin(toJSONPlugin);

module.exports = mongoose.model('Era', eraSchema);
