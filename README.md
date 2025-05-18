# File Browser

## 项目介绍

File Browser 是一个简洁的、网页端的文件管理软件，允许用户轻松的浏览、管理文件，包括但不限于上传、下载、重命名、移动、复制、删除文件或目录，甚至是压缩包中的对象（Linux下不支持RAR压缩包的修改），下载文件夹时会将文件夹打包成ZIP压缩包。

本项目建项初衷是为了方便的浏览压缩包中的图片和视频，所以其他功能可能不是很完善，请尽管提出，如有必要，我会进行修改。

### 功能介绍

- 文件和文件夹的上传和下载，支持压缩包内操作。
- 文件夹的创建、重命名、复制、移动和删除，文件的重命名、复制、移动和删除，支持压缩包内操作。
- 支持多种图片、视频、文本文件格式的预览。对于浏览器不支持的视频格式，会由服务端进行实时转码并交给浏览器播放。支持压缩包内预览。
- 简单的用户登录管理。默认管理员账号密码均为`admin`，并具有文件管理操作的权限。可在`/register`页面上注册新用户，但只拥有文件浏览权限。

### 演示视频

尚无。

### 功能亮点

- 借助 7-zip 、 WinRAR 、 FFmpeg 第三方工具的功能，以及 Viewer.js 和 Video.js 依赖包，实现了可以简单方便的浏览压缩包内的图片、视频。
- 简单的账号认证使用了 Oauth 2.0 标准，内建了 Oauth 2.0 服务器。

## 部署方法

要在本地环境中部署该项目，请按照以下步骤操作：

1. **下载**

   在 Releases 中下载最新的压缩包，解压后使用命令行进入解压出的项目目录。
   ```bash
   cd file-browser-webserver
   ```

   （下载的压缩包只包含 server 端，和 build 好的 client 文件，不包含 client 代码目录。）

2. **安装依赖**

   使用以下命令安装必要的依赖：
   ```bash
   npm install
   ```

3. **下载第三方工具**

   请根据下方列出引用的第三方工具列表，根据你的需要，下载相应的第三方工具软件，并安装。

4. **配置**

   根据部署的系统环境，复制项目目录中相应的 config.example.json 文件，并命名为 config.json 。

   根据你的软件安装目录、你的需求，修改 config.json 文件中的内容，或在项目运行起来后，在网页中配置也可以。

5. **运行项目**

   启动项目：
   ```bash
   npm start
   ```

6. **访问项目**

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

## 贡献

尚无。

## 支持

如果您遇到任何问题，请在 [Issues](https://github.com/owendswang/file-browser-webserver/issues) 中提交问题。
