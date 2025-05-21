const os = require('os');
const fs = require('fs');
const path = require('path');

const getConfig = () => {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  if (config.basePaths === undefined) {
    config.basePaths = {};
  }

  if (config.previewCachePath === undefined) {
    config.previewCachePath = os.tmpdir();
  }

  if (config.tempDir === undefined) {
    config.tempDir = os.tmpdir();
  }

  if (config.oauth === undefined) {
    config.oauth = {
      clientId: 'self',
      clientSecret: 'self',
      clientUserId: 'self',
    };
  } else if (typeof(config.oauth) === 'object') {
    if (config.oauth.clientId === undefined) {
      config.oauth.clientId = 'self';
    }
    if (config.oauth.clientSecret === undefined) {
      config.oauth.clientSecret = 'self';
    }
    if (config.oauth.clientUserId === undefined) {
      config.oauth.clientUserId = 'self';
    }
  }

  if (config.previewImageMaxWidth === undefined) {
    config.previewImageMaxWidth = 512;
  }
  if (config.previewImageMaxHeight === undefined) {
    config.previewImageMaxHeight = 512;
  }
  if (config.enablePreviewAnimation === undefined) {
    config.enablePreviewAnimation = false;
  }

  if (config.dbPath === undefined) {
    config.dbPath = path.resolve(__dirname, '..', 'db', 'db.sqlite');
  }

  return config;
}

module.exports = getConfig;