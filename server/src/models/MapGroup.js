const mongoose = require('mongoose');
const { toJSONPlugin } = require('./plugin');

const mapGroupSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  years: { type: String, default: '' },
  description: { type: String, default: '' },
  map_ids: { type: [String], default: [] },
  public: { type: Boolean, default: true },
});

mapGroupSchema.plugin(toJSONPlugin);

module.exports = mongoose.model('MapGroup', mapGroupSchema);
