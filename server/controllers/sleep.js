const os = require('os');
const fs = require('fs');
const { sleepDisk } = require('@/utils/diskUtils');

const method = async (req, res) => {
  if (os.platform() === 'linux') {
    const disks = fs.readdirSync('/dev').filter(dev => dev.match(/^sd[a-z]+$/));
    try {
      for (const disk of disks) {
        const stdout = await sleepDisk(`/dev/${disk}`);
      }
      return res.end();
    } catch (e) {
      console.error(e);
      return res.status(500).send(`Error put disks to sleep:\n${e.message}`);
    }
  } else {
    return res.status(500).send(`Server system not supported: ${os.platform()}`);
  }
}

module.exports = method;