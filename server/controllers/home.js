const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDevicePath, getDiskSpace } = require('@/utils/diskUtils');
const SmartMontools = require('@/utils/smartmontools');
const { formatSize } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    smartctlPath,
    basePaths
  } = getConfig();
  
  const folders = await Promise.all(Object.keys(basePaths).map(async folderName => {
    const folderPath = basePaths[folderName];

    let status = 'Not Supported';
    let device = null;
    let diskInfo = {};
    try {
      const smartctl = new SmartMontools(smartctlPath);
      if (['linux', 'win32'].includes(os.platform())) {
        const partitionPath = await getDevicePath(folderPath);
        if (partitionPath) {
          const devicePath = partitionPath.replace(/p?\d+$/, '')
          device = path.basename(devicePath); // Remove `/dev/` prefix for href
          status = await smartctl.getDiskHealth(devicePath);
        }
        diskInfo = await getDiskSpace((os.platform() === 'linux') ? partitionPath : folderPath, false);
      }
    } catch (error) {
      console.error(error);
    }

    return {
      name: folderName,
      status, // Disk health status
      device, // Device name for href (e.g., "sda")
      total: !isNaN(diskInfo.size) ? formatSize(diskInfo.size) : '-',
      used: !isNaN(diskInfo.used) ? formatSize(diskInfo.used) : '-',
      available: !isNaN(diskInfo.free) ? formatSize(diskInfo.free) : '-',
      percentUsed: !isNaN(diskInfo.usedPct) ? diskInfo.usedPct : '-',
      path: `/home/${folderName}`,
    };
  }));

  const sleepable = (os.platform() === 'linux') && !!(fs.readdirSync('/dev').find(dev => dev.match(/^sd[a-z]+$/)));

  res.json({ folders, sleepable });
}

module.exports = method;
