const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 定义支持的编码格式
const supportedVideoCodecs = ['h264', 'h263', 'mpeg1video', 'mpeg2video', 'theora', 'av1', 'vp8', 'vp9']; // 支持的浏览器视频编码
const supportedAudioCodecs = ['aac', 'alac', 'amr_nb', 'amr_wb', ' flac', 'pcm_alaw', 'pcm_mulaw', 'adpcm_g722', 'mp3', 'opus', 'vorbis']; // 支持的浏览器音频编码

class FFmpeg {
  constructor(ffmpegPath = null, verbose = false, ffprobePath = null) {
    this.FFMPEG_PATH = ffmpegPath || this._getDefaultFFmpegPath();
    this.FFPROBE_PATH = ffprobePath || this._getDefaultFFprobePath(); // 初始化 FFprobe 路径
    this.verbose = verbose; // 控制是否输出到屏幕

    if (!fs.existsSync(this.FFMPEG_PATH)) {
      throw new Error(`FFmpeg executable not found at ${this.FFMPEG_PATH}. Please set the correct path.`);
    }
  
    if (!fs.existsSync(this.FFPROBE_PATH)) {
      throw new Error(`FFprobe executable not found at ${this.FFPROBE_PATH}. Please set the correct path.`);
    }
  }

  // 自动获取系统默认路径
  _getDefaultFFmpegPath() {
    if (os.platform() === 'win32') return 'C:\\ffmpeg\\bin\\ffmpeg.exe';
    if (os.platform() === 'linux') return '/usr/bin/ffmpeg';
    if (os.platform() === 'darwin') return '/usr/local/bin/ffmpeg';
    throw new Error('Unsupported operating system');
  }

  // 自动获取系统默认 FFprobe 路径
  _getDefaultFFprobePath() {
    return this.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'); // 替换最后的 ffmpeg 或 ffmpeg.exe
  }

  // 简化统一处理输入输出同为文件的处理函数
  _handleCommandFromFileToFile(args, verbose = this.verbose) {
    return new Promise((resolve, reject) => {
      if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

      const child = spawn(this.FFMPEG_PATH, args, {
        stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
      });

      // 监听 FFmpeg 的 stdout 输出，用于获取转码进度
      child.stdout.on('data', (data) => {
        if (verbose) console.log(data.toString());
      });

      child.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      // 处理 FFmpeg 进程结束
      child.on('close', (code) => {
        if (verbose && code === 0) {
          console.log(`FFmpeg process exited with code ${code}`);
        }
        if (code === 0) {
          resolve(`FFmpeg process exited with code ${code}`);
        } else {
          reject(`FFmpeg process exited with code ${code}`);
        }
      });
    });
  }

