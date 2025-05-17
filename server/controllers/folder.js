const fs = require('fs');
const path = require('path');
const SevenZip = require('@/utils/7zip');
const {
  isViewableFile,
  isPlayableFile,
  getFileType,
  getFileIcon,
  isArchive,
  isHidden,
  getFolderSize,
  formatSize,
  encodeURIComponentForPath
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    basePaths,
    enableDirSizeChk
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
  let { sortBy = 'modified', order = 'desc', page = '1', pageSize = '20', archivePassword = '', search = '', type = '' } = req.query;
  if (sortBy === '') {
    sortBy = 'modified';
  }
  if (order === '') {
    order = 'desc';
  }

  let files = [];

  // 分页逻辑
  const pageSizeInt = parseInt(pageSize, 10) || 50;

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
        archiveInternalPath = `${pathParts.slice(index + 1).join('/')}${pathParts.slice(index + 1).length > 0 ? '/' : ''}`;
        break;
      }
    }
  }

  if (isInArchive) {
    try {
      const sevenZip = new SevenZip(sevenZipPath);

      const result = await sevenZip.list(archiveFullPath, true, '', archivePassword, signal);
    
      if (!result.isOK) {
        return res.status(500).send(`Failed to read archive content:\n${result.error}`);
      }

      // 找到目标
      const targetFile = result.files.find(f => f.Path.startsWith(archiveInternalPath));

      if (!targetFile) {
        return res.status(404).send('Folder not found in archive');
      }

      // 解析压缩包内容
      const archiveFiles = result.files.map(f => {
        const isDirectory = f.Folder;
        return {
          name: f.Path.replace(/\\/g, '/'),
          size: f.Size,
          modifiedTime: f.Modified || '--',
          isDirectory,
          icon: getFileIcon(f.Path, isDirectory), // 复用图标解析函数
          encrypted: f.Encrypted
        };
      });

      // 筛选当前层级内的文件和文件夹
      const currentLevelFiles = archiveFiles
                                  .filter(file => file.name.startsWith(archiveInternalPath))
                                  .filter(file => file.name.replace(archiveInternalPath, '').split('/').filter(Boolean).length === 1)
                                  .filter(async file => !(await isHidden(file.name, file.isDirectory, false, true)));

      files = currentLevelFiles.map(file => {
        const relativeName = file.name.replace(archiveInternalPath, '');
        const isPlayable = isPlayableFile(relativeName);
        const isViewable = isViewableFile(relativeName);
        const linkPath = encodeURIComponentForPath(`${urlPath}/${relativeName}`);
        const fileType = file.isDirectory ? 'Folder' : getFileType(relativeName);

        return {
          name: relativeName,
          icon: file.icon,
          isDirectory: file.isDirectory,
          path: file.isDirectory
          ? `/folder/${linkPath}`
          : isPlayable
            ? `/vaplay/${linkPath}` // 跳转到 /vaplay/* 播放
            : isViewable
              ? `/view/${linkPath}` // 跳转到 /view/* 预览
              : `/download/${linkPath}`, // 下载路径
          type: fileType,
          size: file.size ? formatSize(file.size) : '--', // 文件大小格式化
          sizeInBytes: file.size,
          target: (isViewable && !file.isDirectory) ? '_blank' : '_self',
          modifiedTime: file.modifiedTime ? file.modifiedTime.toISOString() : '--', // 文件修改时间
          encrypted: file.encrypted
        };
      });

      if (type === 'video') {
        files = files.filter(file => file.type === 'Video File');
      }
    } catch (error) {
      console.error(error);
      if (error.message === 'AbortError') {
        return res.status(499).send('Client Closed Request');
      }
      res.status(500).send(`Error handling archive file:\n${error.message}`);
    }
  } else {
    // 普通文件夹逻辑
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory() || await isHidden(fullPath, true, false, false)) {
      return res.status(404).send('Folder not found');
    }

    const dirItems = fs.readdirSync(fullPath, { withFileTypes: true });

    files = dirItems.map(item => {
      const filePath = item.isSymbolicLink() ? fs.readlinkSync(path.join(fullPath, item.name)) : path.join(fullPath, item.name);
      const stats = fs.lstatSync(filePath);
      const isPlayable = isPlayableFile(item.name);
      const isViewable = isViewableFile(item.name);
      const type = (item.isDirectory() || (item.isSymbolicLink() && fs.lstatSync(filePath).isDirectory())) ? 'Folder' : getFileType(item.name);
      const size = stats.size;
      const linkPath = encodeURIComponentForPath(`${urlPath}/${item.name}`);

      return {
        name: item.name,
        icon: getFileIcon(item.name, type === 'Folder'),
        type,
        size: formatSize(size),
        sizeInBytes: size,
        path: (type === 'Folder' || isArchive(item.name))
          ? `/folder/${linkPath}`
          : isPlayable
            ? `/vaplay/${linkPath}` // 跳转到 /vaplay/* 播放
            : isViewable
              ? `/view/${linkPath}` // 跳转到 /view/* 预览
              : `/download/${linkPath}`, // 下载路径
        target: isViewable ? '_blank' : '_self',
        modifiedTime: stats.mtime.toISOString(),
        filePath,
        isSymbolicLink: item.isSymbolicLink()
      };
    });

    // 计算隐藏文件
    files = await Promise.all(files.map(async (file) => {
      const hidden = await isHidden(path.resolve(fullPath, file.name), file.type === 'Folder', file.isSymbolicLink, false);
      return hidden ? null : file;
    }));

    files = files.filter(file => file !== null);

    if (type === 'video') {
      files = files.filter(file => file.type === 'Video File');
    }
  }

  // 过滤搜索
  if (search) {
    const searchLowerCase = search.toLowerCase();
    files = files.filter(file => file.name.toLowerCase().includes(searchLowerCase));
  }

  // 处理排序
  if (sortBy === 'size') {
    // 在分页之前计算所有文件夹的大小（如果是文件夹类型）
    for (const file of files) {
      if (file.type === 'Folder') {
        if (enableDirSizeChk) {
          const sizeInBytes = await getFolderSize(file.filePath, signal);
          file.sizeInBytes = sizeInBytes;
          file.size = formatSize(sizeInBytes);
        } else {
          file.size = '--';
        }
      }
    }
  }

  // 排序文件
  files.sort((a, b) => {
    if (['name', 'type'].includes(sortBy)) {
      const compareA = a[sortBy] ? a[sortBy].toUpperCase() : '';
      const compareB = b[sortBy] ? b[sortBy].toUpperCase() : '';
      if (order === 'asc') {
        return (compareA < compareB) ? -1 : (compareA > compareB) ? 1 : 0;
      } else {
        files.sort((a, b) => { return a[sortBy] - b[sortBy]; }).reverse();
        return (compareB < compareA) ? -1 : (compareB > compareA) ? 1 : 0;
      }
    }
    if (sortBy === 'size') {
      const compareA = parseInt(a.sizeInBytes) || 0;
      const compareB = parseInt(b.sizeInBytes) || 0;
      return order === 'asc' ? compareA - compareB : compareB - compareA;
    }
    if (sortBy === 'modified') {
      const compareA = new Date(a.modifiedTime).getTime() || 0;
      const compareB = new Date(b.modifiedTime).getTime() || 0;
      return order === 'asc' ? compareA - compareB : compareB - compareA;
    }
  });

  // 分页逻辑
  let totalPages = 1;
  const totalFiles = files.length;
  const currentPageInt = parseInt(page, 10) || 1;
  let paginatedFiles = [];

  if (pageSize === '0') {
    paginatedFiles = files;
  } else {
    totalPages = Math.ceil(totalFiles / pageSizeInt);
    paginatedFiles = files.slice((currentPageInt - 1) * pageSizeInt, currentPageInt * pageSizeInt);
  }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (Math.abs(i - currentPageInt) < 3 || i === currentPageInt || i === 1 || i === totalPages) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  // 生成分页信息
  const pagination = {
    currentPage: currentPageInt,
    totalPages,
    pageSize: pageSizeInt,
    pages,
    total: files.length,
  };

  // 计算文件夹大小（如果按其他方式排序）
  if (sortBy !== 'size') {
    for (const file of paginatedFiles) {
      if (file.type === 'Folder') {
        if (enableDirSizeChk) {
          const sizeInBytes = await getFolderSize(file.filePath, signal);
          file.sizeInBytes = sizeInBytes;
          file.size = formatSize(sizeInBytes);
        } else {
          file.size = '--';
        }
      }
    }
  }

  const responseData = {
    files: paginatedFiles,
    pagination,
    needsPassword: false
  };

  res.json(responseData);
}

module.exports = method;
