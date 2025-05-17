const os = require('os');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const SevenZip = require('@/utils/7zip');
const FFmpeg = require('@/utils/ffmpeg');
const {
  getFileType,
  isArchive
} = require('@/utils/fileUtils');
const getConfig = require('@/utils/getConfig');

const method = async (req, res) => {
  const {
    sevenZipPath,
    ffmpegPath,
    basePaths,
    previewCachePath,
    previewImageMaxWidth,
    previewImageMaxHeight,
  } = getConfig();
  
  const thumbnails = res.locals.thumbnails;

  const abortController = new AbortController();
  const { signal } = abortController;
  /*req.on('close', () => {
    abortController.abort();
  });*/

  const urlPath = req.params[0].replace(/\.webp(\/*)$/g, '');
  const folderName = urlPath.split('/')[0];
  if (!basePaths[folderName]) {
    return res.status(404).send('Path not found');
  }
  const originalFilePath = path.join(basePaths[folderName], urlPath.replace(new RegExp(`^${folderName}`, 'g'), "")); // 使用 decodeURIComponent 解析路径
  const originalFileName = path.basename(originalFilePath);
  const pathParts = originalFilePath.split(path.sep);

  // 使用 getFileType 判断文件类型
  const fileType = getFileType(originalFileName);
  if (!["Image File", "Video File"].includes(fileType)) {
    return res.status(415).send('Unsupported Media Type');
  }

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
        return res.status(404).send('Source not found');
      }

      if (fs.statSync(archiveFullPath).isFile() && originalFilePath.length > archiveFullPath.length) {
        isInArchive = true;
        archiveInternalPath = pathParts.slice(index + 1).join(path.sep);  
        break;
      }
    }
  }

  // 预览文件处理逻辑
  const handlePreviewFile = async (modifiedTime, size, sevenZip) => {
    // 检查数据库以获取缩略图信息
    const { thumbnailId, regenerate } = thumbnails.getThumbnailInfo(originalFileName, modifiedTime, size);

    if (regenerate) {
      // 生成新的缩略图并更新数据库
      const thumbnailIdToUse = thumbnailId || randomBytes(16).toString('hex');
      const webpFileName = `${thumbnailIdToUse}.webp`;
      const webpFilePath = path.join(previewCachePath, webpFileName);
      thumbnails.updateThumbnailInfo(originalFileName, modifiedTime, thumbnailIdToUse, size, 1);

      // 移除缓存中是否已有该 WebP 文件
      if (fs.existsSync(webpFilePath)) {
        fs.unlinkSync(webpFilePath);
      }

      try {
        /*let readStream;
        if (isInArchive) {
          // 使用 7-Zip 解压指定文件
          const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
          readStream = await sevenZip.extractStream(archiveFullPath, options, archivePassword, signal);
        } else {
          readStream = fs.createReadStream(originalFilePath, { signal });
        }

        if (!readStream) {
          throw new Error('File read stream is not valid');
        }*/

        let filePath = originalFilePath;
        if (isInArchive) {
          // 系统临时目录 + 随机文件夹名
          const tempDir = path.join(os.tmpdir(), randomBytes(16).toString('hex'));

          const options = `"-i!${archiveInternalPath}"`; // 指定要解压的文件
          const extractResult = await sevenZip.extract(archiveFullPath, tempDir, options, archivePassword, true, signal);

          if (!extractResult.isOK) {
            return res.status(500).send(`Failed to extract file from archive:\n${extractResult.error}`);
          }

          // 解压后的文件路径
          const extractedFilePath = path.join(tempDir, archiveInternalPath);

          if (!fs.existsSync(extractedFilePath)) {
            return res.status(404).send('Extracted file not found');
          }

          filePath = extractedFilePath;
        }

        // 否则开始转换并将结果流式传输到响应
        const ffmpeg = new FFmpeg(ffmpegPath); // 从 config 获取 FFmpeg 路径

        // 设置响应类型为 WebP
        res.set('Content-Type', 'image/webp');

        // 创建写入流，写入缓存文件
        const writeStream = fs.createWriteStream(webpFilePath);

        // 处理写入中的错误
        writeStream.on('error', (error) => {
          console.error('Error writing to cache:', error);
          return res.status(500).send(`Error processing image:\n${error.message}`);
        });

        let ffmpegStream;
        if (fileType === "Image File") {
          // ffmpegStream = ffmpeg.convertStreamToWebP(readStream, previewImageMaxWidth, previewImageMaxHeight, false);
          ffmpegStream = ffmpeg.convertFileToWebP(filePath, previewImageMaxWidth, previewImageMaxHeight, false);
        } else if (fileType === "Video File") {
          const timeToCapture = '00:00:01'; // 设定时间点为视频的第一秒
          // ffmpegStream = ffmpeg.captureFrameFromStream(readStream, timeToCapture, previewImageMaxWidth, previewImageMaxHeight, false);
          ffmpegStream = ffmpeg.captureFrameFromFile(filePath, timeToCapture, previewImageMaxWidth, previewImageMaxHeight, false);
        }

        // Check if ffmpegStream is valid before piping
        if (!ffmpegStream) {
          throw new Error('FFmpeg stream is not valid');
        }

        // 流式写入缓存
        ffmpegStream.pipe(writeStream);

        // 处理完成的事件
        writeStream.on('close', () => {
          if (isInArchive) {
            // 确保临时目录被删除
            const tmpdir = filePath.split(path.sep).slice(0, filePath.split(path.sep).length - 1).join(path.sep);
            fs.rmSync(tmpdir, { recursive: true, force: true }, (err) => {
              if (err) console.error('Failed to delete temp folder:', err.message);
            });
          }
        });

        // 流式发送数据
        ffmpegStream.pipe(res);

        // 处理 FFmpeg 过程中的错误
        ffmpegStream.on('error', (error) => {
          console.error('Error during FFmpeg processing:', error);
          return res.status(500).send(`Error processing image:\n${error.message}`);
        });
      } catch (error) {
        console.error('Error in handlePreviewFile:', error);
        if (error.message === 'AbortError') {
          return res.status(499).send('Client Closed Request');
        }
        return res.status(500).send(`Error processing image:\n${error.message}`);
      }
    } else if (thumbnailId) {
      return res.sendFile(path.join(previewCachePath, `${thumbnailId}.webp`));
    } else {
      return res.status(404).send('Thumbnail file not found');
    }
  };

  if (isInArchive) {
    try {
      // 使用 7-Zip 的 list 函数获取压缩包内文件信息
      const sevenZip = new SevenZip(sevenZipPath);
      const result = await sevenZip.list(archiveFullPath, true, '', archivePassword, signal);

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
      await handlePreviewFile(currentModifiedTime, fileSize, sevenZip);
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

    await handlePreviewFile(currentModifiedTime, fileSize);
  } else {
    return res.status(404).send('File not found');
  }
}

module.exports = method;
