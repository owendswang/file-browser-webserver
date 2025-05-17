const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive, rm } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
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

  // 获取查询参数
  const { archivePassword = '', dir } = req.query;

  if (!dir) {
    return res.status(400).send('Directory name not provided.');
  }

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

      if (fs.lstatSync(archiveFullPath).isFile()) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
  }

  if (isInArchive) {
    // 如果是压缩包内创建文件夹，先在临时文件夹内创建目录结构，再添加到压缩包内
    try {
      const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));
      fs.mkdirSync(path.join(sevenZipTempDir, archiveInternalPath, dir), { recursive: true });

      let compressResult;
      if (archiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true, winRarLang);
        const options = `"-x*${path.sep}desktop.ini" "-x*${path.sep}.DS_Store" "-x*${path.sep}__MACOSX" "-w${tempDir}" -ep1`;
        compressResult = await winRar.add(archiveFullPath, [path.join(sevenZipTempDir, (archiveInternalPath ? archiveInternalPath.split(path.sep)[0] : dir))], options, archivePassword, signal);
      } else {
        const sevenZip = new SevenZip(sevenZipPath);
        const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}"`;
        compressResult = await sevenZip.add(archiveFullPath, [path.join(sevenZipTempDir, (archiveInternalPath ? archiveInternalPath.split(path.sep)[0] : dir))], options, archivePassword, signal);
      }

      await rm(sevenZipTempDir);
      // fs.rmSync(sevenZipTempDir, { recursive: true, force: true });
      // await deleteFolderRecursive(sevenZipTempDir);

      if (!compressResult.isOK) {
        return res.status(500).send(`Failed to create directory in archive:\n${compressResult.error}`);
      }
      return res.end();
    } catch (error) {
      console.error('Error creating directory in archive file:', error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      return res.status(500).send(`Error creating directory in archive file:\n${error.message}`);
    }
  } else {
    // 如果不是压缩包内部文件，直接创建文件夹
    console.log(path.join(fullPath, dir));
    fs.mkdir(path.join(fullPath, dir), { recursive: false }, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send(`Error creating directory:\n${err.message}`);
      }
      return res.end();
    });
  }
}

module.exports = method;
