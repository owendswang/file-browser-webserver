const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class SevenZip {
  constructor(sevenZipPath = null, verbose = false) {
    this.SEVEN_ZIP_PATH = sevenZipPath || this._getDefaultSevenZipPath();
    this.verbose = verbose; // 控制是否输出到屏幕

    if (!fs.existsSync(this.SEVEN_ZIP_PATH)) {
      throw new Error(`7zip executable not found at ${this.SEVEN_ZIP_PATH}. Please set the correct path.`);
    }
  }

  // 自动获取系统默认路径
  _getDefaultSevenZipPath() {
    if (os.platform() === 'win32') return 'C:\\Program Files\\7-Zip\\7z.exe';
    if (os.platform() === 'linux') return '/usr/bin/7zz';
    if (os.platform() === 'darwin') return '/usr/local/bin/7zz';
    throw new Error('Unsupported operating system');
  }

  // 执行命令并统一处理输出和错误
  _runCommandWithProgress(args, signal) {
    return new Promise((resolve, reject) => {
      if (this.verbose) console.log(`"${this.SEVEN_ZIP_PATH}" ${args.join(' ')}`);

      const child = spawn(`"${this.SEVEN_ZIP_PATH}"`, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const output = [];
      const errorOutput = [];

      // 监听标准输出
      child.stdout.on('data', (data) => {
        const line = data.toString();
        output.push(line);
        if (this.verbose) console.log(line);
        if (line.includes('Enter password')) {
          child.stdin.write('\n');
        }
      });

      // 监听标准错误输出
      child.stderr.on('data', (data) => {
        const line = data.toString();
        errorOutput.push(line);
        if (this.verbose) console.error(line);
      });

      // 子进程关闭时返回结果
      child.on('close', (code) => {
        const finalOutput = output.join('').trim();
        const finalErrorOutput = errorOutput.join('').trim();

        if (code === 0) {
          resolve(finalOutput);
        } else {
          reject({ code, message: `7zip process exited with code ${code}: ${finalErrorOutput}` });
        }
      });

      child.on('error', (error) => {
        reject({ code: -1, message: `Failed to start 7zip process: ${error.message}` });
      });

      // 检查请求是否被中断
      signal.addEventListener('abort', () => {
        child.kill('SIGTERM'); // 发送 SIGTERM 信号以中止子进程
        // reject(new Error('AbortError'));
        reject('AbortError');
      });
    });
  }

  // 统一处理命令执行逻辑
  async _handleCommand(args, signal, parser = null, forceOK = false) {
    try {
      const output = await this._runCommandWithProgress(args, signal);
      const isOK = forceOK ? true : output.includes('Everything is Ok'); // 根据 forceOK 参数设置默认状态
      const result = parser ? parser(output) : {};
      return { isOK, ...result, output };
    } catch (error) {
      console.error(error);
      return { isOK: false, exitCode: error.code, error: error.message };
    }
  }
  
  // 1. 添加文件到压缩包
  async add(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${path.resolve(file)}"`);
    const args = ['a', options, '-ssp', ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 2. 解压文件到指定目录
  async extract(archivePath, outputDir, options = '', password = '', fullPaths = true, signal) {
    const args = [fullPaths ? 'x' : 'e', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, (outputDir ? `"-o${outputDir}"` : ''), '-y'];
    return this._handleCommand(args, signal);
  }

  extractStream(archivePath, options = '', password = '', signal) {
    const args = ['e', options, `-p"${password}"`, `"${archivePath}"`, '-sccUTF-8', '-so'];

    const child = spawn(`"${this.SEVEN_ZIP_PATH}"`, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

    // 监听标准输出
    child.stdout.on('data', (data) => {
      const line = data.toString();
      if (this.verbose) console.log(line);
    });

    // 监听标准错误输出
    child.stderr.on('data', (data) => {
      const line = data.toString();
      console.error(line);
    });

    // 子进程关闭时返回结果
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`7zip process exited with code ${code}`);
      }
    });

    child.on('error', (error) => {
      console.error(`Failed to start 7zip process: ${error.message}`);
    });

    // 检查请求是否被中断
    signal.addEventListener('abort', () => {
      child.kill('SIGTERM'); // 发送 SIGTERM 信号以中止子进程
      console.error('AbortError');
    });

    return child.stdout; // 返回输出流
  }

  // 3. 列出压缩包内容
  async list(archivePath, detailed = false, options = '', password = '', signal) {
    const args = ['l', options, ...(password ? [`-p"${password}"`] : []), detailed ? '-slt' : '', `-sccUTF-8`, `"${archivePath}"`];
    return this._handleCommand(args, signal, (output) => this._parseListOutput(output, detailed), true);
  }

  _parseListOutput(output, detailed) {
    const lines = output.split(os.EOL);
    const archiveInfo = {};
    const files = [];
    let currentFile = null;

    const archiveRegex = /^(Path|Type|Physical Size|Headers Size|Method|Solid|Blocks)\s*=\s*(.+)$/;
    const attributeRegex = /^(Size|Packed Size|Modified|Attributes|CRC|Encrypted|Method|Block|Folder)\s*=\s*(.*)$/;
    const fileLineRegex = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s+([DRHSA.\s]+)\s+(\d*)\s*(\d*)\s+(.+)$/;

    let inFileSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('----------')) {
        inFileSection = !inFileSection;
        continue;
      }

      if (!inFileSection) {
        const archiveMatch = archiveRegex.exec(trimmed);
        if (archiveMatch) {
          archiveInfo[archiveMatch[1]] = archiveMatch[2];
        }
      } else if (detailed) {
        if (trimmed.startsWith('Path =')) {
          if (currentFile) files.push(currentFile);
          currentFile = { Path: trimmed.split('=')[1].trim() };
        } else {
          const attrMatch = attributeRegex.exec(trimmed);
          if (attrMatch && currentFile) {
            const key = attrMatch[1];
            let value = attrMatch[2] || null;
            if (['Encrypted', 'Folder'].includes(key)) {
              if (value === '-') {
                value = false;
              }
              if (value === '+') {
                value = true;
              }
            }
            if (['Modified', 'Created', 'Accessed'].includes(key)) {
              try {
                value = new Date(value);
              } catch {
                value = null;
              }
            }
            if (['Size', 'Packed Size'].includes(key)) {
              try {
                value = parseInt(value);
              } catch {
                value = null;
              }
            }
            if (key === 'Attributes') {
              if (currentFile['Folder'] === undefined) {
                if (value.includes('D')) {
                  currentFile['Folder'] = true;
                } else {
                  currentFile['Folder'] = false;
                }
              }
            }
            currentFile[key] = value;
          }
        }
      } else {
        const fileMatch = fileLineRegex.exec(trimmed);
        if (fileMatch) {
          files.push({
            Date: fileMatch[1],
            Time: fileMatch[2],
            Attributes: fileMatch[3].trim(),
            Size: fileMatch[4] ? parseInt(fileMatch[4], 10) : null,
            CompressedSize: fileMatch[5] ? parseInt(fileMatch[5], 10) : null,
            Name: fileMatch[6].trim(),
            Modified: (fileMatch[1] && fileMatch[2]) ? new Date(`${fileMatch[1]} ${fileMatch[2]}`) : null,
            Folder: fileMatch[3].trim().startsWith('D'),
          });
        }
      }
    }

    if (currentFile) files.push(currentFile);
    return { archiveInfo, files };
  }

  // 4. 计算文件哈希值
  async hash(filePath, hashType = '*', options = '', signal) {
    const args = ['h', options, `-scrc${hashType}`, `"${filePath}"`];
    return this._handleCommand(args, signal, this._parseHashOutput.bind(this));
  }

  _parseHashOutput(output) {
    const lines = output.split(os.EOL);
    const hashValues = {};
    const hashRegex = /^([A-Z0-9-]+)\s+for data:\s+([a-fA-F0-9]+)$/;

    for (const line of lines) {
      const match = hashRegex.exec(line.trim());
      if (match) hashValues[match[1]] = match[2];
    }

    return { hashes: hashValues };
  }

  // 5. 测试压缩包完整性
  async test(archivePath, options = '', password = '', signal) {
    const args = ['t', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`];
    return this._handleCommand(args, signal);
  }

  // 6. 删除压缩包中的文件
  async delete(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${file}"`);
    const args = ['d', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 7. 更新压缩包内容
  async update(archivePath, files, options = '', password = '', signal) {
    const fileList = files.map(file => `"${file}"`);
    const args = ['u', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, ...fileList];
    return this._handleCommand(args, signal);
  }

  // 8. 重命名压缩包内的文件
  async rename(archivePath, oldName, newName, options = '', password = '', signal) {
    const args = ['rn', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`, `"${oldName}"`, `"${newName}"`];
    return this._handleCommand(args, signal);
  }

  // 9. 自定义命令执行
  async customCommand(command, options = '', signal) {
    const args = [command, options];
    return this._handleCommand(args, signal, null, true);
  }

  // 10. 显示支持的格式信息
  async info(signal) {
    const args = ['i'];
    return this._handleCommand(args, signal, null, true);
  }

  // 检查压缩包密码是否错误
  async isPasswordWrong(archivePath, options = '', password = '', signal) {
    try {
      const args = ['t', options, ...(password ? [`-p"${password}"`] : []), `"${archivePath}"`];
      await this._runCommandWithProgress(args, signal);
    } catch (error) {
      // 如果由于密码错误导致的错误，则返回true
      if (error.message.includes('Wrong password') || error.message.includes('could not open the file as archive')) {
        return true; // 密码错误
      }
      return false; // 其他错误处理
    }
  }

  // 检查压缩包是否被密码保护
  async isPasswordProtected(archivePath, signal) {
    try {
      const args = ['l', '-slt', `-p`, `"${archivePath}"`];
      const output = await this._runCommandWithProgress(args, signal);
      return output.includes('Encrypted = +');
    } catch (error) {
      // 如果由于需要密码导致的错误，则返回true
      if (error.message.includes('Wrong password') || error.message.includes('could not open the file as archive')) {
        return true; // 压缩包需要密码
      }
      return false; // 其他错误处理
    }
  }
}

module.exports = SevenZip;
