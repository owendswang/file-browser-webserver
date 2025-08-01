const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils//7zip');
const FFmpeg = require('@/utils/ffmpeg');
const { isArchive, rm } = require('@/utils/fileUtils');
const sleep = require('@/utils/sleep');
const getConfig = require('@/utils/getConfig');

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

const method = async (req, res) => {
  const {
    sevenZipPath,
    ffmpegPath,
    basePaths,
    previewCachePath,
    playVideoFps,
    playVideoSegmentTargetDuration,
    enablePlayVideoHardwareAcceleration,
    playVideoHardwareAccelerationVendor,
    playVideoHardwareAccelerationDevice
  } = getConfig();

  const thumbnails = res.locals.thumbnails;

  const abortController = new AbortController();
  const { signal } = abortController;
  /*req.on('close', () => {
    abortController.abort();
  });*/

  const m3u8Pattern = /\/\w+\.m3u8$/g;
  const tsPattern = /\/\w+\.(ts|aac)$/;
  const vttPattern = /\/\w+\.vtt$/g;

  const urlPath = req.params[0].replace(m3u8Pattern, '').replace(tsPattern, '').replace(vttPattern, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const originalFilePath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), ""));
  const originalFileName = path.basename(originalFilePath);
  const pathParts = originalFilePath.split(path.sep);

  // 获取查询参数
  let { archivePassword = '' } = req.query;

  let isInArchive = false;
  let archivePath, archiveFileName, archiveFullPath, archiveInternalPath = '';

  // 判断是否为压缩包内部文件
  for (const [index, pathPart] of pathParts.entries()) {
    if (isArchive(pathPart)) {
      archivePath = pathParts.slice(0, index).join(path.sep);
      archiveFileName = pathPart;
      archiveFullPath = path.join(archivePath, archiveFileName);

      if (!fs.existsSync(archiveFullPath)) {
        return res.status(404).send(`${archiveFileName} not found`);
      }

      if (fs.statSync(archiveFullPath).isFile() && originalFilePath.length > archiveFullPath.length) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);
        break;
      }
    }
  }

  const handlePlayFile = async (modifiedTime, size, sevenZip) => {
    if (req.params[0].endsWith('.ts') || req.params[0].endsWith('.aac')) {
      const tsFileName = req.params[0].match(tsPattern)[0].replace(/^\//g, '');

      if (!isInArchive && !fs.existsSync(originalFilePath)) {
        return res.status(404).send(`"${originalFileName}" not found`);
      }

      try {
        // 检查数据库以获取 M3U8 信息
        const { thumbnailId } = thumbnails.getM3u8Info(originalFileName, modifiedTime, size);
        if (!thumbnailId) {
          return res.status(404).send(`${tsFileName} not found.`);
        }

        const videoMatch = tsFileName.match(/(segment|video)_(\d+)p_(\d+)\.ts/);
        let videoOnly = false;
        let segmentResolution, segmentIndex;
        if (videoMatch) {
          videoOnly = videoMatch[1] === 'video';
          segmentResolution = parseInt(videoMatch[2]);
          segmentIndex = parseInt(videoMatch[3]);
        }
        const audioMatch = tsFileName.match(/audio_(\d+)_(\d+)\.aac/);
        let audioTrackIndex = 0;
        if (audioMatch) {
          audioTrackIndex = parseInt(audioMatch[1]);
          segmentIndex = parseInt(audioMatch[2]);
        }

        const cacheDir = path.join(previewCachePath, thumbnailId);
        const tsFilePath = path.join(cacheDir, tsFileName);

        if (fs.existsSync(tsFilePath) && fs.statSync(tsFilePath).size > 0) {
          res.set('Content-Type', 'video/MP2T');
          return res.sendFile(tsFilePath);
        } else if (fs.existsSync(`${tsFilePath}.tmp`)) {
          // wait for ffmpeg to finish transcode this segment.
          for (let i = 0; i < 5; i += 1) {
            await sleep(1000);
            if (fs.existsSync(tsFilePath) && fs.statSync(tsFilePath).size > 0) {
              return res.sendFile(tsFilePath);
            }
          }
          return res.status(500).send(`Error getting ts segment file:\n${tsFileName} not ready yet.`);
        } else {
          let filePath = originalFilePath;
          if (isInArchive) {
            filePath = path.join(cacheDir, archiveInternalPath);
          }

          const playVideoSize = resolutionMap[segmentResolution] || 0;

          const ffmpeg = new FFmpeg(ffmpegPath);

          let isHdr = false;
          let videoInfo = {};
          const videoInfoFilePath = path.join(cacheDir, 'info.json');
          if (fs.existsSync(videoInfoFilePath) && fs.statSync(videoInfoFilePath).isFile()) {
            const videoInfoStr = fs.readFileSync(videoInfoFilePath);
            videoInfo = JSON.parse(videoInfoStr);
          } else {
            videoInfo = await ffmpeg.getMediaInfoFromFile(filePath, true);
            fs.writeFileSync(path.join(cacheDir, 'info.json'), JSON.stringify(videoInfo, null, 4));
          }
          if (videoInfo.streams) {
            for (const stream of videoInfo.streams) {
              if ((stream.codec_type === 'video') && (stream.color_space) && (stream.color_space.includes('bt2020'))) {
                isHdr = true;
                break;
              }
            }
          }

          // async 的方式生成 ts 文件
          const streams = videoOnly ? ['video'] : audioMatch ? ['audio'] : ['video', 'audio'];
          if (enablePlayVideoHardwareAcceleration) {
            try {
              await ffmpeg.createSegmentToFile(filePath, cacheDir, segmentIndex, tsFileName, playVideoSize, playVideoSize, playVideoFps, playVideoSegmentTargetDuration, streams, audioTrackIndex, enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr);
            } catch (e) {
              console.error(e);
              await ffmpeg.createSegmentToFile(filePath, cacheDir, segmentIndex, tsFileName, playVideoSize, playVideoSize, playVideoFps, playVideoSegmentTargetDuration, streams, audioTrackIndex, enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, true);
            }
          } else {
            await ffmpeg.createSegmentToFile(filePath, cacheDir, segmentIndex, tsFileName, playVideoSize, playVideoSize, playVideoFps, playVideoSegmentTargetDuration, streams, audioTrackIndex, enablePlayVideoHardwareAcceleration, playVideoHardwareAccelerationVendor, playVideoHardwareAccelerationDevice, signal, false, false, isHdr);
          }

          const m3u8FilePath = path.join(cacheDir, 'index.m3u8');
          if (fs.existsSync(m3u8FilePath) && fs.statSync(m3u8FilePath).size > 0) {
            const m3u8FileContent = fs.readFileSync(m3u8FilePath, 'utf8');
            const childM3u8Pattern = /^index(_audio|_subtitle)?_\d+p?\.m3u8$/gm;
            const playlistMatches = m3u8FileContent.match(childM3u8Pattern);
            if (playlistMatches) {
              const childM3u8FilePath = path.join(cacheDir, playlistMatches[0]);
              const childM3u8FileContent = fs.readFileSync(childM3u8FilePath, 'utf8');
              const segmentPattern = /^(segment|video|audio|subtitle)_\d+p?_\d+\.(ts|aac|vtt)$/gm;

              const segmentMatches = childM3u8FileContent.match(segmentPattern);
              const targetSegmentCount = segmentMatches ? (segmentMatches.length * playlistMatches.length) : 0;

              const files = fs.readdirSync(cacheDir);
              const actualSegmentCount = files.filter(file => segmentPattern.test(file) && fs.statSync(path.join(cacheDir, file)).isFile()).length;

              if (targetSegmentCount === actualSegmentCount) {
                if (isInArchive) {
                  const extractedFilePath = path.join(cacheDir, archiveInternalPath.split(path.sep)[0]);
                  if (fs.existsSync(extractedFilePath)) {
                    await rm(extractedFilePath);
                  }
                }
                thumbnails.updateM3u8Info(originalFileName, modifiedTime, thumbnailId, size, 1);
              }
            }
          }

          return res.sendFile(tsFilePath);
/*
          // stream 的方式生成 ts 文件
          const outputSegmentPath = path.join(cacheDir, tsFileName);
          const tmpOutputSegmentPath = `${outputSegmentPath}.tmp`;
          const writeStream = fs.createWriteStream(tmpOutputSegmentPath);

          // 处理写入中的错误
          writeStream.on('error', (error) => {
            console.error('Error writing to cache:', error);
            return res.status(500).send(`Error processing segment:\n${error.message}`);
          });

          const ffmpegStream = ffmpeg.createSegmentToStream(filePath, segmentIndex, playVideoSize, playVideoSize, playVideoFps, playVideoSegmentTargetDuration, videoOnly ? ['video'] : ['video', 'audio'], signal, false);

          // Check if ffmpegStream is valid before piping
          if (!ffmpegStream) {
            throw new Error('FFmpeg stream is not valid');
          }

          // 流式写入缓存
          ffmpegStream.pipe(writeStream);

          // 处理完成的事件
          writeStream.on('close', () => {
            if (fs.existsSync(tmpOutputSegmentPath) && fs.statSync(tmpOutputSegmentPath).isFile()) {
              fs.renameSync(tmpOutputSegmentPath, outputSegmentPath);
            }
          });

          // 流式发送数据
          ffmpegStream.pipe(res);

          // 处理 FFmpeg 过程中的错误
          ffmpegStream.on('error', (error) => {
            console.error('Error during FFmpeg processing:', error);
            return res.status(500).send(`Error processing segment:\n${error.message}`);
          });
*/
        }
      } catch (error) {
        console.error('Error getting ts segment file:', error);
        return res.status(500).send(`Error getting ts segment file:\n${tsFileName}`);
      }
    } else if (req.params[0].endsWith('.vtt')) {
      const vttFileName = req.params[0].match(vttPattern)[0].replace(/^\//g, '');

      if (!isInArchive && !fs.existsSync(originalFilePath)) {
        return res.status(404).send(`${originalFileName} not found`);
      }

      try {
        // 检查数据库以获取 M3U8 信息
        const { thumbnailId } = thumbnails.getM3u8Info(originalFileName, modifiedTime, size);
        if (!thumbnailId) {
          return res.status(404).send(`${vttFileName} not found.`);
        }

        const subtitleMatch = vttFileName.match(/subtitle_(\d+)_(\d+)\.vtt/);
        let subtitleTrackIndex, segmentIndex;
        if (subtitleMatch) {
          subtitleTrackIndex = parseInt(subtitleMatch[1]);
          segmentIndex = parseInt(subtitleMatch[2]);
        }

        const cacheDir = path.join(previewCachePath, thumbnailId);
        const vttFilePath = path.join(cacheDir, vttFileName);

        if (fs.existsSync(vttFilePath) && fs.statSync(vttFilePath).size > 0) {
          res.set('Content-Type', 'video/MP2T');
          return res.sendFile(vttFilePath);
        } else if (fs.existsSync(`${vttFilePath}.tmp`)) {
          // wait for ffmpeg to finish transcode this segment.
          for (let i = 0; i < 5; i += 1) {
            await sleep(1000);
            if (fs.existsSync(vttFilePath) && fs.statSync(vttFilePath).size > 0) {
              return res.sendFile(vttFilePath);
            }
          }
          return res.status(500).send(`Error getting vtt segment file:\n${vttFileName} not ready yet.`);
        } else {
          let filePath = originalFilePath;
          if (isInArchive) {
            filePath = path.join(cacheDir, archiveInternalPath);
          }

          // 生成 vtt 文件
          const ffmpeg = new FFmpeg(ffmpegPath);

          // async 的方式生成 vtt 文件
          const streams = ['subtitle'];
          const ffmpegRes = await ffmpeg.createSegmentToFile(filePath, cacheDir, segmentIndex, vttFileName, 0, 0, 0, playVideoSegmentTargetDuration, streams, subtitleTrackIndex, null, null, null, signal, false);

          const m3u8FilePath = path.join(cacheDir, 'index.m3u8');
          if (fs.existsSync(m3u8FilePath) && fs.statSync(m3u8FilePath).size > 0) {
            const m3u8FileContent = fs.readFileSync(m3u8FilePath, 'utf8');
            const childM3u8Pattern = /^index(_audio|_subtitle)?_\d+p?\.m3u8$/gm;
            const playlistMatches = m3u8FileContent.match(childM3u8Pattern);
            if (playlistMatches) {
              const childM3u8FilePath = path.join(cacheDir, playlistMatches[0]);
              const childM3u8FileContent = fs.readFileSync(childM3u8FilePath, 'utf8');
              const segmentPattern = /^(segment|video|audio|subtitle)_\d+p?_\d+\.(ts|aac|vtt)$/gm;

              const segmentMatches = childM3u8FileContent.match(segmentPattern);
              const targetSegmentCount = segmentMatches ? (segmentMatches.length * playlistMatches.length) : 0;

              const files = fs.readdirSync(cacheDir);
              const actualSegmentCount = files.filter(file => segmentPattern.test(file) && fs.statSync(path.join(cacheDir, file)).isFile()).length;

              if (targetSegmentCount === actualSegmentCount) {
                if (isInArchive) {
                  const extractedFilePath = path.join(cacheDir, archiveInternalPath.split(path.sep)[0]);
                  if (fs.existsSync(extractedFilePath)) {
                    await rm(extractedFilePath);
                  }
                }
                thumbnails.updateM3u8Info(originalFileName, modifiedTime, thumbnailId, size, 1);
              }
            }
          }

          return res.sendFile(vttFilePath);
        }
      } catch (error) {
        console.error('Error getting vtt segment file:', error);
        return res.status(500).send(`Error getting vtt segment file:\n${vttFileName}`);
      }
    } else if (req.params[0].endsWith('.m3u8')) {
      const m3u8FileName = req.params[0].match(m3u8Pattern)[0].replace(/^\//g, '');

      if (!isInArchive && !fs.existsSync(originalFilePath)) {
        return res.status(404).send(`${originalFileName} not found`);
      }

      try {
        // 检查数据库以获取 M3U8 信息
        const { thumbnailId } = thumbnails.getM3u8Info(originalFileName, modifiedTime, size);

        const thumbnailIdToUse = thumbnailId || randomBytes(16).toString('hex');
        const cacheDir = path.join(previewCachePath, thumbnailIdToUse);
        const m3u8FilePath = path.join(previewCachePath, thumbnailIdToUse, m3u8FileName);

        if (fs.existsSync(m3u8FilePath) && fs.statSync(m3u8FilePath).size > 0) {
          return res.sendFile(m3u8FilePath);
        }

        if (!fs.existsSync(cacheDir) || !fs.statSync(cacheDir).isDirectory()) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

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
        // const videoInfo = await ffmpeg.getMediaInfoFromFile(filePath, false, ['width', 'height'], ['duration']);
        const videoInfo = await ffmpeg.getMediaInfoFromFile(filePath, true);
        fs.writeFileSync(path.join(cacheDir, 'info.json'), JSON.stringify(videoInfo, null, 4));

        const duration = videoInfo.format.duration ? parseFloat(videoInfo.format.duration) : 0;
        const numSegments = Math.ceil(duration / playVideoSegmentTargetDuration);
        const padStartLength = (numSegments - 1).toString().length;

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
          throw new Error('No video stream found.');
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
          playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${resolution.width * resolution.height},RESOLUTION=${resolution.width}x${resolution.height},FRAME-RATE=${playVideoFps.toFixed(3)},CODECS="avc1.42c015,mp4a.40.2"${audioStreams.length > 1 ? ',AUDIO="audio"' : ''}${subtitleStreams.length ? ',SUBTITLES="subtitle"' : ''}${os.EOL}`;
          playlist += `index_${resolution.name}.m3u8${os.EOL}${os.EOL}`;
        }
        if (audioStreams.length > 1) {
          for (let i = 0; i < audioStreams.length; i += 1) {
            playlist += `#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"${os.EOL}`;
            playlist += `index_audio_${i}.m3u8${os.EOL}${os.EOL}`;
          }
        }
        fs.writeFileSync(m3u8FilePath, playlist, { encoding: 'utf8' });

        // 逐个生成不同分辨率的 m3u8 文件
        for (const resolution of resolutions) {
          let childPlaylist = `#EXTM3U${os.EOL}#EXT-X-VERSION:6${os.EOL}`;
          childPlaylist += `#EXT-X-TARGETDURATION:${playVideoSegmentTargetDuration}${os.EOL}`;
          childPlaylist += `#EXT-X-MEDIA-SEQUENCE:0${os.EOL}`;
          childPlaylist += `#EXT-X-PLAYLIST-TYPE:VOD${os.EOL}`;
          childPlaylist += `#EXT-X-INDEPENDENT-SEGMENTS${os.EOL}`;
          for (let i = 0; i < numSegments; i++) {
            childPlaylist += `#EXTINF:${Math.min(playVideoSegmentTargetDuration, duration - i * playVideoSegmentTargetDuration).toFixed(6)},${os.EOL}`;
            childPlaylist += `${audioStreams.length > 1 ? 'video' : 'segment'}_${resolution.name}_${i.toString().padStart(padStartLength, '0')}.ts${os.EOL}`;
          }
          childPlaylist += `#EXT-X-ENDLIST${os.EOL}`;
          const childM3u8FilePath = path.join(previewCachePath, thumbnailIdToUse, `index_${resolution.name}.m3u8`);
          fs.writeFileSync(childM3u8FilePath, childPlaylist, { encoding: 'utf8' });
        }
        if (audioStreams.length > 1) {
          for (let i = 0; i < audioStreams.length; i += 1) {
            let audioPlaylist = `#EXTM3U${os.EOL}#EXT-X-VERSION:6${os.EOL}`;
            audioPlaylist += `#EXT-X-TARGETDURATION:${playVideoSegmentTargetDuration}${os.EOL}`;
            audioPlaylist += `#EXT-X-MEDIA-SEQUENCE:0${os.EOL}`;
            audioPlaylist += `#EXT-X-PLAYLIST-TYPE:VOD${os.EOL}`;
            audioPlaylist += `#EXT-X-INDEPENDENT-SEGMENTS${os.EOL}`;
            for (let j = 0; j < numSegments; j++) {
              audioPlaylist += `#EXTINF:${Math.min(playVideoSegmentTargetDuration, duration - j * playVideoSegmentTargetDuration).toFixed(6)},${os.EOL}`;
              audioPlaylist += `audio_${i}_${j.toString().padStart(padStartLength, '0')}.aac${os.EOL}`;
            }
            audioPlaylist += `#EXT-X-ENDLIST${os.EOL}`;
            const audioM3u8FilePath = path.join(previewCachePath, thumbnailIdToUse, `index_audio_${i}.m3u8`);
            fs.writeFileSync(audioM3u8FilePath, audioPlaylist, { encoding: 'utf8' });
          }
        }
        for (let i = 0; i < subtitleStreams.length; i += 1) {
          let subtitlePlaylist = `#EXTM3U${os.EOL}#EXT-X-VERSION:6${os.EOL}`;
          subtitlePlaylist += `#EXT-X-TARGETDURATION:${playVideoSegmentTargetDuration}${os.EOL}`;
          subtitlePlaylist += `#EXT-X-MEDIA-SEQUENCE:0${os.EOL}`;
          subtitlePlaylist += `#EXT-X-PLAYLIST-TYPE:VOD${os.EOL}`;
          subtitlePlaylist += `#EXT-X-INDEPENDENT-SEGMENTS${os.EOL}`;
          for (let j = 0; j < numSegments; j++) {
            subtitlePlaylist += `#EXTINF:${Math.min(playVideoSegmentTargetDuration, duration - j * playVideoSegmentTargetDuration).toFixed(6)},${os.EOL}`;
            subtitlePlaylist += `subtitle_${i}_${j.toString().padStart(padStartLength, '0')}.vtt${os.EOL}`;
          }
          subtitlePlaylist += `#EXT-X-ENDLIST${os.EOL}`;
          const subtitleM3u8FilePath = path.join(previewCachePath, thumbnailIdToUse, `index_subtitle_${i}.m3u8`);
          fs.writeFileSync(subtitleM3u8FilePath, subtitlePlaylist, { encoding: 'utf8' });
        }

        return res.sendFile(m3u8FilePath);
      } catch (error) {
        console.error('Error create M3U8 file:', error);
        if (error.message === 'AbortError') {
          return res.status(499).send('Client Closed Request');
        }
        return res.status(500).send(`Error create M3U8 file:\n${error.message}`);
      }
    } else {
      return res.status(404).send('Path not found');
    }
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

module.exports = method;
