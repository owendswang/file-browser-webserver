const os = require('os');
const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive, rm } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    winRarPath,
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

  // 获取查询参数
  const { archivePassword = '' } = req.query;

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
      const options = `"-w${tempDir}"`;

      let deleteResult;
      if (archiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true);
        deleteResult = await winRar.delete(archiveFullPath, [archiveInternalPath], options, archivePassword, signal);
      } else {
        const sevenZip = new SevenZip(sevenZipPath);
        deleteResult = await sevenZip.delete(archiveFullPath, [archiveInternalPath], options, archivePassword, signal);
      }

      if (!deleteResult.isOK) {
        return res.status(500).send(`Failed to delete from archive file:\n${deleteResult.error}`);
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
      await rm(fullPath);
    } else {
      return res.status(404).send('File not found');
    }
  }
  return res.end();
}

module.exports = method;
