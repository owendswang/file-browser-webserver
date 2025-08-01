const fs = require('fs');
const path = require('path');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    previewCachePath,
    dbPath
  } = getConfig();
  const dbFileName = path.basename(dbPath);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const cacheItems = fs.readdirSync(previewCachePath);

  let i = 0;
  for (const itemName of cacheItems) {
    res.write(`data: ${JSON.stringify({ progress: i * 90 / cacheItems.length })}\n\n`);
    res.flush();

    if (itemName !== dbFileName) {
      const itemPath = path.join(previewCachePath, itemName);
      try {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } catch (e) {
        console.error(e);
      }
    }
  }

  res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
  return res.end();
}

module.exports = method;
