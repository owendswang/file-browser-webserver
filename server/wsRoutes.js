const playHander = require('./wsHandlers/play.js');

const wsRoutes = {
  '/play': playHander
};

module.exports = wsRoutes;