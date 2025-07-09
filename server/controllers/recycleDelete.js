const fs = require('fs');
const path = require('path');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  // 获取查询参数
  const fileList = req.body;

  if (!fileList || !Array.isArray(fileList)) {
    return res.status(404).send('Nothing to delete');
  }

  const {
    basePaths,
    recycleFolderName,
    recycleInfoFileName
  } = getConfig();
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let i = 0;
  for (const urlPath of fileList) {
    res.write(`data: ${JSON.stringify({ progress: i * 100 / fileList.length })}\n\n`);
    res.flush();
    const stringPattern = `\\/.+\\/${recycleFolderName}\\/\\d{13}\\/.+`;
    if (urlPath.match(new RegExp(stringPattern, 'g'))) {
      const basePath = basePaths[urlPath.split('/')[1]];
      if (basePath) {
        const filePath = path.join(basePath, ...urlPath.split('/').slice(2));
        fs.rmSync(filePath, { recursive: true, force: true });
        const recyclePath = path.dirname(filePath);
        const recycleItemNames = fs.readdirSync(recyclePath);
        if ((recycleItemNames.length === 0) || (JSON.stringify(recycleItemNames) === `["${recycleInfoFileName}"]`)) {
          fs.rmSync(recyclePath, { recursive: true, force: true });
        }
      }
    }
    i += 1;
  }

  res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
  return res.end();
}

module.exports = method;
