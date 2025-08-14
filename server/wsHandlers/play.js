const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils//7zip');
const FFmpeg = require('@/utils/ffmpeg');
const { isArchive } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');
const thumbnails = require('@/utils/thumbnails');
const sessionMap = require('@/transcodeSessionMap');

const resolutionMap = {
  144: 256,
  270: 480,
  360: 640,
  540: 960,
  720: 1280,
  1080: 1920,
  2160: 3840,
  4320: 7680
}

const play = (ws, req) => {
  const {
    sevenZipPath,
    ffmpegPath,
    basePaths,
    previewCachePath,
    tempDir,
    playVideoSegmentTargetDuration,
    enablePlayVideoHardwareAcceleration,
    playVideoHardwareAccelerationVendor,
    playVideoHardwareAccelerationDevice
  } = getConfig();

  const abortController = new AbortController();
  const { signal } = abortController;

  const sessionId = randomBytes(16).toString('hex');
  const playDir = path.join(tempDir, sessionId);
  fs.mkdirSync(playDir, { recursive: true });
  sessionMap[sessionId] = {
    srcUrl: `/play/${sessionId}/index.m3u8`,
    audioStreams: [],
    subtitleStreams: [],
    resolutions: []
  };
  const session = sessionMap[sessionId];
  const audioStreams = session['audioStreams'];
  const subtitleStreams = session['subtitleStreams'];
  const resolutions = session['resolutions'];

  ws.on('error', console.error);

  ws.send(JSON.stringify({ debug: '欢迎来到 play WS' }, null, 4));

  ws.on('message', async function message(msg) {
    console.log(`received: \n${msg}`);
    const data = JSON.parse(msg);

    const ffmpeg = new FFmpeg(ffmpegPath);

    const ffmpegProgressCallback = (ffmpegOutput) => {
      const progressRegex = /frame=\s*(\d+)\s+fps=\s*([\d.]+)\s+q=([\d.]+)\s+size=.*?time=([\d:.]+)\s+bitrate=.*?speed=([\d.]+)x/;
      let match = ffmpegOutput.match(progressRegex);
      if (match) {
        const progress = {
          frame: Number(match[1]),
          fps: Number(match[2]),
          q: Number(match[3]),
          time: match[4],
          speed: Number(match[5])
        };
        const [hh, mm, ss] = progress.time.split(':');
        const currentTime = parseInt(hh) * 3600 + parseInt(mm) * 60 + parseFloat(ss);
        ws.send(JSON.stringify({ currentTime }, null, 4));
      }
    }

    if (data.urlPath) {
      const urlPath = decodeURIComponent(data.urlPath);

      let archivePassword;
      if (data.archivePassword) archivePassword = data.archivePassword;

      const folderName = urlPath.split('/')[0];
      if (!basePaths[folderName]) {
        ws.close(1000, 'Path not found');
      }

      const originalFilePath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), ""));
      const originalFileName = path.basename(originalFilePath);
      const pathParts = originalFilePath.split(path.sep);

      let filePath = originalFilePath;
      let isInArchive = false;
      let archivePath, archiveFileName, archiveFullPath, archiveInternalPath = '';
      let isHdr = false;

      // 判断是否为压缩包内部文件
      for (const [index, pathPart] of pathParts.entries()) {
        if (isArchive(pathPart)) {
          archivePath = pathParts.slice(0, index).join(path.sep);
          archiveFileName = pathPart;
          archiveFullPath = path.join(archivePath, archiveFileName);

          if (!fs.existsSync(archiveFullPath)) {
            ws.close(1000, `${archiveFileName} not found`);
          }

          if (fs.statSync(archiveFullPath).isFile() && originalFilePath.length > archiveFullPath.length) {
            isInArchive = true;
            archiveInternalPath = pathParts.slice(index + 1).join(path.sep);
            break;
          }
        }
      }

      const handlePlayFile = async (modifiedTime, size, sevenZip) => {
        // 检查数据库以获取 M3U8 信息
        const { thumbnailId } = thumbnails.getM3u8Info(originalFileName, modifiedTime, size);
      
        const thumbnailIdToUse = thumbnailId || randomBytes(16).toString('hex');
        const cacheDir = path.join(previewCachePath, thumbnailIdToUse);
        if (!fs.existsSync(cacheDir) || !fs.statSync(cacheDir).isDirectory()) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        if (isInArchive) {
          // 解压后的文件路径
          const extractedFilePath = path.join(cacheDir, archiveInternalPath);

          if (!fs.existsSync(extractedFilePath) || !fs.statSync(extractedFilePath).isFile()) {
            const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
            const extractResult = await sevenZip.extract(archiveFullPath, cacheDir, options, archivePassword, true, signal);

            if (!extractResult.isOK) {
              ws.close(1000, `Failed to extract file from archive:\n${extractResult.error}`);
              return;
            }

            if (!fs.existsSync(extractedFilePath)) {
              ws.close(1000, 'Extracted file not found');
              return;
            }
          }

          filePath = extractedFilePath;
        }
        session['filePath'] = filePath;

        // 更新数据库
        thumbnails.updateM3u8Info(originalFileName, modifiedTime, thumbnailIdToUse, size, 0);

        // 获取视频信息
        // const videoInfo = await ffmpeg.getMediaInfoFromFile(filePath, false, ['width', 'height'], ['duration']);
        const videoInfoFilePath = path.join(cacheDir, 'info.json');
        if (!(fs.existsSync(videoInfoFilePath) && fs.statSync(videoInfoFilePath).size > 0)) {
          // const videoInfo = await ffmpeg.getMediaInfoFromFile(filePath, true); // 不是太慢，但也不如写文件快
          // fs.writeFileSync(videoInfoFilePath, JSON.stringify(videoInfo, null, 4));
          await ffmpeg.getMediaInfoFromFileToFile(filePath, videoInfoFilePath, true, [], [], false);
        }
        const videoInfoFileContent = fs.readFileSync(videoInfoFilePath, { encoding: 'utf8' });
        const videoInfo = JSON.parse(videoInfoFileContent);

        const totalDuration = videoInfo.format.duration ? parseFloat(videoInfo.format.duration) : 0;
        if (totalDuration) {
          ws.send(JSON.stringify({ duration: totalDuration }, null, 4));
        }

        if (videoInfo.streams) {
          for (const stream of videoInfo.streams) {
            if ((stream.codec_type === 'video') && (stream.color_space) && (stream.color_space.includes('bt2020'))) {
              isHdr = true;
              session['isHdr'] = true;
              break;
            }
          }
        }

        // 生成多分辨率视频流的 Master m3u8 文件
        let videoWidth = 0;
        let videoHeight = 0;
        for (const stream of videoInfo.streams) {
          if (stream.codec_type === 'video' && videoHeight === 0 && videoWidth === 0) {
            videoWidth = parseInt(stream.width, 10);
            videoHeight = parseInt(stream.height, 10);
          } else if (stream.codec_type === 'audio') {
            audioStreams.push(stream.tags);
          } else if (stream.codec_type === 'subtitle') {
            subtitleStreams.push(stream.tags);
          }
        }
        if (videoHeight === 0 || videoWidth === 0) {
          ws.close(1000, `No video stream found`);
          return;
        }

        const videoMinSize = Math.min(videoHeight, videoWidth);
        const videoMaxSize = Math.max(videoHeight, videoWidth);

        // 模拟 ffmpeg 的视频滤镜计算生成视频流的高宽
        const calculateNewDimensions = (iw, ih, maxWidth, maxHeight) => {
          // 1. 计算基础的输出宽度和高度
          let outputWidth = Math.min(maxWidth, iw);
          let outputHeight = Math.min(maxHeight, ih);

          // 2. 计算原始宽高比
          const originalAspectRatio = iw / ih;
          const targetAspectRatio = maxWidth / maxHeight;

          // 3. 根据纵横比调整输出宽度和高度
          if (originalAspectRatio > targetAspectRatio) {
            // 原始视频宽高比大于目标宽高比
            outputHeight = Math.round(outputWidth / originalAspectRatio);
          } else {
            // 原始视频宽高比小于或等于目标宽高比
            outputWidth = Math.round(outputHeight * originalAspectRatio);
          }

          // 4. 确保输出宽度和高度为偶数
          outputWidth -= outputWidth % 2;
          outputHeight -= outputHeight % 2;

          return {
            width: outputWidth,
            height: outputHeight
          };
        }

        for (const [key, val] of Object.entries(resolutionMap)) {
          if (videoMaxSize >= val) {
            const { width, height } = calculateNewDimensions(videoWidth, videoHeight, val, val);
            resolutions.push({
              name: `${key}p`,
              width,
              height
            });
          }
        }
        if (resolutions.length === 0) {
          const { width, height } = calculateNewDimensions(videoWidth, videoHeight, videoMaxSize, videoMaxSize);
          resolutions.push({
            name: `${videoMinSize}p`,
            width,
            height
          });
        }
        console.log(resolutions);

        if (audioStreams.length > 1) {
          ws.send(JSON.stringify({ audios: audioStreams }, null, 4));
        }
        session['audioTrackIndex'] = 0;

        if (subtitleStreams.length) {
          ws.send(JSON.stringify({ subtitles: subtitleStreams }, null, 4));
          session['subtitleTrackIndex'] = 0;
        }

        if (resolutions.length > 1) {
          ws.send(JSON.stringify({ videos: resolutions.map(res => res.name) }, null, 4));
        }
        session['resolutionIndex'] = resolutions.length - 1;

        session['process'] = ffmpeg.createFileToHls(filePath, path.join(playDir, 'index.m3u8'), 0, Math.max(resolutions[session['resolutionIndex']]['width'], resolutions[session['resolutionIndex']]['height']), 24, playVideoSegmentTargetDuration, ['video', 'audio'], 0, 0, enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr, ffmpegProgressCallback);

        ws.send(JSON.stringify({ srcUrl: session['srcUrl'] }));
      };

      if (isInArchive) {
        try {
          // 使用 7-Zip 的 list 函数获取压缩包内文件信息
          const sevenZip = new SevenZip(sevenZipPath);
          const options = `"-i!${archiveInternalPath}"`;
          const result = await sevenZip.list(archiveFullPath, true, options, archivePassword, signal);
        
          if (!result.isOK) {
            ws.close(1000, `Failed to read archive content:\n${result.error}`);
            return;
          }
        
          // 找到目标文件的信息
          const targetFile = result.files.find((f) => f.Path === archiveInternalPath);
          if (!targetFile) {
            ws.close(1000, 'File not found in archive');
            return;
          }
        
          // 获取文件的最后修改时间
          const currentModifiedTime = targetFile.Modified.getTime();
        
          // 获取文件大小
          const fileSize = targetFile.Size;

          // 处理解压后的文件
          await handlePlayFile(currentModifiedTime, fileSize, sevenZip);
        } catch (error) {
          console.error('Error processing archive file preview:', error);
          if (error.message === 'AbortError') {
            ws.close(1000, 'Client Closed Request');
            return;
          }
          ws.close(1000, 'Error processing file preview');
          return;
        }
      } else if (fs.existsSync(originalFilePath)) {
        // 获取文件的最后修改时间
        const currentModifiedTime = fs.statSync(originalFilePath).mtimeMs;
      
        // 获取文件大小
        const fileSize = fs.statSync(originalFilePath).size;
      
        await handlePlayFile(currentModifiedTime, fileSize);
      } else {
        ws.close(1000, `${originalFileName} not found`);
        return;
      }
    }

    if (data.seek >= 0) {
      session['process'].kill();

      const startTime = data.seek;
      session['startTime'] = startTime;

      const playFileName = `index${(session['resolutionIndex'] === (resolutions.length - 1) ? '' : `_${resolutions[session['resolutionIndex']]['name']}`)}${session['audioTrackIndex'] ? `_a${session['audioTrackIndex']}` : ''}${session['subtitleTrackIndex'] ? `_s${session['subtitleTrackIndex']}` : ''}.m3u8?${session['startTime'] ? `seek=${session['startTime']}` : ''}`;
      const srcUrl = `/play/${sessionId}/${playFileName}`;
      session['srcUrl'] = srcUrl;

      session['process'] = ffmpeg.createFileToHls(filePath, path.join(playDir, playFileName), startTime, Math.max(resolutions[session['resolutionIndex']]['width'], resolutions[session['resolutionIndex']]['height']), 24, playVideoSegmentTargetDuration, ['video', 'audio'], session['audioTrackIndex'], session['subtitleTrackIndex'], enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr, ffmpegProgressCallback);

      ws.send(JSON.stringify({ srcUrl }, null, 4));
    }

    if (data.resolution >= 0) {
      session['process'].kill();

      const resolutionIndex = data.resolution;
      session['resolutionIndex'] = resolutionIndex;

      const playFileName = `index${(resolutionIndex === (resolutions.length - 1) ? '' : `_${resolutions[resolutionIndex]['name']}`)}${session['audioTrackIndex'] ? `_a${session['audioTrackIndex']}` : ''}${session['subtitleTrackIndex'] ? `_s${session['subtitleTrackIndex']}` : ''}.m3u8?${session['startTime'] ? `seek=${session['startTime']}` : ''}`;
      const srcUrl = `/play/${sessionId}/${playFileName}`;
      session['srcUrl'] = srcUrl;

      session['process'] = ffmpeg.createFileToHls(filePath, path.join(playDir, playFileName), session['startTime'], Math.max(resolutions[resolutionIndex]['width'], resolutions[resolutionIndex]['height']), 24, playVideoSegmentTargetDuration, ['video', 'audio'], session['audioTrackIndex'], session['subtitleTrackIndex'], enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr, ffmpegProgressCallback);

      ws.send(JSON.stringify({ srcUrl }, null, 4));
    }

    if (data.audio >= 0) {
      session['process'].kill();

      const audioTrackIndex = data.audio;
      session['audioTrackIndex'] = audioTrackIndex;

      const playFileName = `index${(session['resolutionIndex'] === (resolutions.length - 1) ? '' : `_${resolutions[session['resolutionIndex']]['name']}`)}${audioTrackIndex ? `_a${audioTrackIndex}` : ''}${session['subtitleTrackIndex'] ? `_s${session['subtitleTrackIndex']}` : ''}.m3u8?${session['startTime'] ? `seek=${session['startTime']}` : ''}`;
      const srcUrl = `/play/${sessionId}/${playFileName}`;
      session['srcUrl'] = srcUrl;

      session['process'] = ffmpeg.createFileToHls(filePath, path.join(playDir, playFileName), session['startTime'], Math.max(resolutions[session['resolutionIndex']]['width'], resolutions[session['resolutionIndex']]['height']), 24, playVideoSegmentTargetDuration, ['video', 'audio'], audioTrackIndex, session['subtitleTrackIndex'], enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr, ffmpegProgressCallback);

      ws.send(JSON.stringify({ srcUrl }, null, 4));
    }

    if (data.subtitle >= 0) {
      session['process'].kill();

      const subtitleTrackIndex = data.subtitle;
      session['subtitleTrackIndex'] = subtitleTrackIndex;

      const playFileName = `index${(session['resolutionIndex'] === (resolutions.length - 1) ? '' : `_${resolutions[session['resolutionIndex']]['name']}`)}${session['audioTrackIndex'] ? `_a${session['audioTrackIndex']}` : ''}${subtitleTrackIndex ? `_s${subtitleTrackIndex}` : ''}.m3u8?${session['startTime'] ? `seek=${session['startTime']}` : ''}`;
      const srcUrl = `/play/${sessionId}/${playFileName}`;
      session['srcUrl'] = srcUrl;

      session['process'] = ffmpeg.createFileToHls(filePath, path.join(playDir, playFileName), session['startTime'], Math.max(resolutions[session['resolutionIndex']]['width'], resolutions[session['resolutionIndex']]['height']), 24, playVideoSegmentTargetDuration, ['video', 'audio'], session['audioTrackIndex'], subtitleTrackIndex, enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr, ffmpegProgressCallback);

      ws.send(JSON.stringify({ srcUrl }, null, 4));
    }
  });

  ws.on('close', function close() {
    console.log('WS close');
    abortController.abort();
    if (session['process'] && !session['process']['closed']) {
      session['process'].on('close', () => {
        fs.rmSync(playDir, { recursive: true, force: true });
      });
      session['process'].kill();
      session['process'] = null;
    }
  })
}

module.exports = play;