const os = require('os');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const { promisify } = require('util');
const mime = require('mime').default; // 使用 mime 库来解析 MIME 类型
const fastFolderSize = require('fast-folder-size');
const { previewCachePath, tempDir } = require('@/config');

const execPromise = util.promisify(exec);

const fastFolderSizeAsync = promisify(fastFolderSize);

// 文件类型和图标的映射表
const typeExtMapping = {
  // Documents
  txt: { type: 'Text File', icon: '📄' },
  doc: { type: 'Word Document', icon: '📝' },
  docx: { type: 'Word Document', icon: '📝' },
  xls: { type: 'Excel Spreadsheet', icon: '📊' },
  xlsx: { type: 'Excel Spreadsheet', icon: '📊' },
  xlsm: { type: 'Macro-Enabled Excel Spreadsheet', icon: '📊' },
  ppt: { type: 'PowerPoint Presentation', icon: '📽️' },
  pptx: { type: 'PowerPoint Presentation', icon: '📽️' },
  pdf: { type: 'PDF Document', icon: '📕' },

  // Images
  png: { type: 'Image File', icon: '🖼️' },
  jpg: { type: 'Image File', icon: '🖼️' },
  jpeg: { type: 'Image File', icon: '🖼️' },
  gif: { type: 'Image File', icon: '🖼️' },
  webp: { type: 'Image File', icon: '🖼️' },
  svg: { type: 'Vector Image', icon: '🎨' },
  ico: { type: 'Icon File', icon: '🔖' },
  jfif: { type: 'Image File', icon: '🖼️' },
  cr2: { type: 'Canon Raw 2 File', icon: '🖼️' },

  // Videos
  mp4: { type: 'Video File', icon: '🎥' },
  mkv: { type: 'Video File', icon: '🎥' },
  mov: { type: 'Video File', icon: '🎥' },
  avi: { type: 'Video File', icon: '🎥' },
  m4v: { type: 'Video File', icon: '📼' },
  mpeg: { type: 'Video File', icon: '📼' },
  rmvb: { type: 'Video File', icon: '📼' },
  m3u8: { type: 'Video File', icon: '📼' },

  // Audio
  mp3: { type: 'Audio File', icon: '🎵' },
  wav: { type: 'Audio File', icon: '🎶' },
  flac: { type: 'Audio File', icon: '🎼' },
  wma: { type: 'Windows Media Audio File', icon: '🎵' },
  m4a: { type: 'Audio File', icon: '🎵' },
  aac: { type: 'Audio File', icon: '🎵' },

  // Archives
  zip: { type: 'Compressed File', icon: '🗜️' },
  rar: { type: 'Compressed File', icon: '🗜️' },
  '7z': { type: 'Compressed File', icon: '🗜️' },
  tar: { type: 'Compressed File', icon: '🗜️' },
  gz: { type: 'Compressed File', icon: '🗜️' },
  xz: { type: 'Compressed File', icon: '🗜️' },
  iso: { type: 'Disk Image', icon: '💿' },
  dmg: { type: 'Mac Disk Image', icon: '🍏' },
  deb: { type: 'Debian Package', icon: '🐧' },
  img: { type: 'Disk Image', icon: '📀' },
  lzh: { type: 'Compressed File', icon: '🗜️' },
  rpm: { type: 'Linux Package', icon: '🐧' },
  vhd: { type: 'Virtual Disk Image', icon: '💾' },

  // Code
  js: { type: 'JavaScript File', icon: '📜' },
  ts: { type: 'TypeScript File', icon: '📜' },
  tsx: { type: 'TypeScript React File', icon: '📘' },
  json: { type: 'JSON File', icon: '🗂️' },
  html: { type: 'HTML File', icon: '🌐' },
  css: { type: 'CSS File', icon: '🎨' },
  java: { type: 'Java Source Code', icon: '☕' },
  py: { type: 'Python Script', icon: '🐍' },
  c: { type: 'C Source Code', icon: '🔧' },
  cpp: { type: 'C++ Source Code', icon: '🔨' },
  sql: { type: 'SQL Script', icon: '📜' },
  hta: { type: 'HTML Application', icon: '📜' },

  // Scripts
  sh: { type: 'Shell Script', icon: '🐚' },
  ps1: { type: 'PowerShell Script', icon: '🖥️' },
  bat: { type: 'Batch Script', icon: '📜' },
  cmd: { type: 'Command Line Script', icon: '📜' },
  reg: { type: 'Registration Entries File', icon: '📜' },

  // Executables
  exe: { type: 'Windows Executable', icon: '💻' },
  dll: { type: 'Dynamic Link Library', icon: '📦' },
  ipa: { type: 'iOS Application Package', icon: '📱' },

  // Text readable files
  ass: { type: 'Subtitle File', icon: '📜' },
  srt: { type: 'Subtitle File', icon: '📜' },
};

