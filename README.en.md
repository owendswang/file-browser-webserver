# File Browser

（中文介绍 -> [README](https://github.com/owendswang/file-browser-webserver/blob/main/README.md)）

## Project Introduction

File Browser is a simple web-based file management software that allows users to easily browse and manage files. This includes, but is not limited to, uploading, downloading, renaming, moving, copying, and deleting files or directories, and even objects within compressed packages (RAR package modification is not supported on ARM architecture Linux systems). When downloading folders, they will be packaged into a ZIP archive.

The initial intention of this project was to conveniently browse images and videos within compressed files, so other functions may not be very complete. Please feel free to provide suggestions. I will modify them if necessary.

### Development Background

I have many collections of images in compressed packages, and using compression software to browse them is cumbersome. That's why I developed this web software.

Occasionally, video files are encountered in compressed packages. However, browsers don't support playing them, so I developed real-time transcoding functionality. This feature was done based entirely on my ideas as I couldn't find references online. To implement real-time transcoding and enable progress dragging, it became somewhat complex and might not always run smoothly. Errors could occur in certain environments. If you encounter any issues or have development suggestions, please feel free to raise them.

In the era of AI, I received some assistance from AI during development, but I carefully reviewed the code to save some time. However, for development without references, AI doesn't help much.

### Features

- File and folder uploads and downloads, with support for operations within compressed files.
- Creation, renaming, copying, moving, and deletion of folders, and renaming, copying, moving, and deletion of files, with support for operations within compressed files.
- Preview support for various image, video, and text file formats. The server will perform real-time transcoding for browser-unsupported video formats to play them in the browser. Previewing within compressed files is supported.
- A simple user login management system. The default administrator username and password are both admin, and have file management operation permissions. New users can register on the /register page, but they only have file browsing permissions. Registered users need to be approved by the administrator on the user management page before they can log in.
- The page supports display in both Chinese and English.
- The page supports dark mode switching.

### Page Screenshots

[Jump to the bottom to see the images 👆🏻](#Screenshots)

### Feature Highlights
- tilizes third-party tools such as 7-zip, WinRAR, FFmpeg, and dependencies like Viewer.js and Video.js for convenient browsing of images and videos within compressed files.
- With the help of FFmpeg, formats unsupported by browsers can be transcoded in real-time, allowing for progress dragging, multi-audio track, embedded subtitles, and multi-resolution switching.
- The simple account authentication uses the Oauth 2.0 standard and built-in Oauth 2.0 server.
Thanks to Node.js and third-party software's multi-platform support, this software can be deployed on Windows and Linux systems. It has never been tested on MacOS.

## Deployment Method

To deploy the project locally, follow these steps:

1. **Download**

   Download the latest package from <a href="https://github.com/owendswang/file-browser-webserver/releases" target="_blank">Releases</a>, extract it, and use the command line to enter the extracted project directory.
   ```bash
   cd file-browser-webserver
   ```

   (The downloaded package only contains the server-side and the built client files, excluding the client code directory.)

2. **Install Dependencies**

   Use the following command to install necessary dependencies:
   ```bash
   npm run install
   ```

3. **Download Third-Party Tools**

   According to the list of third-party tools below, download and install the corresponding third-party tool software as needed.

4. **Configuration**

   Depending on the deployment system environment, copy the appropriate config.example.json file from the project directory and name it config.json.
   ```bash
   cp config.example.xxx.json config.json
   ```

   Modify the content in the config.json file according to your software installation directory and requirements. Alternatively, you can configure it on the webpage after running the project.

5. **Run the Project**

   Start the project:
   ```bash
   npm run start
   ```

6. **Access the Project**

   Open your browser and visit <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>.

   The default admin username and password are both `admin`.

7. **Docker**

   The project repository includes a docker-compose.yml file for reference.

## Special Thanks

### Third-Party Tools Used

This project utilizes the following third-party tools:

<a href="https://www.7-zip.org/" target="_blank">7-zip</a> - <a href="https://www.7-zip.org/license.txt" target="_blank">GNU LGPL, BSD 3-clause License / unRAR license</a>
<a href="https://ffmpeg.org/" target="_blank">FFmpeg</a> - <a href="https://ffmpeg.org/legal.html" target="_blank">GNU LGPL2.1, GNU GPL2</a>
<a href="https://www.win-rar.com/" target="_blank">WinRAR</a> - WinRAR license (Buy it)
<a href="https://www.smartmontools.org/" target="_blank">Smartmontools</a> - GNU GPL
<a href="https://nodejs.org" target="_blank">Node.js</a> - <a href="github.com/nodejs/node/blob/main/LICENSE" target="_blank">MIT License, Apache License Version 2.0, etc.</a>

When using this project, please comply with the licenses of the third-party software referenced.

Thanks to all the third-party tools used and their authors.

### Dependencies Used in Project Construction

<a href="https://github.com/fengyuanchen/viewerjs" target="_blank">Viewer.js</a> - MIT License
<a href="https://github.com/videojs/video.js" target="_blank">Video.js</a> - Apache License Version 2.0
<a href="https://github.com/expressjs/express" target="_blank">Express.js</a> - MIT License
<a href="https://github.com/facebook/react" target="_blank">React</a> - MIT License
<a href="https://github.com/ant-design/ant-design" target="_blank">Ant Design</a> - MIT License
<a href="https://github.com/ant-design/pro-components" target="_blank">Ant Design: ProComponents</a> - MIT License
<a href="https://github.com/webpack/webpack" target="_blank">Webpack</a> - MIT License

For other dependencies, please refer to the package.json file in the project code repository and comply with their licenses.

Thanks to all the dependencies used and their authors.

## Support

If you encounter any issues, please submit them in [Issues](https://github.com/owendswang/file-browser-webserver/issues).

## Screenshots
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
