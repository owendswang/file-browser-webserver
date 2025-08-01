const fs = require('fs');
const path = require('path');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    tempDir,
    dbPath
  } = getConfig();
  const dbFileName = path.basename(dbPath);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const tempItems = fs.readdirSync(tempDir);

  let i = 0;
  for (const itemName of tempItems) {
    res.write(`data: ${JSON.stringify({ progress: i * 90 / tempItems.length })}\n\n`);
    res.flush();

    if (itemName !== dbFileName) {
      const itemPath = path.join(tempDir, itemName);
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