// 获取文件类型
function getFileType(filename) {
  const extension = path.extname(filename).toLowerCase().replace('.', ''); // 去掉点，获取扩展名
  const mimeType = mime.getType(filename); // 获取 MIME 类型

  // 优先通过 MIME 类型判断
  if (mimeType && !['tga'].includes(extension)) {
    if (mimeType.startsWith('image/')) {
      return 'Image File';
    } else if (mimeType.startsWith('video/')) {
      return 'Video File';
    } else if (mimeType.startsWith('audio/')) {
      return 'Audio File';
    } else if (mimeType.startsWith('text/')) {
      return 'Text File';
    }
  }

  // 如果 MIME 无法匹配，则从映射表中查找
  const mapping = typeExtMapping[extension];
  if (mapping) {
    return mapping.type;
  } else if (mimeType) {
    return mimeType;
  }

  // 默认返回值
  return 'Unknown File';
}

// 获取文件图标
function getFileIcon(filename, isDirectory = false) {
  if (isDirectory) {
    return '📁';
  }

  const extension = path.extname(filename).toLowerCase().replace('.', ''); // 去掉点，获取扩展名
  const mimeType = mime.getType(filename); // 获取 MIME 类型

  // 优先通过 MIME 类型判断
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType.startsWith('video/')) {
      return '🎥';
    } else if (mimeType.startsWith('audio/')) {
      return '🎵';
    } else if (mimeType.startsWith('text/')) {
      return '📄';
    }
  }

  // 如果 MIME 无法匹配，则从映射表中查找
  const mapping = typeExtMapping[extension];
  if (mapping) {
    return mapping.icon;
  }

  // 默认返回值
  return '📦'; // Default emoji for unknown types
}

// Function to determine if the file can be previewed in the browser
function isViewableFile(filePath) {
  const fileName = filePath.split('/')[filePath.split('/').length - 1];
  const fileType = getFileType(fileName);
  if (['Image File', 'Ico File', 'Text File', 'SQL Script', 'HTML Application', 'JSON File', 'Shell Script', 'Batch Script', 'Command Line Script', 'PowerShell Script', 'HTML File', 'Subtitle File', 'Registration Entries File'].includes(fileType)) {
    return true;
  } else {
    return false;
  }
}

// Function to determine if the file is readable
function isReadableFile(filePath) {
  const fileName = filePath.split('/')[filePath.split('/').length - 1];
  const fileType = getFileType(fileName);
  if (['Text File', 'SQL Script', 'HTML Application', 'JSON File', 'Shell Script', 'Batch Script', 'Command Line Script', 'PowerShell Script', 'HTML File', 'Subtitle File', 'Registration Entries File'].includes(fileType)) {
    return true;
  } else {
    return false;
  }
}

// Function to determine if the file is playable
function isPlayableFile(filePath) {
  const fileName = filePath.split('/')[filePath.split('/').length - 1];
  const fileType = getFileType(fileName);
  if (['Video File', 'Audio File'].includes(fileType)) {
    return true;
  } else {
    return false;
  }
}

// Checking if it's an archive
function isArchive(filePath) {
  const archiveExtensions = /\.(7z|zip|rar|tar|gz|bz2|xz|wim|jar|001|iso|cab|txz|lzma|cpio|bzip2|tgz|tpz|zst|tzst|z|taz|lzh|lha|rpm|deb|arj|vhd|vhdx|swm|esd|fat|ntfs|dmg|hfs|xar|squashfs|apfs)($|\/|\?|\\)/i;
  return archiveExtensions.test(filePath);
}

// Checking if it's hidden
async function isHidden(filePath, isDirectory = false, isSymbolicLink = false, isInArchive = false) {
  const fileName = path.basename(filePath);
  if (fileName.startsWith('.') || ((['lost+found', '__MACOSX'].includes(fileName)) && isDirectory) || isSymbolicLink || fileName.endsWith('.lnk') || (isDirectory && !isInArchive && (path.resolve(filePath) === path.resolve(previewCachePath) || path.resolve(filePath) === path.resolve(tempDir)))) {
    return true;
  }
  if (isInArchive) {
    return false;
  } else if (!fs.existsSync(filePath)) {
    console.error(`Error checking if the path is hidden:\'${filePath}\' does not exists.`);
    return false;
  }
  if (os.platform() === 'win32') {
    try {
      const { stdout } = await execPromise(`attrib "${filePath}"`);
      // 'A' 表示常规文件，'H' 表示隐藏文件
      return stdout.includes('H');
    } catch (error) {
      console.error(`Error checking if the path is hidden: ${error.message}`);
    }
  }
  return false;
}

// 计算文件的 SHA256 校验和（支持中断）
function getFileHash(filePath, algorithm = 'sha256', signal) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(err);
    });

    signal.addEventListener('abort', () => {
      stream.destroy(new Error('AbortError'));
    });
  });
}

// Helper function to format size with units
function formatSize(bytes, toFixed = 2) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex++;
  }
  return `${bytes.toFixed(toFixed)} ${units[unitIndex]}`;
}

// Helper function to get the size of a folder (recursively)
function getFolderSize(folderPath, signal) {
  return fastFolderSizeAsync(folderPath, { signal });
/*
  const stats = fs.statSync(folderPath);

  // If it's a file, return its size
  if (!stats.isDirectory()) {
    return stats.size;
  }

  // If it's a directory, recursively calculate the size
  let totalSize = 0;
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    totalSize += getFolderSize(filePath);
  }

  return totalSize;
*/
}

