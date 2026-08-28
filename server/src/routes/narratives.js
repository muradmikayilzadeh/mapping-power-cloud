const Narrative = require('../models/Narrative');
const { makeCrudRouter } = require('./crudFactory');

module.exports = makeCrudRouter(Narrative, { sort: { order: 1 } });
