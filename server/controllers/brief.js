const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const mime = require('mime').default; // 使用 mime 库来解析 MIME 类型
const SevenZip = require('@/utils/7zip');
const FFmpeg = require('@/utils/ffmpeg');
const {
  getFileType,
  isArchive,
  formatSize,
  rm,
  getFolderSize
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const capitalize = (str) => {
  if (typeof(str) === 'string' && str.length > 0) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  } else {
    return str;
  }
}

const method = async (req, res) => {
  const {
    sevenZipPath,
    ffmpegPath,
    basePaths,
    tempDir,
    enableDirSizeChk
  } = getConfig();

  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  // 获取查询参数
  let { archivePassword = '' } = req.query;

  const urlPath = req.params[0].replace(/\/$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const filePath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = filePath.split(path.sep); // 解析路径部分

  // 提取文件名
  const fileName = pathParts[pathParts.length - 1];

  // 获取文件类别
  const fileType = getFileType(fileName);

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

      if (fs.statSync(archiveFullPath).isFile() && filePath.length > archiveFullPath.length) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
  }

  if (!isInArchive && !fs.existsSync(filePath)) {
    // 如果不是压缩包，检查文件本身是否存在
    return res.status(404).send('File not found');
  }

  let fileInfo = {};
  let mediaFilePath = '';

  if (isInArchive) {
    // 使用 7-Zip 的 list 函数获取压缩包内文件信息
    const sevenZip = new SevenZip(sevenZipPath);
    const result = await sevenZip.list(archiveFullPath, true, '', archivePassword, signal);

    if (!result.isOK) {
      return res.status(500).send(`Failed to read archive content:\n${result.error}`);
    }

    // 找到目标文件的信息
    const targetFile = result.files.find(
      (f) => f.Path === archiveInternalPath
    );

    if (!targetFile) {
      return res.status(404).send('File not found in archive');
    }

    fileInfo = {
      // Icon: getFileIcon(targetFile.Path, targetFile.Folder),
      Type: targetFile.Folder ? 'Folder' : fileType,
      'Size': typeof(targetFile.Size) === 'number' && !targetFile.Folder ? formatSize(targetFile.Size) : '--',
      'Size In Bytes': typeof(targetFile.Size) === 'number' ? targetFile.Size : '--',
      'Modified Time': targetFile.Modified ? targetFile.Modified.toISOString() : '--',
      'Accessed Time': targetFile.Accessed ? targetFile.Accessed.toISOString() : '--',
      'Changed Time': targetFile.Created ? targetFile.Created.toISOString() : '--',
      'Encrypted': targetFile.Encrypted
    };

    if (['Video File', 'Image File'].includes(fileType)) {
      const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));

      // 使用 7-Zip 解压指定文件
      const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
      const extractResult = await sevenZip.extract(archiveFullPath, sevenZipTempDir, options, archivePassword, true, signal);

      if (!extractResult.isOK) {
        return res.status(500).send(`Failed to extract target from archive:\n${extractResult.error}`);
      }

      // 解压后的文件夹路径
      mediaFilePath = path.join(sevenZipTempDir, targetFile.Path);

      res.on('close', () => {
        rm(sevenZipTempDir);
      });
    }
  } else {
    if (!fs.existsSync(filePath)) {
      res.status(404).send('File not found');
    }

    const stat = fs.statSync(filePath);
    let size = stat.size;
    if (stat.isDirectory() && enableDirSizeChk) {
      try {
        size = await getFolderSize(filePath, signal);
      } catch (e) {
        if (e.message === 'AbortError') {
          return res.status(499).send('Request Aborted');
        } else {
          console.error(e);
          return res.status(500).send(`Error calculating folder size:\n${e.message}`);
        }
      }
    }
    fileInfo = {
      // Icon: getFileIcon(filePath, stat.isDirectory()),
      Type: stat.isDirectory() ? 'Folder' : fileType,
      'Size': (stat.isDirectory() && !enableDirSizeChk) ? '--' : formatSize(size),
      'Size In Bytes': (stat.isDirectory() && !enableDirSizeChk) ? '--' : size,
      'Modified Time': stat.mtime ? stat.mtime.toISOString() : '--',
      'Accessed Time': stat.atime ? stat.atime.toISOString() : '--',
      'Changed Time': stat.ctime ? stat.ctime.toISOString() : '--'
    };

    if (['Video File', 'Image File'].includes(fileType)) {
      mediaFilePath = filePath;
    }
  }

  let mediaInfo = {};

  if (['Video File', 'Image File'].includes(fileType) && mediaFilePath) {
    try {
      // 使用 ffprobe 获取媒体文件信息
      const ffmpeg = new FFmpeg(ffmpegPath);
      let output = await ffmpeg.getMediaInfoFromFile(mediaFilePath, true);

      const convert2mediaInfo = (objData) => {
        let infoObj = {};
        for (const [key, val] of Object.entries(objData)) {
          let newKey = key.split('_').map((word) => capitalize(word)).join(' ');
          if (typeof(val) === 'object') {
            infoObj[newKey] = convert2mediaInfo(val);
          } else {
            infoObj[newKey] = val;
          }
        }
        return infoObj;
      }

      mediaInfo = convert2mediaInfo(output);
    } catch (e) {
      console.error(e);
      return res.status(500).send(`Error getting media info:\n${e.message}`);
    }
  }

  let responseData = {};

  // 获取文件的 MIME 类型
  const mediaType = mime.getType(filePath) ;
  if (mediaType) {
    responseData['Media Type'] = mediaType;
  }

  responseData = {
    ...responseData,
    ...fileInfo,
    ...mediaInfo,
  };

  return res.json(responseData);
}

module.exports = method;
