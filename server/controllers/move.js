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
  const { archivePassword = '', dst = '', keepSrc = '0' } = req.query;
  const fileList = req.body;

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

  if (!dst) {
    return res.status(404).send('Destination path not found');
  }

  let srcIsInArchive = false;
  let srcArchivePath, srcArchiveFileName, srcArchiveFullPath, srcArchiveInternalPath = '';

  // 判断源是否为压缩包内部文件
  for (const [index, srcPathPart] of srcFolderPathParts.entries()) {
    if (isArchive(srcPathPart)) {
      srcArchivePath = srcFolderPathParts.slice(0, index).join(path.sep);
      srcArchiveFileName = srcPathPart;
      srcArchiveFullPath = path.join(srcArchivePath, srcArchiveFileName);

      if (!fs.existsSync(srcArchiveFullPath)) {
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(srcArchiveFullPath).isFile()) {
        srcIsInArchive = true;
        srcArchiveInternalPath = srcFolderPathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
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
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(dstArchiveFullPath).isFile()) {
        dstIsInArchive = true;
        dstArchiveInternalPath = dstPathParts.slice(index + 1).join(path.sep)
        break;
      }
    }
  }

  const sevenZip = new SevenZip(sevenZipPath);
  const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));
  // 处理完成后删除临时目录
  res.on('close', () => {
    if (fs.existsSync(sevenZipTempDir)) {
      rm(sevenZipTempDir);
    }
  });

  let moveSrcList = [];
  if (srcIsInArchive) {
    try {
      const listResult = await sevenZip.list(srcArchiveFullPath, true, '', archivePassword, signal);

      if (!listResult.isOK) {
        return res.status(500).send(`Failed to read source from archive content:\n${listResult.error}`);
      }

      for (const fn of fileList) {
        // 找到目标文件的信息
        const targetFile = listResult.files.find(f => f.Path ===  path.join(srcArchiveInternalPath, fn));

        if (!targetFile) {
          return res.status(404).send('Source not found in archive');
        }
      }

      // 使用 7-Zip 解压指定文件
      const options = fileList.map((fn) => `"-i!${path.join(srcArchiveInternalPath, fn)}"`).join(' '); // 指定要解压的文件
      let extractResult = {};
      if (dstIsInArchive) {
        extractResult = await sevenZip.extract(srcArchiveFullPath, sevenZipTempDir, options, archivePassword, true, signal);

        if (dstArchiveInternalPath) {
          fs.mkdirSync(path.join(sevenZipTempDir, dstArchiveInternalPath), { recursive: true, });
          for (const fn of fileList) {
            fs.renameSync(path.join(sevenZipTempDir, srcArchiveInternalPath, fn), path.join(sevenZipTempDir, dstArchiveInternalPath, fn));
          }
          moveSrcList.push(path.join(sevenZipTempDir, dstArchiveInternalPath.split(path.sep)[0]));
        } else {
          for (const fn of fileList) {
            // 解压后的文件夹路径
            const moveSrc = path.join(sevenZipTempDir, srcArchiveInternalPath, fn);
            moveSrcList.push(moveSrc);
          }
        }
      } else {
        extractResult = await sevenZip.extract(srcArchiveFullPath, dstFullPath, options, archivePassword, true, signal);
        if (srcArchiveInternalPath) {
          for (const fn of fileList) {
            fs.renameSync(path.join(dstFullPath, srcArchiveInternalPath, fn), path.join(dstFullPath, fn));
          }
          fs.rmSync(path.join(dstFullPath, srcArchiveInternalPath.split(path.sep)[0]), { recursive: true, force: false });
        }
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
    }
  } else {
    if (fs.existsSync(srcFolderPath)) {
      if (dstArchiveInternalPath) {
        fs.mkdirSync(path.join(sevenZipTempDir, dstArchiveInternalPath), { recursive: true });
        for (const fn of fileList) {
          fs.cpSync(
            path.join(srcFolderPath, fn),
            path.join(sevenZipTempDir, dstArchiveInternalPath, fn),
            { errorOnExist: true, force: false, preserveTimestamps: true, recursive: true }
          );
        }
        const moveSrc = path.join(sevenZipTempDir, dstArchiveInternalPath.split(path.sep)[0]);
        moveSrcList.push(moveSrc);
      } else {
        for (const fn of fileList) {
          const moveSrc = path.join(srcFolderPath, fn);
          moveSrcList.push(moveSrc);
        }
      }
    } else {
      return res.status(404).send('Source not found');
    }
  }

  if (dstIsInArchive) {
    try {
      let compressResult;
      if (dstArchiveFileName.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
        const winRar = new WinRar(winRarPath, true, winRarLang);
        const options = `"-x*${path.sep}desktop.ini" "-x*${path.sep}.DS_Store" "-x*${path.sep}__MACOSX" "-w${tempDir}"`;
        compressResult = await winRar.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal);
        console.log(compressResult);
      } else {
        const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}"`;
        console.log(moveSrcList);
        compressResult = await sevenZip.add(dstArchiveFullPath, moveSrcList, options, archivePassword, signal);
      }

      if (!compressResult.isOK) {
        return res.status(500).send(`Failed to add file to destination archive:\n${compressResult.error}`);
      }
    } catch (error) {
      console.error('Error handling destination archive file:', error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      return res.status(500).send(`Error handling destination archive file:\n${error.message}`);
    }
  } else if (!srcIsInArchive) {
    try {
      for (const moveSrc of moveSrcList) {
        fs.cpSync(
          moveSrc,
          path.join(dstFullPath, path.basename(moveSrc)),
          { errorOnExist: true, force: false, preserveTimestamps: true, recursive: true }
        );
      }
    } catch(error) {
      console.error('Error copying', error);
      return res.status(500).send(`Error copying:\n${error.message}`);
    }
  }

  if (!parseInt(keepSrc)) {
    if (srcIsInArchive) {
      try {
        const options = `"-w${tempDir}"`;

        let deleteResult;
        const srcArchiveInternalDeletePathList = fileList.map((fn) => path.join(srcArchiveInternalPath, fn));
        if (srcArchiveFullPath.endsWith('.rar') && ['x86', 'x64'].includes(os.arch())) {
          const winRar = new WinRar(winRarPath, true, winRarLang);
          deleteResult = await winRar.delete(srcArchiveFullPath, srcArchiveInternalDeletePathList, options, archivePassword, signal);
        } else {
          deleteResult = await sevenZip.delete(srcArchiveFullPath, srcArchiveInternalDeletePathList, options, archivePassword, signal);
        }
  
        if (!deleteResult.isOK) {
          return res.status(500).send(`Failed to delete from srouce archive file:\n${deleteResult.error}`);
        }
      } catch (error) {
        console.error('Error deleting from source archive file:', error);
        if (error.message === 'AbortError') {
          return res.status(499).send('Client Closed Request');
        }
        return res.status(500).send(`Error deleting from source archive file:\n${error.message}`);
      }
    } else {
      for (const fn of fileList) {
        fs.rmSync(path.join(srcFolderPath, fn), { recursive: true, force: false });
      }
    }
  }

  return res.end();
}

module.exports = method;
