const playHander = require('./wsHandlers/play.js');

const wsRoutes = {
  '/wsplay': playHander
};

module.exports = wsRoutes;