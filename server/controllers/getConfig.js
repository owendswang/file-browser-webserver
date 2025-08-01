const os = require('os');
const getConfig = require('@/utils/getConfig');
const {
  getFolderSize,
  formatSize
} = require('@/utils/fileUtils');

const method = async (req, res) => {
  const config = getConfig();
  const {
    previewCachePath,
    tempDir
  } = getConfig();

  const tempDirSizeInBytes = await getFolderSize(tempDir);
  const cacheDirSizeInBytes = await getFolderSize(previewCachePath);

  const tempDirSize = formatSize(tempDirSizeInBytes);
  const cacheDirSize = formatSize(cacheDirSizeInBytes);

  return res.json({
    platform: os.platform(),
    arch: os.arch(),
    config,
    tempDirSize,
    cacheDirSize
  });
}

module.exports = method;