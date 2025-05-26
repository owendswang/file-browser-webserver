# File Browser

(English version -> [README](https://github.com/owendswang/file-browser-webserver/blob/main/README.en.md))

## 项目介绍

File Browser 是一个简洁的、网页端的文件管理软件，允许用户轻松的浏览、管理文件，包括但不限于上传、下载、重命名、移动、复制、删除文件或目录，甚至是压缩包中的对象（ARM 架构的 Linux 系统下不支持RAR压缩包的修改），下载文件夹时会将文件夹打包成ZIP压缩包。

本项目建项初衷是为了方便的浏览压缩包中的图片和视频，所以其他功能可能不是很完善，请尽管提出，如有必要，我会进行修改。

### 开发背景

我有许多压缩包形式的图片合集，使用压缩软件浏览它们十分繁琐，所以开发了这个开发了这个网页软件。

压缩包里也会遇到一些视频文件，但是浏览器不支持播放，所以又开发了实时转码功能。这个功能我没能在网上找到参考，完全靠自己的想法做的。为了实现实时转码，可以拖拽进度，写的有点复杂，感觉不是很顺畅，某些环境下会出现故障。如有问题或者开发建议，请尽管提出。

届时AI兴起，开发过程中借助了AI的辅助，但代码我有仔细审查过，为我节省了一些时间，但对于未有过案例的开发，他能帮到的不多。

### 功能介绍

- 文件和文件夹的上传和下载，支持压缩包内操作。
- 文件夹的创建、重命名、复制、移动和删除，文件的重命名、复制、移动和删除，支持压缩包内操作。
- 支持多种图片、视频、文本文件格式的预览。对于浏览器不支持的视频格式，会由服务端进行实时转码并交给浏览器播放。支持压缩包内预览。
- 简单的用户登录管理。默认管理员账号密码均为`admin`，并具有文件管理操作的权限。可在`/register`页面上注册新用户，但只拥有文件浏览权限。注册过的用户，需要在管理员在用户管理页面里批准后，才可以登录。
- 页面支持中文、英文显示。
- 页面支持暗黑模式切换。
- 可查看文件夹所属磁盘的健康状态

### 页面展示

[跳转底部查看图片👆🏻](#页面截图)

### 功能亮点

- 借助 7-zip 、 WinRAR 、 FFmpeg 第三方工具的功能，以及 Viewer.js 和 Video.js 依赖包，实现了可以简单方便的浏览压缩包内的图片、视频。
- 借助 FFmpeg 实现浏览器播放不支持的格式，实时转码并支持进度拖拽，支持多音轨、内嵌字幕、多分辨率切换。
- 简单的账号认证使用了 Oauth 2.0 标准，内建了 Oauth 2.0 服务器。
- 得益于 Node.js 和第三方软件的多系统支持，可将本软件在 Windows 、 Linux 系统上部署，从未在 MacOS 上试过。
- 借助 Smartmontools 工具，可查看文件夹所属磁盘的健康状态、Smart 值。

## 部署方法

要在本地环境中部署该项目，请按照以下步骤操作：

1. **下载**

   在 <a href="https://github.com/owendswang/file-browser-webserver/releases" target="_blank">Releases</a> 中下载最新的压缩包，解压后使用命令行进入解压出的项目目录。
   ```bash
   cd file-browser-webserver
   ```

   （下载的压缩包只包含 server 端，和编译好的 client 文件，不包含 client 代码目录。）

2. **安装依赖**

   使用以下命令安装必要的依赖：
   ```bash
   npm run install
   ```

3. **下载第三方工具**

   请根据下方列出引用的第三方工具列表，根据你的需要，下载相应的第三方工具软件，并安装。

4. **配置**

   根据部署的系统环境，复制项目目录中相应的 config.example.json 文件，并命名为 config.json 。
   ```bash
   cp config.example.xxx.json config.json
   ```

   根据你的软件安装目录、你的需求，修改 config.json 文件中的内容，或在项目运行起来后，在网页中配置也可以。

5. **运行**

   启动项目：
   ```bash
   npm run start
   ```

6. **访问**

   打开您的浏览器，访问 <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>。
   
   默认管理员用户的账号密码同为 `admin` 。

7. **Docker**

   项目仓库中包含 docker-compose.yml 文件，可以参考。

## 特别鸣谢

### 引用的第三方工具

本项目使用了以下第三方工具：

- <a href="https://www.7-zip.org/" target="_blank">7-zip</a> - <a href="https://www.7-zip.org/license.txt" target="_blank">GNU LGPL, BSD 3-clause License / unRAR license</a>
- <a href="https://ffmpeg.org/" target="_blank">FFmpeg</a> - <a href="https://ffmpeg.org/legal.html" target="_blank">GNU LGPL2.1, GNU GPL2</a>
- <a href="https://www.win-rar.com/" target="_blank">WinRAR</a> - WinRAR license (Buy it)
- <a href="https://www.smartmontools.org/" target="_blank">Smartmontools</a> - GNU GPL
- <a href="https://nodejs.org" target="_blank">Node.js</a> - <a href="github.com/nodejs/node/blob/main/LICENSE" target="_blank">MIT License, Apache License Version 2.0, etc.</a>

在使用本项目时，请遵守所引用的第三方软件的许可证。

感谢所有使用到的第三方工具，感谢他们的作者。

### 项目构建所引用的依赖包

- <a href="https://github.com/fengyuanchen/viewerjs" target="_blank">Viewer.js</a> - MIT License
- <a href="https://github.com/videojs/video.js" target="_blank">Video.js</a> - Apache License Version 2.0
- <a href="https://github.com/expressjs/express" target="_blank">Express.js</a> - MIT License
- <a href="https://github.com/facebook/react" target="_blank">React</a> - MIT License
- <a href="https://github.com/ant-design/ant-design" target="_blank">Ant Design</a> - MIT License
- <a href="https://github.com/ant-design/pro-components" target="_blank">Ant Design: ProComponents</a> - MIT License
- <a href="https://github.com/webpack/webpack" target="_blank">Webpack</a> - MIT License

其他依赖包，请参考项目代码仓库中的 package.json 文件，并遵守他们的许可证。

感谢所有使用到的依赖包，感谢他们的作者。

## 支持

如果您遇到任何问题，请在 [Issues](https://github.com/owendswang/file-browser-webserver/issues) 中提交问题。

## 页面截图

![doc (1)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(1).png?raw=true)
![doc (2)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(2).png?raw=true)
![doc (3)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(3).png?raw=true)
![doc (4)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(4).png?raw=true)
![doc (5)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(5).png?raw=true)
![doc (6)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(6).png?raw=true)
![doc (7)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(7).png?raw=true)
![doc (8)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(8).png?raw=true)
![doc (9)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(9).png?raw=true)
![doc (10)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(10).png?raw=true)
![doc (11)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(11).png?raw=true)
![doc (12)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(12).png?raw=true)
![doc (13)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(13).png?raw=true)
![doc (14)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(14).png?raw=true)
![doc (15)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(15).png?raw=true)
![doc (16)](https://github.com/owendswang/file-browser-webserver/blob/main/docs/doc%20(16).png?raw=true)
