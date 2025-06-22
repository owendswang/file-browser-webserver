const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive, rm } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  // 获取查询参数
  const { archivePassword = '', dst = '' } = req.query;
  const fileList = req.body;

  if (!fileList || !Array.isArray(fileList)) {
    return res.status(404).send('No archives to decompress');
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

  const srcUrlPath = req.params[0].replace(/\/$/g, '');
  const srcFolderName = srcUrlPath.split('/')[0];
  if (!basePaths[srcFolderName]) {
    return res.status(404).send('Source path not found');
  }

  const srcFolderPath = path.join(basePaths[srcFolderName], srcUrlPath.replace(new RegExp(`^${srcFolderName}`, 'g'), ""));
  const srcFolderPathParts = srcFolderPath.split(path.sep); // 解析路径部分

  // 判断源是否为压缩包内部文件
  for (const [index, srcPathPart] of srcFolderPathParts.entries()) {
    if (isArchive(srcPathPart)) {
      const srcPath = srcFolderPathParts.slice(0, index).join(path.sep);
      const srcFileName = srcPathPart;
      const srcFullPath = path.join(srcPath, srcFileName);

      if (!fs.existsSync(srcFullPath)) {
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(srcFullPath).isFile()) {
        return res.status(400).send('Decompressing files in an archive is not supported');
      }
    }
  }

  const fileListToDecompress = [];
  for (const fileName of fileList) {
    if (fs.lstatSync(path.join(srcFolderPath, fileName)).isFile() && isArchive(fileName)) {
      fileListToDecompress.push(path.join(srcFolderPath, fileName));
    }
  }

  if (fileListToDecompress.length === 0) {
    return res.status(404).send('No archives to decompress');
  }

  let dstUrlPath;
  if (dst) {
    dstUrlPath = decodeURIComponent(dst);
  } else {
    dstUrlPath = srcUrlPath;
  }
  const dstFolderName = dstUrlPath.split('/')[0];
  if (!basePaths[dstFolderName]) {
    return res.status(404).send('Destination path not found');
  }

  const dstFullPath = path.join(basePaths[dstFolderName], dstUrlPath.replace(new RegExp(`${dstFolderName}`, 'g'), ""));
  const dstPathParts = dstFullPath.split(path.sep);

  let dstIsInArchive = false;
  let dstArchivePath, dstArchiveFileName, dstArchiveFullPath, dstArchiveInternalPath = '';

  // 判断目的地是否为压缩包内部文件
  for (const [index, dstPathPart] of dstPathParts.entries()) {
    if (isArchive(dstPathPart)) {
      dstArchivePath = dstPathParts.slice(0, index).join(path.sep);
      dstArchiveFileName = dstPathPart;
      dstArchiveFullPath = path.join(dstArchivePath, dstArchiveFileName);

      if (!fs.existsSync(dstArchiveFullPath)) {
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(dstArchiveFullPath).isFile()) {
        dstIsInArchive = true;
        dstArchiveInternalPath = dstPathParts.slice(index + 1).join(path.sep)
        break;
      }
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sevenZip = new SevenZip(sevenZipPath);
  const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));

  // 下载完成后删除临时目录
  res.on('close', () => {
    if (fs.existsSync(sevenZipTempDir)) {
      rm(sevenZipTempDir);
    }
  });

  let moveSrcList = [];
  let srcIndex = 0;
  for (const srcArchiveFullPath of fileListToDecompress) {
    try {
      const listResult = await sevenZip.list(srcArchiveFullPath, true, '', archivePassword, signal);

      if (!listResult.isOK) {
        return res.status(500).send(`Failed to read source from archive content:\n${listResult.error}`);
      }

      // 使用 7-Zip 解压指定文件
      let extractResult = {};
      if (dstIsInArchive) {
        const progressCallback = (progress) => {
          const currentProgress = (progress + (srcIndex * 100)) / (fileListToDecompress.length * 2);
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        extractResult = await sevenZip.extract(srcArchiveFullPath, path.join(sevenZipTempDir, dstArchiveInternalPath), '', archivePassword, true, signal, progressCallback);
      } else {
        const progressCallback = (progress) => {
          const currentProgress = (progress + (srcIndex * 100)) / fileListToDecompress.length;
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        extractResult = await sevenZip.extract(srcArchiveFullPath, dstFullPath, '', archivePassword, true, signal, progressCallback);
      }

      if (!extractResult.isOK) {
        return res.status(500).send(`Failed to extract source from archive:\n${extractResult.error}`);
      }

    } catch (error) {
      console.error('Error handling source archive file:', error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      return res.status(500).send(`Error handling source archive file:\n${error.message}`);
    } finally {
      srcIndex += 1;
    }
  }

  if (dstIsInArchive) {
    // 解压后的文件夹路径
    const files = fs.readdirSync(sevenZipTempDir);
    for (const file of files) {
      moveSrcList.push(path.join(sevenZipTempDir, file));
    }

    try {
      let compressResult;
      if (dstArchiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true, winRarLang);
        const options = `"-x*${path.sep}desktop.ini" "-x*${path.sep}.DS_Store" "-x*${path.sep}__MACOSX" "-w${tempDir}"`;
        compressResult = await winRar.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal);
      } else {
        const progressCallback = (progress) => {
          const currentProgress = (progress + (srcIndex * 100)) / (fileListToDecompress.length * 2);
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}" -y`;
        compressResult = await sevenZip.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal, progressCallback);
      }

      if (!compressResult.isOK) {
        // return res.status(500).send(`Failed to add file to destination archive:\n${compressResult.error}`);
        res.write(`data: ${JSON.stringify({ error: 'Failed to add file to destination archive:\n' + compressResult.error })}`);
        res.flush();
      }
    } catch (error) {
      console.error('Error handling destination archive file:', error);
      if (error.message === 'AbortError') {
        // return res.status(499).send('Client Closed Request');
        res.write(`data: ${JSON.stringify({ error: 'Client Closed Request' })}`);
        res.flush();
      }
      // return res.status(500).send(`Error handling destination archive file:\n${error.message}`);
      res.write(`data: ${JSON.stringify({ error: 'Error handling destination archive file:\n' + error.message })}`);
      res.flush();
    }
  }

  return res.end();
}

module.exports = method;
