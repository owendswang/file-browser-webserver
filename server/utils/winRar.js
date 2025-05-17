const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Language map examples for English and Chinese
const languageMaps = {
  'en-US': {
    Name: 'Name:',
    Type: 'Type:',
    Size: 'Size:',
    PackedSize: 'Packed size:',
    Ratio: 'Ratio:',
    Modified: 'Modified:',
    Attributes: 'Attributes:',
    Crc32Mac: 'CRC32 MAC:',
    HostOS: 'Host OS:',
    Compression: 'Compression:',
    Flags: 'Flags:',
    Archive: 'Archive:',
    Details: 'Details:',
    Encryted: 'encrypted',
    Directory: 'Directory',
    File: 'File',
  },
  'zh-CN': {
    Name: '名称:',
    Type: '类型:',
    Size: '大小:',
    PackedSize: '打包大小:',
    Ratio: '压缩率:',
    Modified: '修改时间:',
    Attributes: '属性:',
    Crc32Mac: 'CRC32 MAC:',
    HostOS: '主机操作系统:',
    Compression: '压缩:',
    Flags: '旗标:',
    Archive: '压缩文件:',
    Details: '详细资料:',
    Encryted: '已加密',
    Directory: '目录',
    File: '文件',
  }
};

class WinRAR {
  constructor(winRARPath = null, verbose = false, language = 'en-US') {
    this.WINRAR_PATH = winRARPath || this._getDefaultWinRARPath();
    this.verbose = verbose; // 控制是否输出到屏幕
    this.language = language;

    if (!fs.existsSync(this.WINRAR_PATH)) {
      throw new Error(`WinRAR executable not found at ${this.WINRAR_PATH}. Please set the correct path.`);
    }

    if (!Object.keys(languageMaps).includes(this.language)) {
      throw new Error(`Language ${this.language} is not supported for WinRAR class.`);
    }

    this.languageMap = languageMaps[this.language];
  }

  // 自动获取系统默认路径
  _getDefaultWinRARPath() {
    if (os.platform() === 'win32') return 'C:\\Program Files\\WinRAR\\WinRAR.exe';
    if (os.platform() === 'linux') return '/usr/local/rar/rar';
    throw new Error('WinRAR is supported only on Windows platforms.');
  }

  // 方法用于执行命令并处理输出和错误
  _runCommand(args, signal) {
    return new Promise((resolve, reject) => {
      const child = spawn(`"${this.WINRAR_PATH}"`, args, { shell: true });
      const output = [];
      const errorOutput = [];

      child.stdout.on('data', (data) => {
        const line = data.toString();
        output.push(line);
        if (this.verbose) process.stdout.write(line);
      });

      child.stderr.on('data', (data) => {
        const line = data.toString();
        errorOutput.push(line);
        if (this.verbose) process.stderr.write(line);
      });

      child.on('close', (code) => {
        resolve({ output: output.join('').trim(), code, error: errorOutput.join('').trim() });
      });

      child.on('error', (error) => {
        reject({ code: -1, message: `Failed to start WinRAR process: ${error.message}` });
      });

      // 检查信号中断
      signal?.addEventListener('abort', () => {
        child.kill('SIGTERM');
        reject({ code: -1, message: 'Process aborted.' });
      });
    });
  }

  // 根据退出代码解释错误信息
  _interpretExitCode(exitCode) {
    const exitMessages = {
      0: 'Successful operation.',
      1: 'Non-fatal error(s) occurred.',
      2: 'A fatal error occurred.',
      3: 'Invalid checksum. Data is damaged.',
      4: 'Attempt to modify an archive locked by "k" command.',
      5: 'Write error.',
      6: 'File open error.',
      7: 'Wrong command line option.',
      8: 'Not enough memory.',
      9: 'File create error.',
      10: 'No files matching the specified mask and options were found.',
      11: 'Wrong password.',
      12: 'Read error.',
      13: 'Bad archive.',
      255: 'User stopped the process.'
    };
    return exitMessages[exitCode] || 'Unknown error.';
  }

  // 通用命令逻辑处理
  async _handleCommand(args, signal, parser = null) {
    const { output, code, error } = await this._runCommand(['-idc', '-scf', ...args], signal);
    const exitMessage = this._interpretExitCode(code);
    const isOK = code === 0;
    const result = parser ? parser(output) : {};
    if (!isOK) {
      return { isOK, code, message: exitMessage, output, error };
    }
    return { isOK, code, message: exitMessage, ...result, output };
  }

