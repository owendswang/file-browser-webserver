const os = require('os');
// const fs = require('fs');
const SmartMontools = require('@/utils/smartmontools');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    smartctlPath,
  } = getConfig();
  
  const deviceName = decodeURIComponent(req.params[0]);
  const devicePath = `/dev/${deviceName}`; // 添加 /dev/ 前缀

  // 检查磁盘路径是否存在
  /*if (!fs.existsSync(devicePath)) {
    return res.status(404).send(`Disk ${devicePath} does not exist.`);
  }*/

  try {
    const smartctl = new SmartMontools(smartctlPath);
    const diskInfo = await smartctl.getInfo(devicePath, true);
    const smartInfo = await smartctl.getSmartValues(devicePath);
    if (!smartInfo) {
      return res.status(404).send('Failed to fetch SMART values or no data available.');
    }

    const responseData = { devicePath, smartInfo, diskInfo, EOL: os.EOL };
    res.json(responseData);
  } catch (err) {
    console.error(`Error fetching SMART values for ${devicePath}:`, err.message);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = method;
