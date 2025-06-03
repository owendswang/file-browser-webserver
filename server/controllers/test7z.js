const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const { isArchive } = require('@/utils/fileUtils');

const method = async (req, res) => {
  const urlPath = req.params[0].replace(/\/$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Source path not found');
  }

  const fullPath = path.join(basePaths[folderName], srcUrlPath.replace(new RegExp(`^${folderName}`, 'g'), ""));
  
  if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile || !isArchive(fullPath)) {
    return res.status(404).send('No archive found');
  }

}