const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const { isArchive } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  const {
    sevenZipPath,
    basePaths,
    tempDir
  } = getConfig();

  const urlPath = req.params[0].replace(/\/$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Archive file path not found');
  }

  const fullPath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), ""));
  
  if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile || !isArchive(fullPath)) {
    return res.status(404).send('No archive file found');
  }

  const sevenZip = new SevenZip(sevenZipPath, true);

  try {
    const result = await sevenZip.test(fullPath, `"-w${tempDir}" -bsp1`, '', signal);

    return res.json(result);
  } catch (error) {
    console.error('Error testing archive file:', error);
    if (error.message === 'AbortError') {
      return res.status(499).send('Client Closed Request');
    }
    return res.status(500).send(`Error testing archive file:\n${error.message}`);
  }
}

module.exports = method;