const MapGroup = require('../models/MapGroup');
const { makeCrudRouter } = require('./crudFactory');

module.exports = makeCrudRouter(MapGroup);
