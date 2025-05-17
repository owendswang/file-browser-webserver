const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Function to convert Disk number to /dev/sdX format
function diskNumberToDevicePath(diskNumber) {
  let deviceLetter = '';
  let adjustedNumber = diskNumber; // 从02开始

  // 逐步获取字母，直到处理完所有数字
  while (adjustedNumber >= 0) {
    const remainder = adjustedNumber % 26; // 取余以获取字母
    deviceLetter = String.fromCharCode(97 + remainder) + deviceLetter; // 获取对应字母并拼接
    adjustedNumber = Math.floor(adjustedNumber / 26) - 1; // 更新数字，-1以处理下一个字母
  }
  
  return `/dev/sd${deviceLetter}`;
}

// get disk device path
async function getDevicePath(mountPath) {
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execPromise(`df ${mountPath}`);
      const lines = stdout.split(os.EOL);
      if (lines.length > 1) {
        const devicePath = lines[1].split(/\s+/)[0];
        return devicePath;
      }
    } else if (os.platform() === 'win32') {
      const driveLetter = mountPath.charAt(0).toUpperCase(); // Example: C

      // Get logical disk to partition mapping
      const { stdout: mapping } = await execPromise('wmic path Win32_LogicalDiskToPartition get Antecedent, Dependent');
      const lines = mapping.trim().split(os.EOL).slice(1);

      for (const line of lines) {
        const parts = line.split(/\s{2,}/);
        if (parts.length < 2) continue; // Skip invalid lines

        // Extract Disk number from Antecedent
        const partitionDeviceId = parts[0];
        const match = partitionDeviceId.match(/Disk #(\d+)/);
        if (match) {
          const diskNumber = parseInt(match[1], 10);
          const logicalDeviceId = parts[1].split('"')[1]; // e.g., "C:"

          if (logicalDeviceId.charAt(0) === driveLetter) {
            return diskNumberToDevicePath(diskNumber); // Return the corresponding /dev/sdX
          }
        }
      }
    }
    return null;
  } catch (err) {
    console.error(`Error fetching device path for ${mountPath}:`, err.message);
    return null;
  }
}

async function getDiskSpace(devicePath, formatSizeFlag = false) {
  function getUsedPercent(used, size) {
    const percentage = used / size * 100;
    if ((percentage.toFixed(0) === '100') && used < size) {
      return 99;
    } else if ((percentage.toFixed(0) === '0') && used > 0) {
      return 1;
    } else {
      return parseInt(percentage);
    }
  }
  try {
    if (os.platform() === 'linux') {
      const command = `df ${formatSizeFlag ? '-h ' : ''}-l --output=source,fstype,itotal,iused,iavail,ipcent,size,used,avail,pcent,file,target ${devicePath}`;
      const { stdout } = await execPromise(command);

      const lines = stdout.trim().split(os.EOL);

      const headers = lines[0].match(/(Filesystem|Type|Inodes|IUsed|IFree|IUse%|1K-blocks|Size|Used|Avail|Use%|File|Mounted on)/g);
      const data = lines[1].match(/[^ ]+/g);

      const rawDiskInfo = {};
      headers.forEach((header, index) => {
        rawDiskInfo[header] = data[index];
      });

      const diskInfo = {
        size: formatSizeFlag ? rawDiskInfo['Size'].replace(/(\d+)([A-Za-z])/g, '$1 $2B') : (parseInt(rawDiskInfo['Avail']) * 1024 + parseInt(rawDiskInfo['Used']) * 1024),
        free: formatSizeFlag ? rawDiskInfo['Avail'].replace(/(\d+)([A-Za-z])/g, '$1 $2B') : (parseInt(rawDiskInfo['Avail']) * 1024),
        used: formatSizeFlag ? rawDiskInfo['Used'].replace(/(\d+)([A-Za-z])/g, '$1 $2B') : (parseInt(rawDiskInfo['Used']) * 1024),
        usedPct: formatSizeFlag ? parseInt(rawDiskInfo['Use%'].replace('%', '')) : getUsedPercent(parseInt(rawDiskInfo['Used']), parseInt(rawDiskInfo['Avail']) + parseInt(rawDiskInfo['Used'])),
      };

      return diskInfo;
    } else if (os.platform() === 'win32') {
      if (devicePath.match(/^[A-Za-z]:/)) {
        const driveLetter = devicePath.match(/^[A-Za-z]:/)[0];
        const command = `wmic volume where "driveletter='${driveLetter}'" get /format:csv`;
        const { stdout } = await execPromise(command);

        const lines = stdout.trim().split(os.EOL);

        const headers = lines[0].split(',');
        const data = lines[1].split(',');

        const rawDiskInfo = {};
        headers.forEach((header, index) => {
          if (data[index].match(/^\d+$/)) {
            rawDiskInfo[header.replace(/(\r\n|\n|\r)/gm, "")] = parseInt(data[index]);
          } else if (data[index] === 'TRUE') {
            rawDiskInfo[header.replace(/(\r\n|\n|\r)/gm, "")] = true;
          } else if (data[index] === 'FALSE') {
            rawDiskInfo[header.replace(/(\r\n|\n|\r)/gm, "")] = false;
          } else {
            rawDiskInfo[header.replace(/(\r\n|\n|\r)/gm, "")] = data[index];
          }
        });
  
        const diskInfo = {
          size: rawDiskInfo['Capacity'],
          free: rawDiskInfo['FreeSpace'],
          used: rawDiskInfo['Capacity'] - rawDiskInfo['FreeSpace'],
          usedPct: getUsedPercent(rawDiskInfo['Capacity'] - rawDiskInfo['FreeSpace'], rawDiskInfo['Capacity']),
        };
  
        return diskInfo;
      } else {
        throw new Error('No drive letter was found.');
      }
    }
  } catch (error) {
    console.error(`Error fetching disk space for ${devicePath}`, error.message);
    return null;
  }
}

async function sleepDisk(devicePath) {
  if (os.platform() === 'linux') {
    const { stdout } = await execPromise(`hdparm -Y ${devicePath}`);
    return stdout;
  } else {
    throw new Error(`System not supported: ${os.platform()}`);
  }
}

module.exports = { getDevicePath, getDiskSpace, sleepDisk };