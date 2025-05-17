const os = require('os');
const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  // 获取查询参数
  const { archivePassword = '', newName } = req.query;

  if (!newName) {
    return res.status(400).send('Failed to rename:\nMissing data');
  }

  const {
    sevenZipPath,
    winRarPath,
    winRarLang,
    basePaths,
    tempDir
  } = getConfig();
  
  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  const urlPath = req.params[0].replace(/\/$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const fullPath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = fullPath.split(path.sep); // 解析路径部分

  let isInArchive = false;
  let archivePath, archiveFileName, archiveFullPath, archiveInternalPath = '';

  // 判断是否为压缩包内部文件
  for (const [index, pathPart] of pathParts.entries()) {
    if (isArchive(pathPart)) {
      archivePath = pathParts.slice(0, index).join(path.sep);
      archiveFileName = pathPart;
      archiveFullPath = path.join(archivePath, archiveFileName);

      if (!fs.existsSync(archiveFullPath)) {
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(archiveFullPath).isFile() && fullPath.length > archiveFullPath.length) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
  }

  if (isInArchive) {
    try {
      const newArchiveInternalPath = path.join(archiveInternalPath.split(path.sep).slice(0, archiveInternalPath.split(path.sep).length - 1).join(path.sep), newName);
      const options = `"-w${tempDir}"`;

      let renameResult;
      if (archiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        // 使用 WinRAR 重命名压缩包内的文件或文件夹
        const winRar = new WinRar(winRarPath, true, winRarLang);
        renameResult = await winRar.rename(archiveFullPath, archiveInternalPath, newArchiveInternalPath, options, archivePassword, signal);
      } else {
        // 使用 7-Zip 重命名压缩包内的文件或文件夹
        const sevenZip = new SevenZip(sevenZipPath);
        renameResult = await sevenZip.rename(archiveFullPath, archiveInternalPath, newArchiveInternalPath, options, archivePassword, signal);
      }

      if (!renameResult.isOK) {
        return res.status(500).send(`Failed to rename from archive file:\n${renameResult.error}`);
      }
    } catch (error) {
      console.error('Error deleting from archive file:', error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      return res.status(500).send(`Error deleting from archive file:\n${error.message}`);
    }
  } else {
    // 如果不是压缩包内部文件，直接下载
    if (fs.existsSync(fullPath)) {
      const newFullPath = path.join(pathParts.slice(0, pathParts.length - 1).join(path.sep), newName);
      try {
        fs.renameSync(fullPath, newFullPath);
      } catch (e) {
        console.error(e);
        return res.status(500).send(`Failed to rename:\n${e.message}`);
      }
    } else {
      return res.status(404).send('File not found');
    }
  }
  return res.end();
}

module.exports = method;
