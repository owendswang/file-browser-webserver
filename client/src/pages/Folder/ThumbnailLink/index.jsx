import React, { useState/*, useEffect*/ } from 'react';
import { Link, useSearchParams } from "react-router";
import { Button, Checkbox, Dropdown } from "antd";
import {
  Loading3QuartersOutlined,
  InfoCircleOutlined,
  EllipsisOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExportOutlined,
  EditOutlined,
  DownloadOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import FileIcon from '@/pages/Folder/FileIcon';
import '@/pages/Folder/ThumbnailLink/index.css';

const ThumbnailLink = (props) => {
  const {
    file,
    size,
    setInitialViewIndex,
    setViewerjsVisible,
    allFiles,
    selectedKeys,
    setSelectedKeys,
    handleBriefClick,
    handleRenameClick,
    handleMoveClick,
    handleCopyClick,
    handleDeleteClick,
    handleDecompressClick,
    user,
    t,
    handleDragStart,
    handleDragEnd,
    handleDragEnterLink,
    handleDragLeaveLink,
    handleDropLink,
    handleDragOverLink
  } = props;

  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleImgLoad = (e) => {
    setLoading(false);
  };

  const handleImgError = (e) => {
    e.target.remove();
    setLoading(false);
    setLoadError(true);
  };

  const handleCheckboxChange = (file) => {
    if (selectedKeys.includes(file.name)) {
      setSelectedKeys(prev => prev.filter(name => (name !== file.name)));
    } else {
      setSelectedKeys(prev => [...prev, file.name]);
    }
  }

  const handleDropdwnOpenChange = (nextOpen, info) => {
    if (info.source === 'trigger' || nextOpen) {
      setDropdownOpen(nextOpen);
    }
  };

  const handleDropdownClick = ({ domEvent, item, key, keyPath }) => {
    domEvent.stopPropagation();
    setDropdownOpen(false);
    if (key === 'download') {
      const a = document.createElement('a');
      a.href = `${file.path.replace(/^\/(folder|view|vaplay)\//, '/download/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`;
      a.style = { display: 'none' };
      a.target = '_blank';
      a.download = 'example-file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (key === 'rename') {
      handleRenameClick(file.name);
    } else if (key === 'move') {
      handleMoveClick(file.name);
    } else if (key === 'copy') {
      handleCopyClick(file.name);
    } else if (key === 'delete') {
      handleDeleteClick(file.name);
    } else if (key === 'brief') {
      handleBriefClick(file.name);
    } else if (key === 'decompress') {
      handleDecompressClick(file.name);
    }
  }

  const dropdownItems = (user.scope && user.scope.includes('admin')) ? [{
    key: 'download',
    icon: <DownloadOutlined />,
    label: t('Download'),
  }, {
    key: 'rename',
    icon: <EditOutlined />,
    label: t('Rename'),
  }, {
    key: 'move',
    icon: <ExportOutlined />,
    label: t('Move'),
  }, {
    key: 'copy',
    icon: <CopyOutlined />,
    label: t('Copy'),
  }, {
    key: 'delete',
    icon: <DeleteOutlined />,
    label: t('Delete'),
  }, {
    key: 'brief',
    icon: <InfoCircleOutlined />,
    label: t('Info'),
  }, (file.type === 'Compressed File') && ({
    key: 'decompress',
    icon: <FolderOpenOutlined />,
    label: t('Decompress'),
  })].filter(Boolean) : [{
    key: 'download',
    icon: <DownloadOutlined />,
    label: t('Download'),
  }, {
    key: 'brief',
    icon: <InfoCircleOutlined />,
    label: t('Info'),
  }];

  if (['Image File', 'Ico File', 'Video File'].includes(file.type)) {
    return (
      <Link
        title={`${file.name}${file.encrypted ? ' *' : ''}`}
        to={`${file.path}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
        onClick={(e) => {
          if (selectedKeys.length > 0) {
            e.preventDefault();
            handleCheckboxChange(file);
          } else if (file.type !== 'Video File' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            const allImages = allFiles.filter(item => ['Image File', 'Ico File'].includes(item.type));
            const imageIndex = allImages.findIndex(image => image.name === file.name);
            setInitialViewIndex(imageIndex);
            setViewerjsVisible(true);
          }
          // document.activeElement.blur();
        }}
        className={`thumbnailLink${selectedKeys.includes(file.name) ? ' thumbnailLinkChecked' : ''}`}
        style={{
          // width: `${size}px`,
          height: `${size}px`,
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragEnterLink}
        onDragLeave={handleDragLeaveLink}
        onDrop={handleDropLink}
        onDragOver={handleDragOverLink}
      >
        <img
          className={`thumbnailLayer thumbnailImg${['Image File', 'Ico File'].includes(file.type) ? ' thumbnailForImage' : ''}`}
          style={loadError ? {
            objectFit: 'contain',
            width: '50%',
            height: '50%',
            opacity: '0.5',
          } : {}}
          src={`${file.path.replace(/^\/(view|vaplay)\//g, '/preview/')}.webp${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
          data-src={`${file.path.replace(/^\/(view|vaplay)\//g, '/download/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
          onLoad={handleImgLoad}
          onError={handleImgError}
        />
        <div
          className="thumbnailLayer loadingLayer"
          style={{ opacity: loading ? '1' : '0' }}
        >
          <Loading3QuartersOutlined spin={true} style={{ fontSize: `${size / 3}px` }} />
        </div>
        <div className={`thumbnailLayer iconLayer${loadError ? '' : ' thumbnailMediaIcon'}`}>
          <FileIcon type={file.type} style={{ fontSize: `${size / 3}px`, transform: 'translateY(-15%)' }} />
        </div>
        <div className={`thumbnailLayer thumbnailText${(loading || loadError) ? '' : ' thumbnailMediaText'}`}>
          {file.name}{file.encrypted ? ' *' : ''}
        </div>
        <div className={`thumbnailLayer clickableLayer${(loading || loadError) ? '' : ' thumbnailMediaClickable'}`}>
          <Checkbox
            className="fileSelectCheckbox"
            checked={selectedKeys.includes(file.name)}
            onClick={(e) => { e.preventDefault(); handleCheckboxChange(file); }}
          />
          <Dropdown
            menu={{ items: dropdownItems, onClick: handleDropdownClick }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <Button
              className="thumbnailDropdownBtn"
              icon={<EllipsisOutlined />}
              size="small"
              type="link"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />
          </Dropdown>
        </div>
      </Link>
    );
  } else {
    return (
      <Link
        title={`${file.name}${file.encrypted ? ' *' : ''}`}
        target={file.path.startsWith('/download/') ? '_blank' : '_self'}
        to={file.path.startsWith('/download/') ?
          `${file.path}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}` :
          file.path
        }
        onClick={(e) => {
          if (selectedKeys.length > 0) {
            e.preventDefault();
            handleCheckboxChange(file);
          }
        }}
        className={`thumbnailLink${selectedKeys.includes(file.name) ? ' thumbnailLinkChecked' : ''}`}
        style={{
          // width: `${size}px`,
          height: `${size}px`,
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOverLink}
      >
        <div className="thumbnailLayer iconLayer">
          <FileIcon type={file.type} style={{ fontSize: `${size / 3}px`, transform: 'translateY(-15%)' }} />
        </div>
        <div className="thumbnailLayer thumbnailText">
          {file.name}{file.encrypted ? ' *' : ''}
        </div>
        <div className="thumbnailLayer clickableLayer">
          <Checkbox
            className="fileSelectCheckbox"
            checked={selectedKeys.includes(file.name)}
            onClick={(e) => { e.preventDefault(); handleCheckboxChange(file); }}
          />
          <Dropdown
            menu={{ items: dropdownItems, onClick: handleDropdownClick }}
            placement="bottomRight"
            trigger={["click"]}
            open={dropdownOpen}
            onOpenChange={handleDropdwnOpenChange}
          >
            <Button
              className="thumbnailDropdownBtn"
              icon={<EllipsisOutlined />}
              size="small"
              type="link"
              onClick={(e) => { e.preventDefault(); }}
            />
          </Dropdown>
        </div>
      </Link>
    );
  }
}

export default ThumbnailLink;