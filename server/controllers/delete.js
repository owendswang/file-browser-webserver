const os = require('os');
const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const recycleFolderName = 'FB Recycle Bin';

const method = async (req, res) => {
  // 获取查询参数
  const { archivePassword = '' } = req.query;
  const fileList = req.body;

  if (!fileList || !Array.isArray(fileList)) {
    return res.status(404).send('Nothing to delete');
  }

  const {
    sevenZipPath,
    winRarPath,
    basePaths,
    tempDir,
    enableRecycleBin
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
  const folderPath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = folderPath.split(path.sep); // 解析路径部分

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

      if (fs.statSync(archiveFullPath).isFile()) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sevenZip = new SevenZip(sevenZipPath);

  if (enableRecycleBin) {
    const recycleDirPath = path.join(basePaths[folderName], recycleFolderName, Date.now().toString());
    if (!fs.existsSync(recycleDirPath)) {
      fs.mkdirSync(recycleDirPath, { recursive: true });
    }

    if (isInArchive) {
      try {
        const progressCallback = (progress) => {
          const currentProgress = progress / 2;
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        const options = fileList.map((fn) => `"-i!${path.join(archiveInternalPath, fn)}"`).join(' ');
        extractResult = await sevenZip.extract(archiveFullPath, recycleDirPath, options, archivePassword, true, signal, progressCallback);
        if (archiveInternalPath) {
          for (const fn of fileList) {
            fs.renameSync(path.join(recycleDirPath, archiveInternalPath, fn), path.join(recycleDirPath, fn));
          }
          fs.rmSync(path.join(recycleDirPath, archiveInternalPath.split(path.sep)[0]), { recursive: true, force: false });
        }

        if (!extractResult.isOK) {
          res.write(`data: ${JSON.stringify({ error: `Failed to extract from archive:\n${extractResult.error}`})}`);
          return res.end();
        }

        res.write(`data: ${JSON.stringify({ progress: 50 })}\n\n`);
        res.flush();
      } catch (error) {
        console.error('Error extracting from archive file:', error);
        if (error.message === 'AbortError') {
          res.write(`data: ${JSON.stringify({ error: 'Client Closed Request' })}`);
          return res.end();
        }
        res.write(`data: ${JSON.stringify({ error: `Error extracting from archive file:\n${error.message}` })}`);
        return res.end();
      }
    } else {
      let i = 0;
      for (const fn of fileList) {
        const fullPath = path.join(folderPath, fn);
        const recyclePath = path.join(recycleDirPath, fn);

        fs.renameSync(fullPath, recyclePath);

        const currentProgress = i * 100 / fileList.length;
        res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
        res.flush();

        i += 1;
      }
    }
  } else {
    if (!isInArchive) {
      // 如果不是压缩包内部文件，直接删除
      let i = 0;
      for (const fn of fileList) {
        const fullPath = path.join(folderPath, fn);

        fs.rmSync(fullPath, { recursive: true, force: true });

        const currentProgress = i * 100 / fileList.length;
        res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
        res.flush();

        i += 1;
      }
    }
  }

  if (isInArchive) {
    try {
      const options = `"-w${tempDir}"`;

      let deleteResult;
      let archiveInternalFileList = fileList.map((fn) => path.join(archiveInternalPath, fn));
      if (archiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true);
        deleteResult = await winRar.delete(archiveFullPath, archiveInternalFileList, options, archivePassword, signal);
      } else {
        const progressCallback = (progress) => {
          const currentProgress = enableRecycleBin ? (progress / 2 + 50) : progress;
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        deleteResult = await sevenZip.delete(archiveFullPath, archiveInternalFileList, options, archivePassword, signal, progressCallback);
      }

      if (!deleteResult.isOK) {
        return res.status(500).send(`Failed to delete from archive file:\n${deleteResult.error}`);
      }
    } catch (error) {
      console.error('Error deleting from archive file:', error);
      if (error.message === 'AbortError') {
        res.write(`data: ${JSON.stringify({ error: 'Client Closed Request' })}`);
        return res.end();
      }
      res.write(`data: ${JSON.stringify({ error: `Error deleting from archive file:\n${error.message}` })}`);
      return res.end();
    }
  }

  res.write(`data: ${JSON.stringify({ progress: 100 })}\n\n`);
  return res.end();
}

module.exports = method;