async function deleteFolderRecursive(directoryPath) {
  console.log('deleting: ', directoryPath);
  const directoryExists = fs.existsSync(directoryPath);
  if (directoryExists) {
    const items = await fsPromises.readdir(directoryPath)
    for (const file of items) {
      const curPath = path.join(directoryPath, file);
      const fileStat = await fsPromises.lstat(curPath);
      if (fileStat.isDirectory()) {
        // recurse
        await deleteFolderRecursive(curPath);
      } else {
        // delete file
        await fsPromises.unlink(curPath);
      }
    }
    await fsPromises.rm(directoryPath, { recursive: true, force: true });
  }
};

async function rm(fullPath, attempts = 0) {
  if (os.platform() === 'win32') {
    if (fullPath.match(/^[a-z]:\\(Windows|Users\\?$|PerfLogs|Program Files|Program Files \(x86\)|ProgramData|MSOCache)?($|\\)/i)) {
      throw new Error(`It's dangerous to delete it`);
    } else if (!fullPath.match(/^[a-z]:\\/i)) {
      throw new Error('Not full path');
    } else {
      const stat = await fsPromises.lstat(fullPath);
      let cmd = '';
      if (stat.isDirectory()) {
        cmd = `rmdir /s /q "${fullPath}"`;
      } else {
        cmd = `del /f /q "${fullPath}"`;
      }
      const { stdout } = await execPromise(cmd);
      return stdout;
    }
  } else if (os.platform() === 'linux') {
    if (fullPath.match(/^\/(home|mnt|root)\/.+/)) {
      const { stdout } = await execPromise(`rm -rf "${fullPath}"`);
      return stdout;
    } else if (!fullPath.startsWith('/')) {
      throw new Error('Not full path');
    } else {
      throw new Error(`It's dangerous to delete it`);
    }
  } else {
    throw new Error(`Not supported platform: "${os.platform()}"`);
  }
}

function encodeURIComponentForPath(path) {
  return encodeURIComponent(path).replace(/%2F/g, '/'); // 不编码"/"符号
}

async function copy(source, destination, options = {}, progressCallback = () => {}, abortSignal = null) {
  progressCallback(0);

  const { retainSource = true, overwrite = true } = options;
  let totalSize = 0, copiedSize = 0;

  function calculateTotalSize(src) {
    if (abortSignal && abortSignal.aborted) throw new Error('Copy operation aborted');

    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      const items = fs.readdirSync(src);
      for (const item of items) {
        calculateTotalSize(path.join(src, item));
      }
    } else {
      totalSize += stats.size;
    }
  }

  function copyFileWithProgress(src, dest) {
    if (abortSignal && abortSignal.aborted) throw new Error('Copy operation aborted');

    if (fs.existsSync(dest) && !overwrite) {
      const stats = fs.statSync(src);
      copiedSize += stats.size;
      progressCallback(copiedSize / totalSize);
      return;
    }

    const stats = fs.statSync(src);
    const bufferSize = stats.size > 100 * 1024 * 1024 ? 1024 * 1024 : 64 * 1024;
    const readStream = fs.createReadStream(src, { highWaterMark: bufferSize });
    const writeStream = fs.createWriteStream(dest, { highWaterMark: bufferSize });

    return new Promise((resolve) => {
      readStream.on('data', (chunk) => {
        if (abortSignal && abortSignal.aborted) {
          readStream.destroy();
          writeStream.destroy();
          fs.unlinkSync(dest);
          return reject(new Error('Copy operation aborted'));
        }

        copiedSize += chunk.length;
        progressCallback(copiedSize / totalSize);
      });

      readStream.on('end', () => {
        fs.utimesSync(dest, stats.atime, stats.mtime);
        resolve();
      });

      readStream.pipe(writeStream);
    });
  }

  async function copyRecursive(src, dest) {
    if (abortSignal && abortSignal.aborted) throw new Error('Copy operation aborted');

    if (!retainSource) {
      try {
        fs.renameSync(src, dest);
        progressCallback(100);
        return;
      } catch (err) {
        // No-op, fallback to copy process if rename fails.
      }
    }

    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest);
      const items = fs.readdirSync(src);
      for (const item of items) {
        await copyRecursive(path.join(src, item), path.join(dest, item));
      }
    } else {
      await copyFileWithProgress(src, dest);
    }
  }

  calculateTotalSize(source);
  await copyRecursive(source, destination);

  if (!retainSource && !(abortSignal && abortSignal.aborted)) {
    fs.rmSync(source, { recursive: true, force: true });
  }
}

module.exports = {
  getFileIcon,
  getFileType,
  isViewableFile,
  isPlayableFile,
  isReadableFile,
  isArchive,
  isHidden,
  getFileHash,
  getFolderSize,
  formatSize,
  deleteFolderRecursive,
  encodeURIComponentForPath,
  rm,
  copy
};
