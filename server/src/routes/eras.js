const Era = require('../models/Era');
const { makeCrudRouter } = require('./crudFactory');

module.exports = makeCrudRouter(Era, { sort: { order: 1 } });
