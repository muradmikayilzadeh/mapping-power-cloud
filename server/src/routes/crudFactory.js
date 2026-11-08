const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');

// Express 4 doesn't catch rejected promises from async handlers, so wrap
// them — otherwise a failed write never reaches the error handler/log.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Every content collection (eras, maps, map groups, narratives) follows the
// same shape: public GET filtered to `public !== false` for anonymous
// visitors (full list for a logged-in admin), authed writes. This factory
// keeps that logic in one place instead of repeating it four times.
function makeCrudRouter(Model, { sort } = {}) {
  const router = express.Router();
  const isAdmin = (req) => !!(req.session && req.session.isAdmin);

  router.get('/', wrap(async (req, res) => {
    const filter = isAdmin(req) ? {} : { public: { $ne: false } };
    let query = Model.find(filter);
    if (sort) query = query.sort(sort);
    res.json(await query);
  }));

  router.get('/:id', wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id).catch(() => null);
    if (!doc || (!isAdmin(req) && doc.public === false)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(doc);
  }));

  router.post('/', requireAuth, wrap(async (req, res) => {
    const doc = await Model.create(req.body);
    res.status(201).json(doc);
  }));

  router.put('/:id', requireAuth, wrap(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  }));

  router.delete('/:id', requireAuth, wrap(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.status(204).end();
  }));

  return router;
}

module.exports = { makeCrudRouter };
