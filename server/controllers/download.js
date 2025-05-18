const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const chardet = require('chardet');
const SevenZip = require('@/utils/7zip');
const {
  isArchive,
  rm,
  getFileType,
  isReadableFile
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    basePaths,
    tempDir,
    previewCachePath
  } = getConfig();

  const thumbnails = res.locals.thumbnails;

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
  const fileName = pathParts[pathParts.length - 1];

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

  const sevenZip = new SevenZip(sevenZipPath);
  const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));
  // 下载完成后删除临时目录
  res.on('close', () => {
    if (fs.existsSync(sevenZipTempDir)) {
      rm(sevenZipTempDir);
    }
  });

  let isDirectory = false;
  let folderPathToCompress = '';

  if (isInArchive) {
    try {
      const listResult = await sevenZip.list(archiveFullPath, true, '', archivePassword, signal);

      if (!listResult.isOK) {
        return res.status(500).send(`Failed to read archive content:\n${listResult.error}`);
      }

      // 找到目标文件的信息
      const targetFile = listResult.files.find(f => f.Path === archiveInternalPath);

      if (!targetFile) {
        return res.status(404).send('File not found in archive');
      }

      if (targetFile.Folder) { // 如果要下载的是压缩包里的文件夹，先解压，再压缩，再下载
        isDirectory = true;

        // 使用 7-Zip 解压指定文件
        const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
        const extractResult = await sevenZip.extract(archiveFullPath, sevenZipTempDir, options, archivePassword, true, signal);

        if (!extractResult.isOK) {
          return res.status(500).send(`Failed to extract file from archive:\n${extractResult.error}`);
        }

        // 解压后的文件夹路径
        folderPathToCompress = path.join(sevenZipTempDir, archiveInternalPath);
      } else {
        // 获取文件的大小和最后修改时间，用于生成 ETag
        const fileSize = targetFile.Size || 0;
        const fileModifiedTime = new Date(targetFile.Modified || 0).getTime();
        const etag = `${fileSize}-${fileModifiedTime}`;
        res.set('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年
        res.set('Expires', new Date(Date.now() + 24 * 60 * 60 * 365 * 1000).toUTCString());
        res.set('ETag', etag);

        // 检查 If-None-Match 头是否匹配
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).send(); // 文件未更改
        }

        // 检查数据库获取视频解压缓存信息
        const fileType = getFileType(fileName);
        if (fileType === 'Video File') {
          const { thumbnailId } = thumbnails.getM3u8Info(fileName, fileModifiedTime, fileSize);
          if (thumbnailId) {
            const cacheFilePath = path.join(previewCachePath, thumbnailId, archiveInternalPath);
            if (fs.existsSync(cacheFilePath)) {
              // if (fs.statSync(cacheFilePath).size === fileSize) {
              if (fs.statSync(cacheFilePath).size > 0) {
                return res.download(cacheFilePath, fileName);
              }
            }
          } else {
            thumbnails.updateM3u8Info(fileName, fileModifiedTime, path.basename(sevenZipTempDir), fileSize, 0);
          }
        }
/*
        // 流式解压下载 （不行，当解压密码错误时，不能正常返回报错）
        const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
        const extractStream = sevenZip.extractStream(archiveFullPath, options, archivePassword, signal);

        res.set('Content-Disposition', `attachment; filename="${encodeURI(fileName)}"`);
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Length', `${fileSize}`);
        res.set('Connection', 'close');

        extractStream.pipe(res);
*/
        // 解压后下载：
        // 使用 7-Zip 解压指定文件
        const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
        const extractResult = await sevenZip.extract(archiveFullPath, sevenZipTempDir, options, archivePassword, true, signal);

        if (!extractResult.isOK) {
          return res.status(500).send(`Failed to extract file from archive:\n${extractResult.error}`);
        }

        // 解压后的文件路径
        const extractedFilePath = path.join(sevenZipTempDir, archiveInternalPath);

        if (!fs.existsSync(extractedFilePath)) {
          return res.status(404).send('Extracted file not found');
        }

        if (isReadableFile(extractedFilePath)) {
          const encoding = await chardet.detectFile(extractedFilePath);
          res.set('content-type', `text/plain; charset=${encoding.startsWith('UTF') ? encoding : 'GB18030'}`);
        }

        // 提供文件下载
        return res.download(extractedFilePath, fileName);

      }
    } catch (error) {
      console.error('Error processing archive file download:', error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      return res.status(500).send(`Error processing file download:\n${error.messager}`);
    }
  } else {
    // 如果不是压缩包内部文件，直接下载
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      // 如果是文件夹，压缩后下载
      if (stats.isDirectory()) {
        isDirectory = true;
        folderPathToCompress = fullPath;
      } else {
        // 添加缓存控制 Header
        const etag = `${stats.size}-${stats.mtime.getTime()}`;
        res.set('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年
        res.set('Expires', new Date(Date.now() + 24 * 60 * 60 * 365 * 1000).toUTCString());
        res.set('ETag', etag);

        // 检查 If-None-Match 头是否匹配
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end(); // 文件未更改
        }

        if (isReadableFile(fullPath)) {
          const encoding = await chardet.detectFile(fullPath);
          res.set('content-type', `text/plain; charset=${encoding.startsWith('UTF') ? encoding : 'GB18030'}`);
        }

        return res.download(fullPath, fileName);
      }
    } else {
      return res.status(404).send('File not found');
    }
  }

  // 压缩文件夹后下载
  if (isDirectory) {
    // 使用 7-Zip 压缩指定文件夹
    const tempArchivePath = path.join(sevenZipTempDir, `${fileName}.zip`);
    const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}"`;
    const compressResult = await sevenZip.add(tempArchivePath, [folderPathToCompress], options, '', signal);
    
    if (!compressResult.isOK) {
      return res.status(500).send(`Failed to compress folder to archive:\n${compressResult.error}`);
    }

    if (!fs.existsSync(tempArchivePath)) {
      return res.status(404).send('Compressed archive file not found');
    }

    // 提供文件下载
    return res.download(tempArchivePath, `${fileName}.zip`);
  }
}

module.exports = method;
