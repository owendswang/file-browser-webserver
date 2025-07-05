const fs = require('fs');
const path = require('path');
const mime = require('mime').default; // 使用 mime 库来解析 MIME 类型
const SevenZip = require('@/utils/7zip');
const {
  isPlayableFile,
  isViewableFile,
  getFileType,
  isArchive,
  encodeURIComponentForPath
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    basePaths,
  } = getConfig();
  
  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  // 获取查询参数
  let { archivePassword = '', type = '' } = req.query;

  const urlPath = req.params[0].replace(/\/$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const filePath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = filePath.split(path.sep); // 解析路径部分
  const fileDownloadPath = `/download/${encodeURIComponentForPath(urlPath)}?archivePassword=${encodeURIComponent(archivePassword)}`; // Generate network-accessible URL

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

    // 使用 7-Zip 解压指定文件
    const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
    const testResult = await sevenZip.test(archiveFullPath, options, archivePassword, signal);

    if (!testResult.isOK) {
      return res.status(500).send(`Failed to test file from archive:\n${testResult.error}`);
    }
  } else {
    if (!fs.existsSync(filePath)) {
      res.status(404).send('File not found');
    }
  }

  // 获取文件的 MIME 类型
  const mediaType = mime.getType(filePath);

  // 检查文件是否支持预览
  const isPlayable = isPlayableFile(fileName);
  if (type === 'play' && !isPlayable) {
    return res.status(400).send('File type not supported for playing.');
  }

  // 检查文件是否支持预览
  const isViewable = isViewableFile(fileName);
  if (type === 'view' && !isViewable) {
    return res.status(400).send('File type not supported for viewing.');
  }

  const responseData = { filePath: fileDownloadPath, mediaType, fileName, fileType };
  res.json(responseData);
}

module.exports = method;
