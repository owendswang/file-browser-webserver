const sqlite = require('node:sqlite');
const { dbPath } = require('../config');

module.exports = new sqlite.DatabaseSync(dbPath);