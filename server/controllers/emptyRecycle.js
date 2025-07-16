const fs = require('fs');
const path = require('path');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    basePaths,
    recycleFolderName
  } = getConfig();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const recycleItems = [];

  for (const [baseName, basePath] of Object.entries(basePaths)) {
    const recycleDirPath = path.join(basePath, recycleFolderName);
    if (fs.existsSync(recycleDirPath) && fs.statSync(recycleDirPath).isDirectory()) {
      for (const deletedTimeStamp of fs.readdirSync(recycleDirPath)) {
        const recyclePath = path.join(recycleDirPath, deletedTimeStamp);
        if (fs.statSync(recyclePath).isDirectory()) {
          for (const itemName of fs.readdirSync(recyclePath)) {
            const itemPath = path.join(recyclePath, itemName);
            recycleItems.push(itemPath);
          }
        }
      }
    }
  }

  res.write(`data: ${JSON.stringify({ progress: 10 })}\n\n`);
  res.flush();

  let i = 0;
  for (const itemPath of recycleItems) {
    res.write(`data: ${JSON.stringify({ progress: 10 + i * 90 / recycleItems.length })}\n\n`);
    res.flush();
    fs.rmSync(itemPath, { recursive: true, force: true });
    const recyclePath = path.dirname(itemPath);
    const recycleItemNames = fs.readdirSync(recyclePath);
    if ((recycleItemNames.length === 0)) {
      fs.rmSync(recyclePath, { recursive: true, force: true });
    }
  }

  res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
  return res.end();
}

module.exports = method;
