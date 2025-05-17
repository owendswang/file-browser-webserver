const os = require('os');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const config = getConfig();
  return res.json({
    platform: os.platform(),
    arch: os.arch(),
    config
  });
}

module.exports = method;