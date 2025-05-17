const { randomBytes } = require('crypto');
const OAuth2Server = require('@node-oauth/express-oauth-server');
const hashPassword = require('@/utils/hassPassword');
const createConfig = require('./config');

class CustomOAuth2Server extends OAuth2Server {
  constructor(db, verbose = false) {
    super(createConfig(db, verbose));
  
    this.db = db;
    this.verbose = verbose;
  
    // 初始化数据库表
    this.initializeTables();
  }

  // 初始化数据库表
  initializeTables() {
    // 创建用户表
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      salt TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '["view"]',
      approved INTEGER NOT NULL DEFAULT 0
    )`);

    const salt = randomBytes(16).toString('hex');
    const hashedPassword = hashPassword('admin', salt);
    // 创建管理员账号
    this.db.prepare(`INSERT OR IGNORE INTO users (id, username, password, salt, scope, approved) VALUES (?, ?, ?, ?, ?, ?)`).run(1, 'admin', hashedPassword, salt, JSON.stringify(['admin','view']), 1);

    // 创建 oauth2 token 管理表
    this.db.exec(`CREATE TABLE IF NOT EXISTS tokens (
      accessToken TEXT NOT NULL UNIQUE,
      refreshToken TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      accessTokenExpiresAt DATETIME NOT NULL,
      refreshTokenExpiresAt DATETIME NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`);
  }
}

module.exports = CustomOAuth2Server;