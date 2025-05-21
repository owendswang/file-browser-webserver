const fs = require('fs');
const path = require('path');

class Thumbnails {
  constructor(db, cachePath = path.join(__dirname, 'cache')) {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath);
    }

    this.cachePath = cachePath;
    this.db = db;

    // 初始化数据库
    this.initDatabase();
  }

  initDatabase() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS thumbnails (
      fileName TEXT NOT NULL,
      type TEXT NOT NULL,
      modifiedTime TEXT NOT NULL,
      size TEXT NOT NULL,
      thumbnailId TEXT NOT NULL,
      animated INTEGER NOT NULL DEFAULT 0,
      convertFinished INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (fileName, type, modifiedTime, size),
      UNIQUE (thumbnailId)
    )`);
  }

  getThumbnailInfo(fileName, modifiedTime, size, animated) {
    const query = `SELECT thumbnailId, convertFinished, animated FROM thumbnails WHERE fileName = ? and modifiedTime = ? and size = ? and type = 'thumbnail'`;
    const row = this.db.prepare(query).get(fileName, modifiedTime.toString(), size);

    if (row) {
      const thumbnailFilePath = path.join(this.cachePath, `${row.thumbnailId}.webp`);
      if (!fs.existsSync(thumbnailFilePath) || (fs.statSync(thumbnailFilePath).size === 0) || !row.convertFinished || animated !== !!row.animated) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      } else {
        return { thumbnailId: row.thumbnailId, regenerate: false };
      }
    } else {
      return { thumbnailId: null, regenerate: true };
    }
  }

  getM3u8Info(fileName, modifiedTime, size) {
    const query = `SELECT thumbnailId, convertFinished FROM thumbnails WHERE fileName = ? and modifiedTime = ? and size = ? and type = 'hls'`;
    const row = this.db.prepare(query).get(fileName, modifiedTime.toString(), size);

    if (row) {
      /*const cacheFolder = path.join(this.cachePath, row.thumbnailId);
      const m3u8FilePath = path.join(cacheFolder, 'index.m3u8');
      if (!fs.existsSync(cacheFolder)) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      }
      if (fs.readdirSync(cacheFolder).length === 0) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      }
      if (!fs.existsSync(m3u8FilePath)) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      }
      if (!row.convertFinished) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      }
      const m3u8FileContent = fs.readFileSync(m3u8FilePath, { encoding: 'utf8' });
      if (!m3u8FileContent.includes('#EXT-X-ENDLIST')) {
        return { thumbnailId: row.thumbnailId, regenerate: true };
      }
      return { thumbnailId: row.thumbnailId, regenerate: false };*/
      return { thumbnailId: row.thumbnailId };
    } else {
      return { thumbnailId: null };
    }
  }

  updateThumbnailInfo(fileName, modifiedTime, thumbnailId, size, convertFinished = 1, animated) {
    const query = `INSERT OR REPLACE INTO thumbnails (fileName, type, modifiedTime, thumbnailId, size, convertFinished, animated) VALUES (?, 'thumbnail', ?, ?, ?, ?, ?)`;
    this.db.prepare(query).run(fileName, modifiedTime.toString(), thumbnailId, size, convertFinished, animated ? 1 : 0);
  }

  updateM3u8Info(fileName, modifiedTime, thumbnailId, size, convertFinished = 1) {
    const query = `INSERT OR REPLACE INTO thumbnails (fileName, type, modifiedTime, thumbnailId, size, convertFinished) VALUES (?, 'hls', ?, ?, ?, ?)`;
    this.db.prepare(query).run(fileName, modifiedTime.toString(), thumbnailId, size, convertFinished);
  }
}

module.exports = Thumbnails;