  // 添加文件到压缩包
  async add(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${file}"`);
    const args = ['a', '-r', ...(password ? [`-p"${password}"`] : []), options, `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 解压文件到指定目录
  async extract(archivePath, outputDir, options = '', password = '', fullPaths = true, signal) {
    const args = [fullPaths ? 'x' : 'e', ...(password ? [`-p"${password}"`] : []), options, `"${archivePath}"`, (outputDir ? `-o"${outputDir}"` : '')];
    return this._handleCommand(args, signal);
  }

  // 测试压缩包完整性
  async test(archivePath, options = '', password = '', signal) {
    const args = ['t', ...(password ? [`-p"${password}"`] : []), options, `"${archivePath}"`];
    return this._handleCommand(args, signal);
  }

  // 列出压缩包内容
  async list(archivePath, detailed = false, options = '', password = '', signal) {
    const args = [detailed ? 'lt' : 'l', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`];
    return this._handleCommand(args, signal, (output) => this._parseListOutput(output, detailed));
  }

  _parseListOutput(output, detailed) {
    const lines = output.split(os.EOL);
    const files = [];
    let archiveInfo = {};
    let currentFile = {};

    if (detailed) {
      lines.forEach((line) => {
        line = line.trim();
        for (const key in this.languageMap) {
          if (line.startsWith(this.languageMap[key])) {
            const value = line.split(this.languageMap[key])[1].trim();
            if (key === 'Name') {
              if (Object.keys(currentFile).length) {
                files.push(currentFile);
              }
              currentFile = {};
            } else if (key === 'Type') {
              if (value === this.languageMap['Directory']) {
                currentFile[key] = true;
              } else {
                currentFile[key] = false;
              }
            } else if (key === 'Modified') {
              try {
                currentFile[key] = new Date(value.replace(',', '.'));
              } catch {
                currentFile[key] = null;
              }
            } else if (key === 'Encrypted') {
              if (value === this.languageMap['Encrtyped']) {
                currentFile[key] = true;
              } else {
                currentFile[key] = false;
              }
            } else {
              currentFile[key] = isNaN(parseInt(value)) ? value : parseInt(value, 10);
            }
          }
        }
      });
      if (Object.keys(currentFile).length) {
        files.push(currentFile);
      }
    } else {
      const regexPattern = new RegExp(`^(.{11})\\s+(\\d+)\\s+(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2})\\s+(.*)$`);
      lines.forEach((line) => {
        const match = line.match(regexPattern);
        if (match) {
          files.push({
            Attributes: match[1].replace('*', '').trim(),
            Size: match[2] ? parseInt(match[2], 10) : null,
            Date: match[3],
            Time: match[4],
            Name: match[5].trim(),
            Modified: (match[3] && match[4]) ? new Date(`${match[3]} ${match[4]}`) : null,
            Folder: match[1].includes('D'),
            Encrtyped: match[1].includes('*'),
          });
        }
      });
    }

    if (lines.length > 0) {
      const header = lines[0];
      if (header.includes(languageMap['Archive'])) {
        archiveInfo.archive = header.split(languageMap['Archive'])[1].split(os.EOL)[0].trim();
      }
      if (header.includes(languageMap['Details'])) {
        archiveInfo.details = header.split(languageMap['Details'])[1].split(os.EOL)[0].trim();
      }
    }

    return { archiveInfo, files };
  }

  // 删除压缩包中的文件
  async delete(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${file}"`);
    const args = ['d', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 更新压缩包内容
  async update(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${file}"`);
    const args = ['u', '-r', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 重命名压缩包内的文件
  async rename(archivePath, oldName, newName, options = '', password = '', signal) {
    const args = ['rn', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, `"${oldName}"`, `"${newName}"`];
    return this._handleCommand(args, signal);
  }

  // 添加恢复记录
  async addRecoveryRecord(archivePath, percentage = 3, options = '', signal) {
    const args = ['rr', `${percentage}`, options, `"${archivePath}"`];
    return this._handleCommand(args, signal);
  }

  // 修复压缩包
  async repair(archivePath, outputDir = '', options = '', signal) {
    const args = ['r', options, `"${archivePath}"`, ...(outputDir ? [outputDir] : [])];
    return this._handleCommand(args, signal);
  }

  // 转换压缩包为自解压格式
  async createSelfExtracting(archivePath, sfxModule = '', options = '', signal) {
    const args = ['s', `${sfxModule}`, options, `"${archivePath}"`];
    return this._handleCommand(args, signal);
  }

  // 锁定压缩包
  async lock(archivePath, signal) {
    const args = ['k', `"${archivePath}"`];
    return this._handleCommand(args, signal);
  }

  // 自定义命令
  async customCommand(command, options = '', signal) {
    const args = [command, options];
    return this._handleCommand(args, signal);
  }

  // 显示版本信息
  async info(signal) {
    const args = ['iver'];
    return this._handleCommand(args, signal);
  }

  // 检查是否密码保护
  async isPasswordProtected(archivePath, signal) {
    const { output } = await this.list(archivePath, true, '', signal);
    return output.includes('Encrypted = +');
  }

  // 检查密码是否错误
  async isPasswordWrong(archivePath, password, signal) {
    try {
      const args = ['t', ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`];
      const { code } = await this._runCommand(args, signal);
      return code === 11; // Exit code `11` 是密码错误
    } catch {
      return false;
    }
  }
}

module.exports = WinRAR;