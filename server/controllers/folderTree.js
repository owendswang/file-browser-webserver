const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const {
  getFileType,
  getFileIcon,
  isArchive,
  isHidden,
  encodeURIComponentForPath
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    basePaths
  } = getConfig();
  
  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  const urlPath = req.params[0].replace(/\/$/g, '');

  if (urlPath === '') {
    return res.json(Object.keys(basePaths));
  }

  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const fullPath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const pathParts = fullPath.split(path.sep); // 解析路径部分

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

  let folders = [];
  if (isInArchive) {
    try {
      const sevenZip = new SevenZip(sevenZipPath);

      const result = await sevenZip.list(archiveFullPath, true, '', '', signal);
    
      if (!result.isOK) {
        return res.status(500).send(`Failed to read archive content: ${result.error}`);
      }

      // 解析压缩包内容
      const archiveFiles = result.files.map(f => {
        const isDirectory = f.Folder;
        return {
          name: f.Path.replace(/\\/g, '/'),
          size: f.Size ? parseInt(f.Size, 10) : 0,
          modifiedTime: f.Modified || '--',
          isDirectory,
          icon: getFileIcon(f.Path, isDirectory), // 复用图标解析函数
          encrypted: f.Encrypted
        };
      });

      // 筛选当前层级内的文件和文件夹
      const currentLevelFiles = archiveFiles
                                  .filter(file => file.name.startsWith(archiveInternalPath))
                                  .filter(file => file.name.replace(archiveInternalPath, '').split(file.name.includes('/') ? '/' : '\\').filter(Boolean).length === 1)
                                  .filter(async file => !(await isHidden(file.name, file.isDirectory, false, true)));

      folders = currentLevelFiles
        .filter(file => file.isDirectory)
        .map(file => {
          const relativeName = file.name.replace(archiveInternalPath, '').replace(/^\//, '');
          const linkPath = encodeURIComponentForPath(`${urlPath}/${relativeName}`);

          return {
            name: relativeName,
            isDirectory: file.isDirectory,
            path: linkPath,
            modifiedTime: file.modifiedTime ? file.modifiedTime.toISOString() : '-', // 文件修改时间
          };
        });
    } catch (error) {
      console.error(error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  } else {
    // 普通文件夹逻辑
    if (!fs.existsSync(fullPath) || await isHidden(fullPath, true, false, false)) {
      return res.status(404).send('Path not found');
    }

    const dirItems = fs.readdirSync(fullPath, { withFileTypes: true });

    folders = dirItems
                .map(item => {
                  const filePath = item.isSymbolicLink() ? fs.readlinkSync(path.join(fullPath, item.name)) : path.join(fullPath, item.name);
                  const stats = fs.statSync(filePath);
                  const type = item.isDirectory() ? 'Folder' : getFileType(item.name);
                  const linkPath = encodeURIComponentForPath(`${urlPath}/${item.name}`);

                  return {
                    name: item.name,
                    type,
                    path: linkPath,
                    modifiedTime: stats.mtime.toISOString(),
                    filePath,
                  };
                })
                .filter((item) => (item.type === 'Folder' || (isArchive(item.filePath) && fs.existsSync(item.filePath) && fs.lstatSync(item.filePath).isFile())))
                .filter((item) => !(['lost+found', '__MACOSX'].includes(item.name) || item.name.startsWith('.') || item.name.endsWith('.lnk')));
  }

  // 排序文件
  folders.sort((a, b) => {
    const compareA = new Date(a.modifiedTime).getTime() || 0;
    const compareB = new Date(b.modifiedTime).getTime() || 0;
    return compareB - compareA;
  });

  const responseData = folders.map(folder => folder.path);

  res.json(responseData);
}

module.exports = method;