  // 转换图片流为 WebP 图片流
  convertStreamToWebpStream(inputStream, maxWidth, maxHeight, verbose = this.verbose) {
    const args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-i', 'pipe:0', // 从标准输入读取数据
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-c:v', 'libwebp_anim',
        '-loop', '0', // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-quality', '80', // 设置输出质量
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      'pipe:1' // 将输出直接发送到标准输出
    ]);
    if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

    const child = spawn(this.FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
    });

    // 将输入流通过管道传递给 FFmpeg
    inputStream.pipe(child.stdin);

    // 处理输出
    child.stdout.on('data', (data) => {
      if (verbose) console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    /*child.on('close', (code) => {
      if (!inputStream.closed) {
        inputStream.destroy();
      }
    });*/

    return child.stdout; // 返回输出流
  }

  // 转换图片文件为 WebP 图片流
  convertFileToWebpStream(filePath, maxWidth, maxHeight, verbose = this.verbose) {
    const args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-i', filePath,
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-c:v', 'libwebp_anim',
        '-loop', '0', // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-quality', '80', // 设置输出质量
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      'pipe:1' // 将输出直接发送到标准输出
    ]);
    if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

    const child = spawn(this.FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
    });

    // 处理输出
    child.stdout.on('data', (data) => {
      if (verbose) console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    return child.stdout; // 返回输出流
  }

  // 转换图片文件为 WebP 图片文件
  convertFileToWebpFile(filePath, outputPath, animated = false, maxWidth, maxHeight, verbose = this.verbose) {
    let args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-i', filePath,
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-c:v', 'libwebp_anim',
        '-loop', '0', // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-quality', '80', // 设置输出质量
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      '-y',
      outputPath
    ]);

    return this._handleCommandFromFileToFile(args, verbose);
  }

  // 从视频中截取一帧，返回输出流
  captureFrameFromStreamToStream(inputStream, time = 0, animated = false, maxWidth = 512, maxHeight = 512, verbose = this.verbose) {
    const args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-ss', time, // 指定截取的时间点
      '-i', 'pipe:0', // 从标准输入读取数据
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-r', '12', // 帧率
        '-c:v', 'libwebp_anim',
        '-loop', '0' // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      'pipe:1' // 将输出直接发送到标准输出
    ]);
    if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

    const child = spawn(this.FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
    });

    // 将输入流通过管道传递给 FFmpeg
    inputStream.pipe(child.stdin);

    // 处理输出
    child.stdout.on('data', (data) => {
      if (verbose) console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    /*child.on('close', (code) => {
      if (!inputStream.closed) inputStream.destroy();
    });*/

    return child.stdout; // 返回输出流
  }

  // 截取视频，返回输出流
  captureFrameFromFileToStream(filePath, time = 0, animated = false, maxWidth = 512, maxHeight = 512, verbose = this.verbose) {
    let args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-ss', time, // 指定截取的时间点
      '-i', filePath,
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease,fps=12`
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-r', '12', // 帧率
        '-c:v', 'libwebp_anim',
        '-loop', '0' // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-quality', '80', // 设置输出质量
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      'pipe:1' // 将输出直接发送到标准输出
    ]);
    if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

    const child = spawn(this.FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
    });

    // 处理输出
    child.stdout.on('data', (data) => {
      if (verbose) console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    return child.stdout; // 返回输出流
  }

  // 截取视频，输出文件
  captureFrameFromFileToFile(filePath, outputPath, time = 0, animated = false, maxWidth = 512, maxHeight = 512, verbose = this.verbose) {
    let args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-ss', time, // 指定截取的时间点
      '-i', filePath,
      '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease,fps=12`
    ];
    if (animated) {
      args = args.concat([
        '-t', '5', // 截取时长
        '-r', '12', // 帧率
        '-c:v', 'libwebp_anim',
        '-loop', '0' // 设置循环，0表示无限循环
      ]);
    } else {
      args = args.concat([
        '-vframes', '1', // 只截取一帧
        '-c:v', 'libwebp',
      ]);
    }
    args = args.concat([
      '-f', 'webp',
      '-pix_fmt', 'yuva420p', // 确保支持透明度
      '-y',
      outputPath // 将输出到指定路径
    ]);

    return this._handleCommandFromFileToFile(args, verbose);
  }

  // 获取视频信息
  getMediaInfoFromStream(inputStream, all = false, streams = [], formats = [], verbose = this.verbose) {
    return new Promise((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-v', verbose ? 'info' : 'error'
      ];
      if(all) {
        args.push('-show_format');
        args.push('-show_streams');
      } else {
        args.push('-show_entries');
        const entries = [];
        if (streams.length > 0) {
          entries.push(`stream=codec_type,${streams.filter(v => v !== 'codec_type').join(',')}`); // codec_name, codec_type, width, height
        }
        if (formats.length > 0) {
          entries.push(`format=${formats.join(',')}`); // format_name, duration
        }
        args.push(entries.join(':'));
      }
      args.push('-of');
      args.push('json');
      args.push('pipe:0');
      if (verbose) console.log(this.FFPROBE_PATH, args);

      const child = spawn(this.FFPROBE_PATH, args); // 这里使用 args

      // 将输入流通过管道传递给 FFmpeg
      inputStream.pipe(child.stdin);

      let output = '';

      child.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
        if (verbose) console.log(data.toString()); // 根据 verbose 控制 stdout 输出
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe exited with code ${code}`));
        } else {
          const res = JSON.parse(output.trim());
          resolve(res);
        }
      });
    });
  }

  // 获取视频信息
  getMediaInfoFromFile(filePath, all = false, streams = [], formats = [], verbose = this.verbose) {
    return new Promise((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-v', verbose ? 'info' : 'error'
      ];
      if (all) {
        args.push('-show_format');
        args.push('-show_streams');
      } else {
        args.push('-show_entries');
        const entries = [];
        if (streams.length > 0) {
          entries.push(`stream_tags:stream=codec_type,${streams.filter(v => v !== 'codec_type').join(',')}`); // codec_name, codec_type, width, height, stream_tags
        }
        if (formats.length > 0) {
          entries.push(`format=${formats.join(',')}`); // format_name, duration
        }
        args.push(entries.join(':'));
      }
      args.push('-of');
      args.push('json');
      args.push(filePath);
      if (verbose) console.log(this.FFPROBE_PATH, args);

      const child = spawn(this.FFPROBE_PATH, args);

      let output = '';
      child.stderr.on('data', (data) => {
        if (verbose) {
          console.error(data.toString());
        }
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
        if (verbose) {
          console.log(data.toString()); // 根据 verbose 控制 stdout 输出
        }
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe exited with code ${code}`));
        } else {
          const res = JSON.parse(output.trim());
          resolve(res);
        }
      });
    });
  }

  vendorEncoderMapping = {
    'intel': 'h264_qsv',
    'nvidia': 'h264_nvenc',
  };

  createSegmentToFile(filePath, outputDir, segmentIndex = 0, segmentFileName, maxWidth = 1280, maxHeight = 1280, fps = 24, duration = 6, streams = ['video', 'audio'], trackIndex = 0, enableHwaccel = false, hwaccelVendor = 'intel', hwaccelDevice, signal, verbose = this.verbose) {
    return new Promise((resolve, reject) => {
      const startTime = segmentIndex * duration;
      const outputSegmentPath = path.join(outputDir, segmentFileName);
      const tmpOutputSegmentPath = `${outputSegmentPath}.tmp`;
      // const outputM3u8Path = path.join(outputDir, `segment${segmentIndex.toString().padStart(4, '0')}.m3u8`);

      let args = [
        '-hide_banner',
        '-v', verbose ? 'info' : 'error',
      ];
      if (streams.includes('video') && enableHwaccel) {
        if (hwaccelVendor === 'nvidia') {
          args = args.concat([
            '-hwaccel', 'cuda',
            '-hwaccel_output_format', 'cuda',
            // '-c:v', 'h264_cuvid'
          ]);
          //if (hwaccelDevice) {
          //  args = args.concat([
          //    '-hwaccel_device', hwaccelDevice
          //  ]);
          //}
        } else if (hwaccelVendor === 'intel') {
          args = args.concat([
            '-hwaccel', 'qsv'
            // '-async_depth', '4', // (1 ~ INT_MAX. default '4') Internal parallelization depth, the higher the value the higher the latency.
            // '-gpu_copy', 'on' // default - 0, on - 1, off - 2. A GPU-accelerated copy between video and system memory.
          ]);
        }
      }
      args = args.concat([
        '-i', filePath,
        '-ss', startTime.toString(),
        '-t', duration.toString()
      ]);
      if (streams.includes('video') || streams.includes('audio')) {
        args = args.concat(['-output_ts_offset', startTime.toString()]);
      }
      if (streams.includes('video')) {
        args = args.concat(['-map', '0:v']);
      }
      if (streams.includes('audio')) {
        args = args.concat(['-map', `0:a:${trackIndex}`]);
      }
      if (streams.includes('subtitle')) {
        args = args.concat(['-map', `0:s:${trackIndex}`]);
      }
      if (streams.includes('video')) {
        if (enableHwaccel && (hwaccelVendor === 'nvidia')) {
          // use 'ffmpeg -h encoder=h264_nvenc' to list all parameters for this encoder
          const videoFilterScale = `scale_cuda=${(maxWidth > 0) && (maxHeight > 0) ? `'min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:` : ''}format=yuv420p`;
          // const videoFilterScale = (maxWidth > 0) && (maxHeight > 0) ? `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p` : 'format=yuv420p';
          args = args.concat([
            // '-init_hw_device', `cuda${hwaccelDevice ? `:${hwaccelDevice}` : ''}`,
            '-vf', videoFilterScale,
            '-c:v', 'h264_nvenc',
            '-gpu', hwaccelDevice || '-1', // (-1 ~ INT_MAX) -1: any, -2: list all
            '-preset', 'p4', // default, slow, medium, fast, hp, hq, bd, ll, llhq, llhp, lossless, losslesshp, p1, p2, p3, p4, p5, p6
            '-tune', 'hq', // hq, ll, ull, lossless
            '-r:v', fps.toString(),
            // '-pix_fmt', 'yuv420p',
            '-g', (fps * duration).toString(),
            '-profile:v', 'main', // baseline, main, high, high444p
          ]);
        } else if (enableHwaccel && (hwaccelVendor === 'intel')) {
          // use 'ffmpeg -h encoder=h264_qsv' to list all parameters for this encoder
          const videoFilterScale = (maxWidth > 0) && (maxHeight > 0) ? `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,` : '';
          args = args.concat([
            '-init_hw_device', `qsv${hwaccelDevice ? `:${hwaccelDevice}` : ''}`,
            '-vf', `${videoFilterScale}format=yuv420p,fps=${fps}`,
            '-c:v', 'h264_nvenc',
            '-gpu', hwaccelDevice || '-1', // (-1 ~ INT_MAX) -1: any, -2: list all
            '-preset', 'fast', // default - 0, veryslow - 1, slower - 2, slow - 3, medium - 4, fast - 5, faster - 6, veryfast - 7
            '-scenario', 'livestreaming', // default unknown - 0, displayremoting - 1, videoconference - 2, archive - 3, livestreaming - 4, cameracapture - 5, videosurveillance - 6, gamestreaming - 7, remotegaming - 8
            '-framerate', fps.toString(),
            '-r:v', fps.toString(),
            '-g', (fps * duration).toString(),
            '-gop_size', (fps * duration).toString(),
            '-pix_fmt', 'yuv420p',
            '-profile:v', 'main', // default unkown - 0, baseline - 66, main - 77, high - 100
            '-level', '3.1',
          ]);
        } else {
          const videoFilterScale = (maxWidth > 0) && (maxHeight > 0) ? `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,` : '';
          args = args.concat([
            '-vf', `${videoFilterScale}format=yuv420p,fps=${fps}`, // 添加视频缩放
            //'-r', fps.toString(),
            '-c:v', 'libx264', // av1_nvenc, h264_nvenc, hevc_nvenc, av1_qsv, h264_qsv, hevc_qsv, av1_amf, h264_amf, hevc_amf
            '-preset', 'ultrafast', // ultrafast, superfast, veryfast, faster, fast, medium (default), slower, veryslow, placebo.
            '-crf', '23', // 0 - 51, 数值越低质量越高
            '-g', (fps * duration).toString(),
            '-pix_fmt', 'yuv420p',
            '-r:v', fps.toString(),
            '-profile:v', 'main', // baseline, main, high, high10
            '-level', '3.1'
          ]);
        }
      } else {
        args.push('-vn');
      }
      if (streams.includes('audio')) {
        args = args.concat([
          '-c:a', 'aac', // 指定音频编码格式为 AAC
          '-ac', '2', // 设置音频输出为双声道
          '-ar', '44100', // 设置音频采样率为 44100 Hz
          '-b:a', '128k', // 设置音频码率为 128 kbps
          '-profile:a', 'aac_low' // Low Complexity Profile (AAC-LC)
        ]);
      } else {
        args.push('-an');
      }
      if (streams.includes('subtitle')) {
        args = args.concat([
          '-c:s', 'webvtt'
        ]);
      }
      if (streams.includes('video') || streams.includes('audio')) {
        args = args.concat([
          '-movflags', '+faststart',
          '-f', 'mpegts',
        ]);
      } else if ((streams.length === 1) && streams.includes('subtitle')) {
        args = args.concat([
          '-f', 'webvtt'
        ]);
      }
      args = args.concat([
        '-y',
        tmpOutputSegmentPath
      ]);

      if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

      const child = spawn(this.FFMPEG_PATH, args, {
        stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
      });

      // 监听 FFmpeg 的 stdout 输出，用于获取转码进度
      child.stdout.on('data', (data) => {
        if (verbose) console.log(data.toString());
      });

      child.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      // 处理 FFmpeg 进程结束
      child.on('close', (code) => {
        if (verbose && code === 0) {
          console.log(`FFmpeg process exited with code ${code}`);
        }
        if (code === 0) {
          if (fs.existsSync(tmpOutputSegmentPath) && fs.statSync(tmpOutputSegmentPath).isFile()) {
            fs.renameSync(tmpOutputSegmentPath, outputSegmentPath);
          }
          resolve(`FFmpeg process exited with code ${code}`);
        } else {
          if (fs.existsSync(tmpOutputSegmentPath) && fs.statSync(tmpOutputSegmentPath).isFile()) {
            fs.rmSync(tmpOutputSegmentPath, { force: true });
          }
          reject(`FFmpeg process exited with code ${code}`);
        }
      });

      // 监听中断
      signal.addEventListener('abort', () => {
        /*if (child.stdin) {
          child.stdin.write('q' + os.EOL); // 发送 'q' 指令以优雅终止 FFmpeg
          child.stdin.end(); // 关闭输入流
        }*/
        child.kill();
        reject('AbortError');
      });
    });
  }

  createSegmentToStream(filePath, segmentIndex = 0, maxWidth = 1280, maxHeight = 1280, fps = 24, duration = 6, streams = ['video', 'audio'], trackIndex = 0, signal, verbose = this.verbose) {
    const startTime = segmentIndex * duration;
    const videoFilterScale = (maxWidth > 0) && (maxHeight > 0) ? `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,` : '';

    let args = [
      '-hide_banner',
      '-v', verbose ? 'info' : 'error',
      '-i', filePath,
      '-ss', startTime.toString(),
      '-t', duration.toString()
    ];
    if (streams.includes('video') || streams.includes('audio')) {
      args = args.concat(['-output_ts_offset', startTime.toString()]);
    }
    if (streams.includes('video')) {
      args = args.concat(['-map', '0:v']);
    }
    if (streams.includes('audio')) {
      args = args.concat(['-map', `0:a:${trackIndex}`]);
    }
    if (streams.includes('subtitle')) {
      args = args.concat(['-map', `0:s:${trackIndex}`]);
    }
    if (streams.includes('video')) {
      args = args.concat([
        '-vf', `${videoFilterScale}fps=${fps}`, // 添加视频缩放
        //'-r', fps.toString(),
        '-c:v', 'libx264', // av1_nvenc, h264_nvenc, hevc_nvenc, av1_qsv, h264_qsv, hevc_qsv, av1_amf, h264_amf, hevc_amf
        '-preset', 'ultrafast', // ultrafast, superfast, veryfast, faster, fast, medium (default), slower, veryslow, placebo.
        '-crf', '23', // 0 - 51, 数值越低质量越高
        '-g', (fps * duration).toString(),
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'main', // baseline, main, high, high10
        '-level', '3.1'
      ]);
    } else {
      args.push('-vn');
    }
    if (streams.includes('audio')) {
      args = args.concat([
        '-c:a', 'aac', // 指定音频编码格式为 AAC
        '-ac', '2', // 设置音频输出为双声道
        '-ar', '44100', // 设置音频采样率为 44100 Hz
        '-b:a', '128k', // 设置音频码率为 128 kbps
        '-profile:a', 'aac_low' // Low Complexity Profile (AAC-LC)
      ]);
    } else {
      args.push('-an');
    }
    if (streams.includes('subtitle')) {
      args = args.concat([
        '-c:s', 'webvtt'
      ]);
    }
    if (streams.includes('video') || streams.includes('audio')) {
      args = args.concat([
        '-movflags', '+faststart',
        '-f', 'mpegts',
      ]);
    } else if ((streams.length === 1) && streams.includes('subtitle')) {
      args = args.concat([
        '-f', 'webvtt'
      ]);
    }
    args.push('pipe:1');

    if (verbose) console.log(this.FFMPEG_PATH, args.map(arg => arg.includes('=') ? `"${arg}"` : arg).join(' '));

    const child = spawn(this.FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'] // 确保使用 pipe 处理输入
    });

    // 监听 FFmpeg 的 stdout 输出，用于获取转码进度
    child.stdout.on('data', (data) => {
      if (verbose) console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    // 监听中断
    signal.addEventListener('abort', () => {
      /*if (child.stdin) {
        child.stdin.write('q' + os.EOL); // 发送 'q' 指令以优雅终止 FFmpeg
        child.stdin.end(); // 关闭输入流
      }*/
      child.kill();
    });
  
    return child.stdout; // 返回输出流

  }
}

module.exports = FFmpeg;
