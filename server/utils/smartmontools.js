const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const os = require('os');
const fs = require('fs');

class SmartMontools {
  constructor(smartctlPath = null) {
    this.SMARTCTL_PATH = smartctlPath || this._getDefaultSmartctlPath();
    if (!fs.existsSync(this.SMARTCTL_PATH)) {
      throw new Error(`smartctl executable not found at ${this.SMARTCTL_PATH}. Please set the correct path.`);
    }
    this.JSON_OUTPUT = false;
  }

  _getDefaultSmartctlPath() {
    if (os.platform() === 'win32') return 'C:\\Program Files\\smartmontools\\bin\\smartctl.exe';
    if (os.platform() === 'linux') return '/usr/sbin/smartctl';
    if (os.platform() === 'darwin') return '/usr/local/bin/smartctl';
    throw new Error('Unsupported operating system');
  }

  async getDiskHealth(devicePath) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}" -H ${devicePath}`);
      const healthLine = stdout.split('\n').find(line => line.includes('SMART overall-health'));
      if (healthLine && healthLine.includes('PASSED')) {
        return 'Healthy';
      } else if (healthLine && healthLine.includes('FAILED')) {
        return 'Unhealthy';
      }
      return 'Unknown';
    } catch (err) {
      console.error(`Error fetching disk health for ${devicePath}:`, err.message, err.stdout);
      return 'Unknown';
    }
  }

  async getSmartValues(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} -A ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching SMART values for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async getInfo(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} -i ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching info for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async getAll(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} -a ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching all SMART information for ${devicePath}:`, err.message);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async testLong(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} --test=long ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error running long test for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async getAttributes(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} --attributes ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching attributes for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async getSelfTestLog(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} -l selftest ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching self-test log for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }

  async getErrorLog(devicePath, json = this.JSON_OUTPUT) {
    try {
      const { stdout } = await execPromise(`"${this.SMARTCTL_PATH}"${json ? ' -j' : ''} -l error ${devicePath}`);
      return json ? JSON.parse(stdout) : stdout;
    } catch (err) {
      console.error(`Error fetching error log for ${devicePath}:`, err.message, err.stdout);
      return json ? JSON.parse(err.stdout) : err.stdout;
    }
  }
}

module.exports = SmartMontools;
