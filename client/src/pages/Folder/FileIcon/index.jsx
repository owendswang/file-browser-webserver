import React from 'react';
import {
  PictureFilled,
  PlayCircleFilled,
  FolderOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePptOutlined,
  FilePdfOutlined,
  CustomerServiceOutlined,
  FileZipOutlined,
  AppleOutlined,
  LinuxOutlined,
  JavaScriptOutlined,
  FileOutlined,
  JavaOutlined,
  PythonOutlined,
  WindowsOutlined,
  MobileOutlined,
  FileUnknownOutlined,
  ConsoleSqlOutlined,
  CodeOutlined
} from '@ant-design/icons';

const FileIcon = (props) => {
  const { type, ...otherProps } = props;

  switch (type) {
    case 'Video File':
      return (<PlayCircleFilled {...otherProps} />);
    case 'Image File':
    case 'Ico File':
    case 'Vector Image':
      return (<PictureFilled {...otherProps} />);
    case 'Folder':
      return (<FolderOutlined {...otherProps} />);
    case 'Word Document':
      return (<FileWordOutlined {...otherProps} />);
    case 'Excel Spreadsheet':
      case 'Macro-Enabled Excel Spreadsheet':
        return (<FileExcelOutlined {...otherProps} />);
    case 'SQL Script':
      return (<ConsoleSqlOutlined {...otherProps} />);
    case 'Text File':
    case 'TypeScript File':
    case 'TypeScript React File':
    case 'JSON File':
    case 'HTML File':
    case 'CSS File':
    case 'C Source Code':
    case 'C++ Source Code':
      return (<FileTextOutlined {...otherProps} />);
    case 'Shell Script':
    case 'Batch Script':
    case 'Command Line Script':
    case 'PowerShell Script':
      return (<CodeOutlined {...otherProps} />);
    case 'PowerPoint Presentation':
      return (<FilePptOutlined {...otherProps} />);
    case 'PDF Document':
      return (<FilePdfOutlined {...otherProps} />);
    case 'Audio File':
    case 'Windows Media Audio File':
      return (<CustomerServiceOutlined {...otherProps} />);
    case 'Compressed File':
      return (<FileZipOutlined {...otherProps} />);
    case 'Mac Disk Image':
      return (<AppleOutlined {...otherProps} />);
    case 'Debian Package':
    case 'Linux Package':
      return (<LinuxOutlined {...otherProps} />);
    case 'JavaScript File':
      return (<JavaScriptOutlined {...otherProps} />);
    case 'Disk Image':
    case 'Dynamic Link Library':
    case 'Virtual Disk Image':
      return (<FileOutlined {...otherProps} />);
    case 'Java Source Code':
      return (<JavaOutlined {...otherProps} />);
    case 'Python Script':
      return (<PythonOutlined {...otherProps} />);
    case 'Windows Executable':
      return (<WindowsOutlined {...otherProps} />);
    case 'iOS Application Package':
      return (<MobileOutlined {...otherProps} />);
    default:
      return (<FileUnknownOutlined {...otherProps} />);
  }
}

export default FileIcon;