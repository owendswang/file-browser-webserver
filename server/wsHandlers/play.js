const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils//7zip');
const FFmpeg = require('@/utils/ffmpeg');
const { isArchive } = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');
const thumbnails = require('@/utils/thumbnails');

const sessionMap = {};

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
    tempDir
  } = getConfig();

  const abortController = new AbortController();
  const { signal } = abortController;

  ws.on('error', console.error);

  ws.send(JSON.stringify({ debug: '欢迎来到 play WS' }, null, 4));

  ws.on('message', async function message(msg) {
    console.log(`received: \n${msg}`);
    const data = JSON.parse(msg);

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
 
      let isInArchive = false;
      let archivePath, archiveFileName, archiveFullPath, archiveInternalPath = '';

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
        
        const sessionId = randomBytes(16).toString('hex');
        const playDir = path.join(tempDir, sessionId);
        fs.mkdirSync(playDir, { recursive: true });
        const m3u8FilePath = path.join(playDir, 'index.m3u8');

        let filePath = originalFilePath;
        if (isInArchive) {
          // 解压后的文件路径
          const extractedFilePath = path.join(cacheDir, archiveInternalPath);

          if (!fs.existsSync(extractedFilePath) || !fs.statSync(extractedFilePath).isFile()) {
            const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
            const extractResult = await sevenZip.extract(archiveFullPath, cacheDir, options, archivePassword, true, signal);

            if (!extractResult.isOK) {
              return res.status(500).send(`Failed to extract file from archive:\n${extractResult.error}`);
            }

            if (!fs.existsSync(extractedFilePath)) {
              return res.status(404).send('Extracted file not found');
            }
          }

          filePath = extractedFilePath;
        }

        // 更新数据库
        thumbnails.updateM3u8Info(originalFileName, modifiedTime, thumbnailIdToUse, size, 0);

        // 生成 m3u8 文件
        const ffmpeg = new FFmpeg(ffmpegPath);

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

        // 生成多分辨率视频流的 Master m3u8 文件
        let videoWidth = 0;
        let videoHeight = 0;
        let audioStreams = [];
        let subtitleStreams = [];
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
        }

        const resolutions = [];
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

        let playlist = `#EXTM3U${os.EOL}#EXT-X-VERSION:6${os.EOL}`;
        if (audioStreams.length > 1) {
          for (let i = 0; i < audioStreams.length; i += 1) {
            playlist += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${typeof(audioStreams[i]) === 'object' ? Object.entries(audioStreams[i]).map(([key, val]) => val).join(' ') : `audio-${i}`}",AUTOSELECT=YES,DEFAULT=${i === 0 ? 'YES' : 'NO'},CHANNELS="2",URI="index_audio_${i}.m3u8"${os.EOL}`;
          }
          playlist += os.EOL;
        }
        if (subtitleStreams.length) {
          for (let i = 0; i < subtitleStreams.length; i += 1) {
            playlist += `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitle",${subtitleStreams[i]?.language ? `LANGUAGE="${subtitleStreams[i].language}",` : ''}NAME="${subtitleStreams[i]?.title || subtitleStreams[i]?.language || `subtitle-${i}`}",AUTOSELECT=YES,DEFAULT=${i === 0 ? 'YES' : 'NO'},FORCED=NO,CHARACTERISTICS="public.accessibility.transcribes-spoken-dialog",URI="index_subtitle_${i}.m3u8"${os.EOL}`;
          }
          playlist += os.EOL;
        }
        for (const resolution of resolutions) {
          playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${resolution.width * resolution.height},RESOLUTION=${resolution.width}x${resolution.height},FRAME-RATE=${playVideoFps.toFixed(3)},CODECS="avc1.42c01f,mp4a.40.2"${audioStreams.length > 1 ? ',AUDIO="audio"' : ''}${subtitleStreams.length ? ',SUBTITLES="subtitle"' : ''}${os.EOL}`;
          playlist += `index_${resolution.name}.m3u8${os.EOL}${os.EOL}`;
        }
        if (audioStreams.length > 1) {
          for (let i = 0; i < audioStreams.length; i += 1) {
            playlist += `#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"${os.EOL}`;
            playlist += `index_audio_${i}.m3u8${os.EOL}${os.EOL}`;
          }
        }
        fs.writeFileSync(m3u8FilePath, playlist, { encoding: 'utf8' });

      };

      if (isInArchive) {
        try {
          // 使用 7-Zip 的 list 函数获取压缩包内文件信息
          const sevenZip = new SevenZip(sevenZipPath);
          const options = `"-i!${archiveInternalPath}"`;
          const result = await sevenZip.list(archiveFullPath, true, options, archivePassword, signal);
        
          if (!result.isOK) {
            return res.status(500).send(`Failed to read archive content:\n${result.error}`);
          }
        
          // 找到目标文件的信息
          const targetFile = result.files.find((f) => f.Path === archiveInternalPath);
          if (!targetFile) {
            return res.status(404).send('File not found in archive');
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
            return res.status(499).send('Client Closed Request');
          }
          return res.status(500).send('Error processing file preview');
        }
      } else if (fs.existsSync(originalFilePath)) {
        // 获取文件的最后修改时间
        const currentModifiedTime = fs.statSync(originalFilePath).mtimeMs;
      
        // 获取文件大小
        const fileSize = fs.statSync(originalFilePath).size;
      
        await handlePlayFile(currentModifiedTime, fileSize);
      } else {
        return res.status(404).send(`${originalFileName} not found`);
      }
    }
  });

  ws.on('close', function close() {
    console.log('WS close');
    abortController.abort();
  })
}

module.exports = play;