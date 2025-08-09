const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const getConfig = require('@/utils/getConfig');

const play = (ws, req) => {
  const {
    sevenZipPath,
    ffmpegPath,
    basePaths,
    previewCachePath,
    tempDir
  } = getConfig();

  ws.on('error', console.error);

  ws.send(JSON.stringify({ debug: '欢迎来到 play WS' }, null, 4));

  ws.on('message', function message(data) {
    console.log(`received: \n${data}`);
  });

  ws.on('close', function close() {
    console.log('WS close');
  })
}

module.exports = play;