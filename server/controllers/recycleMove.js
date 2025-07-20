const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils/7zip');
const WinRar = require('@/utils/winRar');
const { isArchive, copy } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  // 获取查询参数
  const { dst = '' } = req.query;
  const fileList = req.body;

  const {
    sevenZipPath,
    winRarPath,
    winRarLang,
    basePaths,
    tempDir,
    recycleFolderName,
    recycleInfoFileName
  } = getConfig();

  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  if (!dst) {
    return res.status(404).send('Destination path not found');
  }

  const dstUrlPath = decodeURIComponent(dst);
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
        return res.status(404).send('Destination path not found');
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
  // 处理完成后删除临时目录
  res.on('close', () => {
    if (fs.existsSync(sevenZipTempDir)) {
      fs.rmSync(sevenZipTempDir, { recursive: true, force: true });
    }
  });

  let moveSrcList = [];
  if (dstArchiveInternalPath) {
    fs.mkdirSync(path.join(sevenZipTempDir, dstArchiveInternalPath), { recursive: true });
    let i = 0;
    for (const urlPath of fileList) {
      const stringPattern = `\\/.+\\/${recycleFolderName}\\/\\d{13}\\/.+`;
      if (urlPath.match(new RegExp(stringPattern, 'g'))) {
        const basePath = basePaths[urlPath.split('/')[1]];
        if (basePath) {
          const filePath = path.join(basePath, ...urlPath.split('/').slice(2));
          const progressCallback = (progress) => {
            const currentProgress = (progress + i * 100) / fileList.length / 3;
            res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
            res.flush();
          };
          await copy(
            filePath,
            path.join(sevenZipTempDir, dstArchiveInternalPath, fn),
            {},
            progressCallback,
            signal
          );
        }
      }
      i += 1;
    }
    const moveSrc = path.join(sevenZipTempDir, dstArchiveInternalPath.split(path.sep)[0]);
    moveSrcList.push(moveSrc);

    res.write(`data: ${JSON.stringify({ progress: 33.33 })}\n\n`);
    res.flush();
  } else {
    for (const urlPath of fileList) {
      const stringPattern = `\\/.+\\/${recycleFolderName}\\/\\d{13}\\/.+`;
      if (urlPath.match(new RegExp(stringPattern, 'g'))) {
        const basePath = basePaths[urlPath.split('/')[1]];
        if (basePath) {
          const moveSrc = path.join(basePath, ...urlPath.split('/').slice(2));
          moveSrcList.push(moveSrc);
        }
      }
    }
  }

  if (dstIsInArchive) {
    try {
      let compressResult;
      if (dstArchiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true, winRarLang);
        const options = `"-x*${path.sep}desktop.ini" "-x*${path.sep}.DS_Store" "-x*${path.sep}__MACOSX" "-w${tempDir}"`;
        compressResult = await winRar.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal);
      } else {
        const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}"`;
        const progressCallback = (progress) => {
          const currentProgress = !dstArchiveInternalPath ? (progress / 2) : (progress / 3 + 33.33);
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        compressResult = await sevenZip.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal, progressCallback);
      }

      if (!compressResult.isOK) {
        res.write(`data: ${JSON.stringify({ error: `Failed to add file to destination archive:\n${compressResult.error}` })}`);
        return res.end();
      }

      res.write(`data: ${JSON.stringify({ progress: !dstArchiveInternalPath ? 50 : 66.67 })}\n\n`);
      res.flush();
    } catch (error) {
      console.error('Error handling destination archive file:', error);
      if (error.message === 'AbortError') {
        res.write(`data: ${JSON.stringify({ error: 'Client Closed Request' })}`);
        return res.end();
      }
      res.write(`data: ${JSON.stringify({ error: `Error handling destination archive file:\n${error.message}` })}`);
      return res.end();
    }
  } else {
    try {
      let i = 0;
      for (const moveSrc of moveSrcList) {
        // fs.cpSync(
        //   moveSrc,
        //   path.join(dstFullPath, path.basename(moveSrc)),
        //   { errorOnExist: true, force: false, preserveTimestamps: true, recursive: true }
        // );

        const progressCallback = (progress) => {
          const currentProgress = (progress + i * 100) / moveSrcList.length / 2;
          res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
          res.flush();
        };
        await copy(
          moveSrc,
          path.join(dstFullPath, path.basename(moveSrc)),
          {},
          progressCallback,
          signal
        );
        i += 1;
      }

      res.write(`data: ${JSON.stringify({ progress: 50 })}\n\n`);
      res.flush();
    } catch(error) {
      console.error('Error copying', error);
      res.write(`data: ${JSON.stringify({ error: `Error copying:\n${error.message}` })}`);
      return res.end();
    }
  }

  let i = 0;
  for (const urlPath of fileList) {
    const currentProgress = dstArchiveInternalPath ?  (i * 100 / fileList.length / 3 + 66.67) : (i / fileList.length / 2 + 50);
    res.write(`data: ${JSON.stringify({ progress: currentProgress })}\n\n`);
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
