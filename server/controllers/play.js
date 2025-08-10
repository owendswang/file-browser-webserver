const fs = require('fs');
const path = require('path');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    tempDir
  } = getConfig();

  const urlPath = req.params[0];
  const sessionId = urlPath.split('/')[0];
  const fileName = urlPath.split('/')[1];

  const playDir = path.resolve(tempDir, sessionId);
  const filePath = path.join(playDir, fileName);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  } else {
    return res.status(404).send('File not found.');
  }
}

module.exports = method;
