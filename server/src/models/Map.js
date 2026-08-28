const mongoose = require('mongoose');
const { toJSONPlugin } = require('./plugin');

// No `required` constraints here: the admin UI creates a blank map document
// first (to reserve an id for file-upload paths) and fills fields in via a
// follow-up update, mirroring the old Firestore create-then-update flow.
const vectorPointSchema = new mongoose.Schema(
  {
    coordinates: { type: String, default: '' },
    bearing: { type: mongoose.Schema.Types.Mixed, default: '' },
    is_directional: { type: Boolean, default: false },
    description: { type: String, default: '' },
    footnotes: { type: String, default: '' },
    image: { type: String, default: null },
  },
  { _id: false }
);

const mapSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  years: { type: String, default: '' },
  description: { type: String, default: '' },
  footnotes: { type: String, default: '' },
  map_type: { type: String, default: '' },
  rotation: { type: Number, default: 0 },
  public: { type: Boolean, default: true },

  // Raster-only
  raster_image: { type: String, default: null },
  image_bounds_coords: { type: [String], default: undefined },

  // Vector-only
  vector_file: { type: String, default: null },
  focus_bounds: { type: [String], default: undefined },
  vector_points: { type: [vectorPointSchema], default: undefined },
});

mapSchema.plugin(toJSONPlugin);

module.exports = mongoose.model('Map', mapSchema);
