const Map = require('../models/Map');
const { makeCrudRouter } = require('./crudFactory');

module.exports = makeCrudRouter(Map);
