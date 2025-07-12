const fs = require('fs');
const path = require('path');
const { getFolderSize, formatSize, getFileType, getFileIcon } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    basePaths,
    recycleFolderName,
    recycleInfoFileName,
    enableDirSizeChk
  } = getConfig();

  const abortController = new AbortController();
  const { signal } = abortController;
  req.on('close', () => {
    abortController.abort();
  });

  // 获取查询参数
  let { sortBy = 'modified', order = 'desc', page = '1', pageSize = '20', search = '' } = req.query;
  if (sortBy === '') {
    sortBy = 'deletedAt';
  }
  if (order === '') {
    order = 'desc';
  }
  const pageSizeInt = parseInt(pageSize, 10) || 50;
  const currentPageInt = parseInt(page, 10) || 1;

  let recycleItems = [];

  for (const [baseName, basePath] of Object.entries(basePaths)) {
    const recycleDirPath = path.join(basePath, recycleFolderName);
    if (fs.existsSync(recycleDirPath) && fs.statSync(recycleDirPath).isDirectory()) {
      for (const deletedTimeStamp of fs.readdirSync(recycleDirPath)) {
        const recyclePath = path.join(recycleDirPath, deletedTimeStamp);
        if (fs.statSync(recyclePath).isDirectory()) {
          const recycleInfoFilePath = path.join(recyclePath, recycleInfoFileName);
          let recycleInfo = {};
          if (fs.existsSync(recycleInfoFilePath) && fs.statSync(recycleInfoFilePath).isFile()) {
            try {
              const recycleInfoStr = fs.readFileSync(recycleInfoFilePath);
              recycleInfo = JSON.parse(recycleInfoStr);
            } catch (e) {
              // console.error(e);
              console.error('Skipped invalid recycle info file.');
            }
          }

          for (const itemName of fs.readdirSync(recyclePath)) {
            const itemPath = path.join(recyclePath, itemName);
            const itemStats = fs.statSync(itemPath);

            if (!((itemName === recycleInfoFileName) && itemStats.isFile())) {
              let itemSize = '--';
              let itemSizeInBytes = 0;
              if (enableDirSizeChk && (sortBy === 'size') && itemStats.isDirectory()) {
                const sizeInBytes = await getFolderSize(itemPath, signal);
                itemSizeInBytes = sizeInBytes;
                itemSize = formatSize(sizeInBytes);
              }
              if (itemStats.isFile()) {
                const sizeInBytes = itemStats.size;
                itemSizeInBytes = sizeInBytes;
                itemSize = formatSize(sizeInBytes);
              }

              recycleItems.push({
                name: itemName,
                path: '/' + [baseName, recycleFolderName, deletedTimeStamp, itemName].join('/'),
                type: itemStats.isDirectory() ? 'Folder' : getFileType(itemName),
                icon: getFileIcon(itemName, itemStats.isDirectory()),
                deletedAt: (new Date(parseInt(deletedTimeStamp, 10))).toISOString(),
                // deletedFrom: recycleInfo.deletedFrom || '-',
                deletedUrl: recycleInfo.deletedUrl || '-',
                size: itemSize,
                sizeInBytes: itemSizeInBytes
              });
            }
          }
        }
      }
    }
  }

  // 过滤搜索
  if (search) {
    const searchLowerCase = search.toLowerCase();
    recycleItems = recycleItems.filter(item => item.name.toLowerCase().includes(searchLowerCase));
  }

  // 排序文件
  recycleItems.sort((a, b) => {
    if (['deletedUrl'].includes(sortBy)) {
      const compareA = a[sortBy] ? a[sortBy].toUpperCase() : '';
      const compareB = b[sortBy] ? b[sortBy].toUpperCase() : '';
      if (order === 'asc') {
        return (compareA < compareB) ? -1 : (compareA > compareB) ? 1 : 0;
      } else {
        return (compareB < compareA) ? -1 : (compareB > compareA) ? 1 : 0;
      }
    }
    if (sortBy === 'size') {
      const compareA = parseInt(a.sizeInBytes) || 0;
      const compareB = parseInt(b.sizeInBytes) || 0;
      return order === 'asc' ? compareA - compareB : compareB - compareA;
    }
    if (sortBy === 'deletedAt') {
      const compareA = new Date(a.deletedAt).getTime() || 0;
      const compareB = new Date(b.deletedAt).getTime() || 0;
      return order === 'asc' ? compareA - compareB : compareB - compareA;
    }
  });

  // 分页逻辑
  let totalPages = 1;
  const totalFiles = recycleItems.length;
  let paginatedItems = [];

  if (pageSize === '0') {
    paginatedItems = recycleItems;
  } else {
    totalPages = Math.ceil(totalFiles / pageSizeInt);
    paginatedItems = recycleItems.slice((currentPageInt - 1) * pageSizeInt, currentPageInt * pageSizeInt);
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
    total: totalFiles,
  };

  if (enableDirSizeChk && (sortBy !== 'size')) {
    const items = [];
    for (const item of paginatedItems) {
      const sizeInBytes = await getFolderSize(file.filePath, signal);
      const size = formatSize(sizeInBytes);
      items.push({
        ...item,
        size,
        sizeInBytes
      });
    }
    paginatedItems = items;
  }

  res.json({
    recycleItems: paginatedItems,
    pagination
  });
}

module.exports = method;
