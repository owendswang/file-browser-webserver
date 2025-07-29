const sqlite = require('node:sqlite');
const { dbPath } = require('../utils/getConfig')();

module.exports = new sqlite.DatabaseSync(dbPath);