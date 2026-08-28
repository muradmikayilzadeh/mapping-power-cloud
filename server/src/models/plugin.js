// Shared schema plugin: exposes Mongo's `_id` as `id` (matching the Firestore
// doc.id shape the frontend already expects everywhere) and drops `__v`.
function toJSONPlugin(schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      return ret;
    },
  });
}

module.exports = { toJSONPlugin };
