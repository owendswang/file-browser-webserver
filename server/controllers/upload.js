const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const busboy = require('busboy');
const SevenZip = require('@/utils/7zip');
const {
  isArchive,
  rm
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    basePaths,
    tempDir
  } = getConfig();
  
  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  const urlPath = decodeURIComponent(req.params[0].replace(/\/$/g, ''));
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }

  const fullPath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = fullPath.split(path.sep); // 解析路径部分

  // 获取查询参数
  const { archivePassword = '' } = req.query;

  const bb = busboy({ headers: req.headers });

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

  const sevenZipTempDir = path.join(tempDir, randomBytes(16).toString('hex'));
  let uploadFolderPath;
  if (isInArchive) {
    // 如果是压缩包内部的文件，先保存到临时文件夹
    uploadFolderPath = path.join(sevenZipTempDir, archiveInternalPath);
    fs.mkdirSync(uploadFolderPath, { recursive: true });
  } else {
    // 如果不是压缩包内部文件，直接保存普通文件
    uploadFolderPath = fullPath;
  }

  // 处理接受文件
  if (fs.existsSync(uploadFolderPath)) {
    // 使用 busboy 的方法
    let relativePath, lastModified, saveTo;
  
    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      console.log(`File [%j]: filename: %j, encoding: %j, mimeType: %j`, name, filename, encoding, mimeType);
      saveTo = relativePath ? path.resolve(uploadFolderPath, relativePath) : path.resolve(uploadFolderPath, filename);
      if (!fs.existsSync(path.dirname(saveTo))) fs.mkdirSync(path.dirname(saveTo), { recursive: true });
      const fileWriteStream = fs.createWriteStream(saveTo);
      file.pipe(fileWriteStream);
      fileWriteStream.on('close', async () => {
        if (lastModified) {
          // console.log(saveTo, new Date(lastModified));
          fs.utimesSync(saveTo, new Date(lastModified), new Date(lastModified));
        }

        if (isInArchive) {
          const sevenZip = new SevenZip(sevenZipPath);
          const options = `"-xr!desktop.ini" "-xr!.DS_Store" "-xr!__MACOSX" "-w${tempDir}"`;
          const compressResult = await sevenZip.add(archiveFullPath, [path.join(sevenZipTempDir, (archiveInternalPath ? archiveInternalPath.split(path.sep)[0] : relativePath ? relativePath.split(path.sep)[0] : filename))], options, archivePassword, signal);

          await rm(uploadFolderPath);

          if (!compressResult.isOK) {
            return res.status(500).send(`Failed to add file to archive:\n${compressResult.error}`);
          }
        }

        return res.end();
      });
    });
  
    bb.on('field', (name, val, info) => {
      const { nameTruncated, valueTruncated, encoding, mimeType } = info;
      console.log(`Field [%j]: value: %j, encoding: %j, mimeType: %j`, name, val, encoding, mimeType);
      if (name === 'relativePath') {
        relativePath = val;
      } else if (name === 'lastModified') {
        lastModified = parseInt(val);
      }
    });
  
    /*bb.on('close', () => {
      res.set('Connection', 'close');
      return res.end();
    });*/
  
    res.set('Connection', 'close');
    req.pipe(bb);
  } else {
    return res.status(404).send('Folder not found');
  }

}

module.exports = method;
