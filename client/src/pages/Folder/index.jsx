import React, { useState, useEffect, Fragment } from 'react';
import { Link, useParams, useSearchParams, useLocation, useNavigate, useOutletContext } from "react-router";
import { Helmet } from "react-helmet";
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Table,
  message,
  Modal,
  Form,
  Input,
  Segmented,
  Space,
  Flex,
  Empty,
  Slider,
  Pagination,
  Button,
  Typography,
  Switch,
  Select,
  FloatButton,
  Upload,
  Dropdown,
  Checkbox,
  notification,
  Progress,
  Spin,
  Grid
} from 'antd';
import {
  AppstoreOutlined,
  BarsOutlined,
  LockOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  DeleteOutlined,
  ExportOutlined,
  CopyOutlined,
  FolderAddOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  EditOutlined
} from '@ant-design/icons';
import * as dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import folderService from '@/services/folder';
import ThumbnailLink from '@/pages/Folder/ThumbnailLink';
import ViewerJS from '@/components/ViewerJS';
import handleErrorContent from '@/utils/handleErrorContent';
import axios from '@/utils/axios';
import FileIcon from '@/pages/Folder/FileIcon';
import MoveModal from '@/pages/Folder/MoveModal';
import MkDirModal from '@/pages/Folder/MkDirModal';
import RenameModal from '@/pages/Folder/RenameModal';
import DecompressModal from '@/pages/Folder/DecompressModal';
import BriefPanel from '@/pages/Folder/BriefPanel';
import './index.css';

const { Text, Paragraph } = Typography;
const { Column } = Table;
const { useBreakpoint } = Grid;

const defaultPageSize = 50;
const defaultThumbnailSize = 154;
const defaultViewMode = 'table';
const defaultSortBy = 'modified';
const defaultOrder = 'desc';

const Folder = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const { t } = useTranslation('Folder');

  const { '*': originalPathname } = useParams();
  const pathname = encodeURIComponent(originalPathname).replaceAll('%2F', '/');
  const pathParts = pathname.split('/').filter(Boolean);
  const curDirName = decodeURIComponent(pathParts[pathParts.length - 1]);

  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [formRef] = Form.useForm();
  const screens = useBreakpoint();

  const [user] = useOutletContext();

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [needsPwd, setNeedsPwd] = useState(false);
  const [hasEncryption, setHasEncryption] = useState(false);
  const [archivePasswordModalOkButtonDisabled, setArchivePasswordModalOkButtonDisabled] = useState(true);
  const [archivePasswordModalVisible, setArchivePasswordModalVisible] = useState(false);
  const [initialViewIndex, setInitialViewIndex] = useState(0);
  const [viewerjsVisible, setViewerjsVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [refreshTag, setRefreshTag] = useState(0);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveModalTitle, setMoveModalTitle] = useState('');
  const [mkDirModalOpen, setMkDirModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [decompressModalOpen, setDecompressModalOpen] = useState(false);
  const [fileToBrief, setFileToBrief] = useState('');
  const [briefHidden, setBriefHidden] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingLink, setIsDraggingLink] = useState(false);

  const allSelected = data.length > 0 && data.length === selectedRowKeys.length;
  const indeterminated = data.length > selectedRowKeys.length && selectedRowKeys.length > 0;

  const breadcrumbItems = pathParts.map((part, idx) => {
    if ((idx === pathParts.length - 1)) {
      return { title: decodeURIComponent(part) };
    } else {
      return { title: <Link
        to={`/folder/${pathParts.slice(0, idx + 1).join('/')}`}
        draggable={false}
        // style={{ pointerEvents: isDraggingLink ? 'none' : null }}
      >{decodeURIComponent(part)}</Link> };
    }
  });

  useEffect(() => {
    const urlSearchParams = new URLSearchParams(searchParams.toString());
    urlSearchParams.forEach((value, key) => {
      if (!['page', 'search', 'archivePassword'].includes(key)) {
        window.localStorage.setItem(key, String(value));
      }
    });
    /*Object.keys(window.localStorage).forEach((key) => {
      if (!urlSearchParams.get(key)) {
        window.localStorage.removeItem(key);
      }
    });*/
  }, [searchParams]);

  const fetchData = async (signal) => {
    setLoading(true);
    setSelectedRowKeys([]);
    const params = {
      page: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || parseInt(window.localStorage.getItem("pageSize")) || defaultPageSize,
      sortBy: searchParams.get('sortBy') || window.localStorage.getItem("sortBy") || defaultSortBy,
      order: searchParams.get('order') || window.localStorage.getItem("order") || defaultOrder,
      search: searchParams.get('search') || '',
      archivePassword: searchParams.get('archivePassword') || '',
    };
    try {
      const res = await folderService.getList(pathname, params, signal);
      if (res?.files && Array.isArray(res.files)) {
        if (res.files.length > 0 || (parseInt(searchParams.get('page')) || 1) === 1) {
          setData(res.files);
          setTotal(res.pagination.total);
          setNeedsPwd(res.needsPassword);
          setHasEncryption(res.needsPassword || res.files.some(file => file.encrypted));
        } else {
          setSearchParams((prevParams) => {
            prevParams.set('page', (parseInt(prevParams.get('page')) - 1).toString());
            return prevParams;
          });
        }
      }
    } catch(e) {
      console.error(e);
      if (!['canceled', 'error.response is undefined'].includes(e.message)) {
        messageApi.error(`${t('Failed to fetch data: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  };

  const updateSearchParams = (params) => {
    setSearchParams((prevParams) => {
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          prevParams.delete(key);
          window.localStorage.removeItem(key);
        } else {
          prevParams.set(key, String(value));
        }
      });
      return prevParams;
    }, { replace: true, preventScrollReset: true });
  };

  const handleTableChange = (pagination, _, sorter) => {
    updateSearchParams({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortBy: sorter.field,
      order: sorter.order ? sorter.order.replace(/end$/, '') : null,
    });
  };

  const refresh = () => {
    setLoading(true);
    setRefreshTag(refreshTag + 1);
  }

  const onInputSearchSubmit = (value) => {
    updateSearchParams({ page: 1, search: value });
  };

  const handleViewModeChange = (view) => {
    updateSearchParams({ view });
  };

  const handleSliderChange = (thumbnailSize) => {
    updateSearchParams({ thumbnailSize });
  };

  const handleOrderSwitchChange = (checked) => {
    updateSearchParams({ order: checked ? 'desc' : 'asc' });
  };

  const handleSortBySelectChange = (sortBy) => {
    updateSearchParams({ sortBy, page: 1 });
  };

  const handleRefreshButtonClick = () => {
    refresh();
  };

  const handleLoadMoreClick = () => {
    updateSearchParams({ page: (parseInt(searchParams.get('page')) || 1) + 1 });
  };

  const handleLoadPreviousClick = () => {
    updateSearchParams({ page: (parseInt(searchParams.get('page')) || 1) - 1 });
  };

  const handleArchivePasswordModalOk = () => {
    const archivePassword = formRef.getFieldValue('archivePassword');
    updateSearchParams({ archivePassword });
    setArchivePasswordModalVisible(false);
    setRefreshTag(refreshTag + 1);
  };

  const handleArchivePasswordInputChange = (e) => {
    setArchivePasswordModalOkButtonDisabled(e.target.value === '');
  };

  const handleUploadFileChange = ({ file, fileList, event }) => {
    // console.log({ file, fileList, event });
    if (file.status === 'done') {
      notificationApi.open({
        key: file.uid,
        message: `${t('Uploaded: ')}${t('l"')}${file.name}${t('r"')}`,
        description: <Progress percent={Math.round(file.percent)} status="success" />,
        icon: <CheckCircleFilled style={{ color: '#52c41a' }} />,
        duration: 3,
        closeIcon: true,
        role: 'status',
        placement: 'bottomRight',
      });
      refresh();
    } else if (file.status === 'uploading') {
      notificationApi.open({
        key: file.uid,
        message: `${t('Uploading: ')}${t('l"')}${file.name}${t('r"')}`,
        description: <Progress percent={Math.round(file.percent)} status="active" />,
        icon: <SyncOutlined spin style={{ color: '#1890ff' }} />,
        duration: null,
        closeIcon: false,
        role: 'status',
        placement: 'bottomRight',
      });
    } else if (file.status === 'error') {
      notificationApi.open({
        key: file.uid,
        message: `${t('Upload error: ')}${t('l"')}${file.name}${t('r"')}`,
        description: <Progress percent={Math.round(file.percent)} status="exception" />,
        icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
        duration: null,
        closeIcon: true,
        role: 'status',
        placement: 'bottomRight',
      });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    setViewerjsVisible(false);
    
    setBriefHidden(true);
    setFileToBrief('');
    return () => {
      controller.abort();
    }
  }, [
    location.pathname,
    searchParams.get('page'),
    searchParams.get('pageSize'),
    searchParams.get('archivePassword'),
    searchParams.get('sortBy'),
    searchParams.get('order'),
    searchParams.get('search'),
    refreshTag
  ]);

  useEffect(() => {
    setArchivePasswordModalVisible(needsPwd);
  }, [needsPwd]);

  const viewerjsOptions = {
    toolbar: {
      zoomIn: 1,
      zoomOut: 1,
      oneToOne: 1,
      reset: 1,
      prev: 0,
      play: {
        show: 1,
        size: "large",
      },
      next: 0,
      rotateLeft: 1,
      rotateRight: 1,
      flipHorizontal: 1,
      flipVertical: 1,
    },
    navbar: true,
    initialViewIndex,
    title(imgDom, infoObj) {
      return `${imgDom.alt.replace(/\.webp$/, '')} (${infoObj.naturalWidth}x${infoObj.naturalHeight})`;
    },
    keyboard: true,
    fullscreen: true,
    zIndex: 2000,
    zoomRatio: 1,
    inline: false,
    url(image) {
      const src = image.getAttribute('data-src');
      return src;
    },
    filter(image) {
      return image.classList.contains('thumbnailForImage');
    },
  };

  const handleDeleteClick = (name) => {
    // console.log(pn);
    setSelectedRowKeys([name]);
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete it?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        try {
          if (!name) {
            throw new Error(t('Nothing to delete'));
          }
          await folderService.delete(pathname, [name], searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
          refresh();
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        }
      },
      onCancel: () => {
        setSelectedRowKeys([]);
      }
    });
  }

  const handleBulkDelete = (e) => {
    // console.log('trying to delete: ', selectedRowKeys);
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete them?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        try {
          await folderService.delete(pathname, selectedRowKeys, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
          refresh();
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        }
      }
    });
  }

  const handleMoveClick = (name) => {
    // console.log(name);
    setSelectedRowKeys([name]);
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleCopyClick = (name) => {
    // console.log(name);
    setSelectedRowKeys([name]);
    setMoveModalOpen(true);
    setMoveModalTitle('Copy');
  }

  const handleBulkMove = (e) => {
    // console.log('trying to move: ', selectedRowKeys.join(', '));
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleBulkCopy = (e) => {
    e.preventDefault();
    // console.log('trying to copy: ', selectedRowKeys.join(', '));
    setMoveModalOpen(true);
    setMoveModalTitle('Copy');
  }

  const handleBulkDecompress = (e) => {
    // console.log('trying to decompress: ', selectedRowKeys.join(', '));
    setDecompressModalOpen(true);
  }

  const handleRenameClick = (name) => {
    // console.log(name);
    setSelectedRowKeys([name]);
    setRenameModalOpen(true);
  }

  const handleRenameBtnClick = (e) => {
    setRenameModalOpen(true);
  }

  const handleMkDirBtnClick = (e) => {
    setMkDirModalOpen(true);
  }

  const handleSelectAll = (e) => {
    if (allSelected) {
      setSelectedRowKeys([]);
    } else {
      setSelectedRowKeys(data.map((item) => item.name));
    }
  }

  const handleBriefClick = (fileName) => {
    setBriefHidden(false);
    setFileToBrief(fileName);
  }

  const handleDecompressClick = (name) => {
    setSelectedRowKeys([name]);
    setDecompressModalOpen(true);
  }

  const handleDragStart = (event) => {
    // console.log('drag start', event);
    setIsDraggingLink(true);
    const fileName = decodeURIComponent(event.target.href.split('/')[event.target.href.split('/').length - 1]);
    if (selectedRowKeys.length > 0 && selectedRowKeys.includes(fileName)) {
      event.dataTransfer.setData('text/plain', JSON.stringify(selectedRowKeys));
    } else {
      setSelectedRowKeys([]);
      event.dataTransfer.setData('text/plain', JSON.stringify([fileName]));
    }
    if ((searchParams.get('view') || window.localStorage.getItem('view') || defaultViewMode) === 'thumbnails') {
      event.target.classList.add('thumbnailLink-disabled');
      const folderLinks = document.body.querySelectorAll('.thumbnailLink');
      const folderPathStart = `${window.location.protocol}//${window.location.host}/folder/`;
      for (const folderLink of folderLinks) {
        const folderName = decodeURIComponent(folderLink.href.split('/')[folderLink.href.split('/').length - 1]);
        if (!(folderLink.href && folderLink.href.startsWith(folderPathStart) && !selectedRowKeys.includes(folderName))) {
          folderLink.classList.add('thumbnailLink-disabled');
        }
      }
    } else {
      event.target.classList.add('folder-file-link-disabled');
      const folderLinks = document.body.querySelectorAll('.tableRowFileNameLink');
      const folderPathStart = `${window.location.protocol}//${window.location.host}/folder/`;
      for (const folderLink of folderLinks) {
        const folderName = decodeURIComponent(folderLink.href.split('/')[folderLink.href.split('/').length - 1]);
        if (!(folderLink.href && folderLink.href.startsWith(folderPathStart) && !selectedRowKeys.includes(folderName))) {
          folderLink.classList.add('folder-file-link-disabled');
        }
      }
      const folderHoverLinks = document.body.querySelectorAll('.tableRowFileNameHoverLink');
      for (const folderHoverLink of folderHoverLinks) {
        folderHoverLink.classList.add('folder-file-hover-link-disabled');
      }
    }
  }

  const handleDragEnd = (event) => {
    // console.log('drag end', event);
    setIsDraggingLink(false);
    if ((searchParams.get('view') || window.localStorage.getItem('view') || defaultViewMode) === 'thumbnails') {
      event.target.classList.remove('thumbnailLink-disabled');
      const folderLinks = document.body.querySelectorAll('.thumbnailLink');
      const folderPathStart = `${window.location.protocol}//${window.location.host}/folder/`;
      for (const folderLink of folderLinks) {
        const folderName = decodeURIComponent(folderLink.href.split('/')[folderLink.href.split('/').length - 1]);
        if (!(folderLink.href && folderLink.href.startsWith(folderPathStart) && !selectedRowKeys.includes(folderName))) {
          folderLink.classList.remove('thumbnailLink-disabled');
        }
      }
    } else {
      event.target.classList.remove('folder-file-link-disabled');
      const folderLinks = document.body.querySelectorAll('.tableRowFileNameLink');
      const folderPathStart = `${window.location.protocol}//${window.location.host}/folder/`;
      for (const folderLink of folderLinks) {
        const folderName = decodeURIComponent(folderLink.href.split('/')[folderLink.href.split('/').length - 1]);
        if (!(folderLink.href && folderLink.href.startsWith(folderPathStart) && !selectedRowKeys.includes(folderName))) {
          folderLink.classList.remove('folder-file-link-disabled');
        }
      }
      const folderHoverLinks = document.body.querySelectorAll('.tableRowFileNameHoverLink');
      for (const folderHoverLink of folderHoverLinks) {
        folderHoverLink.classList.remove('folder-file-hover-link-disabled');
      }
    }
  }

  const handleDragEnterLink = (event) => {
    // console.log('link drag enter', event);
    event.preventDefault();
    const tableRow = event.target.closest('tr');
    if (tableRow) {
      tableRow.style.backgroundColor = 'rgba(0, 145, 255, 0.1)';
    }
    const thumbnailLink = event.target.closest('a.thumbnailLink');
    if (thumbnailLink) {
      thumbnailLink.style.backgroundColor = 'rgba(0, 100, 182, 0.3)';
    }
  }

  const handleDragLeaveLink = (event) => {
    // console.log('link drag leave', event);
    event.preventDefault();
    const tableRow = event.target.closest('tr');
    if (tableRow) {
      tableRow.style.backgroundColor = null;
    }
    const thumbnailLink = event.target.closest('a.thumbnailLink');
    if (thumbnailLink) {
      thumbnailLink.style.backgroundColor = null;
    }
  }

  const handleDropLink = async (event) => {
    // console.log('link drop', event.dataTransfer.getData('text/plain'));
    event.preventDefault();
    const tableRow = event.target.closest('tr');
    if (tableRow) {
      tableRow.style.backgroundColor = null;
    }
    const thumbnailLink = event.target.closest('a.thumbnailLink');
    if (thumbnailLink) {
      thumbnailLink.style.backgroundColor = null;
    }
    // const folderName = decodeURIComponent(event.target.closest('a.thumbnailLink').href.split('/')[event.target.closest('a.thumbnailLink').href.split('/').length - 1]);
    await folderService.move(pathname, JSON.parse(event.dataTransfer.getData('text/plain')), decodeURIComponent(event.target.closest('a').href.replace(new RegExp(`^${window.location.protocol}//${window.location.host}/folder/`), '')), searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
    refresh();
  }

  const handleDragOverLink = (event) => {
    // console.log('link drag over', event);
    event.preventDefault();
  };

  useEffect(() => {
    const handleDragOver = (event) => {
      // console.log('drag over', event);
      event.preventDefault();
    };

    const handleDragEnter = (event) => {
      // console.log('drag enter', event);
      event.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (event) => {
      // console.log('drag leave', event);
      event.preventDefault();
      if (event.target.id === 'dragging-overlay' || event.target.closest('#dragging-overlay')) {
        setIsDragOver(false);
      }
    };

    const handleDrop = async (event) => {
      // console.log('drop', event);
      event.preventDefault();
      setIsDragOver(false);

      const items = event.dataTransfer.items;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          files.push(item);
        }
      }

      if (files.length > 0) {
        const newFiles = [];

        const readDirectory = (entry, newFiles, currentPath) => {
          return new Promise((resolve) => {
            const dirReader = entry.createReader();
            dirReader.readEntries((entries) => {
              const promises = entries.map((ent) => {
                return new Promise((resolveEntry) => {
                  const newRelativePath = currentPath ? `${currentPath}/${ent.name}` : ent.name;
                  if (ent.isFile) {
                    ent.file((file) => {
                      newFiles.push({ file, relativePath: newRelativePath });
                      resolveEntry();
                    });
                  } else if (ent.isDirectory) {
                    readDirectory(ent, newFiles, newRelativePath).then(resolveEntry);
                  } else {
                    resolveEntry();
                  }
                });
              });
              Promise.all(promises).then(() => resolve());
            });
          });
        };

        for (const file of files) {
          const entry = file.webkitGetAsEntry();
          if (entry) {
            if (entry.isDirectory) {
              await readDirectory(entry, newFiles, entry.name);
            } else {
              const file = file.getAsFile();
              newFiles.push({ file });
            }
          }
        }

        const uploadFiles = async (filesToUpload) => {
          for (const fileToUpload of filesToUpload) {
            // console.log(fileToUpload);
            const { file, relativePath } = fileToUpload;
            const formData = new FormData();
            formData.append('lastModified', file.lastModified);
            if (relativePath) {
              formData.append('relativePath', relativePath);
            }
            formData.append('file', file);
            try {
              const response = await axios.post(
                `/upload/${pathname}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`,
                formData,
                {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  onUploadProgress: function ({loaded, total, progress, bytes, estimated, rate, upload = true}) {
                    if (progress === 1) {
                      notificationApi.open({
                        key: `${file.name}-${file.lastModified}`,
                        message: `${t('Uploaded: ')}${t('l"')}${file.name}${t('r"')}`,
                        description: <Progress percent={100} status="success" />,
                        icon: <CheckCircleFilled style={{ color: '#52c41a' }} />,
                        duration: 3,
                        closeIcon: true,
                        role: 'status',
                        placement: 'bottomRight',
                      });
                    } else {
                      notificationApi.open({
                        key: `${file.name}-${file.lastModified}`,
                        message: `${t('Uploading: ')}${t('l"')}${file.name}${t('r"')}`,
                        description: <Progress percent={Math.round(progress * 100)} status="active" />,
                        icon: <SyncOutlined spin style={{ color: '#1890ff' }} />,
                        duration: null,
                        closeIcon: false,
                        role: 'status',
                        placement: 'bottomRight',
                      });
                    }
                  },
                }
              );
            } catch(e) {
              console.error(`Error uploading ${file.name}:`, e);
              notificationApi.open({
                key: `${file.name}-${file.lastModified}`,
                message: `${t('Upload error: ')}${t('l"')}${file.name}${t('r"')}`,
                description: <Progress percent={100} status="exception" />,
                icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
                duration: null,
                closeIcon: true,
                role: 'status',
                placement: 'bottomRight',
              });
            }
          }
        };

        await uploadFiles(newFiles);
        refresh();
      } else {
        messageApi.error(t('Not supported'));
      }
    };

    if (!isDraggingLink) {
      window.addEventListener('dragover', handleDragOver, true);
      window.addEventListener('dragenter', handleDragEnter, true);
      window.addEventListener('dragleave', handleDragLeave, true);
      window.addEventListener('drop', handleDrop, true);
    }

    return () => {
      if (!isDraggingLink) {
        window.removeEventListener("dragover", handleDragOver, true);
        window.removeEventListener("dragenter", handleDragEnter, true);
        window.removeEventListener("dragleave", handleDragLeave, true);
        window.removeEventListener("drop", handleDrop, true);
      }
    };
  }, [location.pathname, isDraggingLink]);

  return (
    <PageContainer
      title={curDirName}
      breadcrumb={{ items: breadcrumbItems }}
      onBack={() => navigate(-1)}
      extra={<Space wrap={screens.md ? false : true}>
        <div
          key='sliderLabel'
          style={{ display: (searchParams.get('view') || window.localStorage.getItem("view")) === 'thumbnails' ? 'block' : 'none' }}
        >{t('Thumbnail Size:')}</div>
        <Slider
          key='slider'
          value={parseInt(searchParams.get('thumbnailSize')) || parseInt(window.localStorage.getItem('thumbnailSize')) || defaultThumbnailSize}
          min={100}
          max={300}
          onChange={handleSliderChange}
          style={{ width: '200px', display: (searchParams.get('view') || window.localStorage.getItem("view")) === 'thumbnails' ? 'block' : 'none' }}
        />
        <div key='switchLabel'>{t('View Mode:')}</div>
        <Segmented
          key='switch'
          options={[
            { label: t('Table'), value: 'table', icon: <BarsOutlined /> },
            { label: t('Thumbnails'), value: 'thumbnails', icon: <AppstoreOutlined /> },
          ]}
          value={searchParams.get('view') || window.localStorage.getItem("view") || defaultViewMode}
          onChange={handleViewModeChange}
        />
      </Space>}
    >
      <Helmet>
        <title>{curDirName} - {t('File Browser')}</title>
      </Helmet>
      {messageContextHolder}
      {notificationContextHolder}
      {modalContextHolder}
      <ProCard
        className="folderCardWrapper"
        title={<div className='folderCardTitle'>
          {(user.scope && user.scope.includes('admin')) && <div key='upload' className='dropdownButtonGroup' style={{ pointerEvents: isDraggingLink ? 'none' : null }}>
            <Upload
              name="file"
              multiple={true}
              action={`/api/upload/${pathname}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
              data={(file) => ({ lastModified: file.lastModified })}
              showUploadList={false}
              onChange={handleUploadFileChange}
            >
              <Button icon={<UploadOutlined />} className='dropdownButtonGroupLeft'>{t('Upload')}</Button>
            </Upload>
            <Dropdown
              menu={{
                items: [{
                  key: 0,
                  label: <Upload
                    name="file"
                    directory={true}
                    action={`/api/upload/${pathname}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                    data={(file) => ({ lastModified: file.lastModified, relativePath: file.relativePath || file.webkitRelativePath })}
                    showUploadList={false}
                    onChange={handleUploadFileChange}
                  >{t('Upload Directory')}</Upload>
                }]
              }}
              placement="bottomRight"
            >
              <Button icon={<DownOutlined />} className='dropdownButtonGroupRight'></Button>
            </Dropdown>
          </div>}
          {(user.scope && user.scope.includes('admin')) && <div key='bulkMove' className='dropdownButtonGroup'>
            <Button
              key='bulkMove'
              icon={<ExportOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBulkMove}
              className='dropdownButtonGroupLeft'
            >{t('Move')}</Button>
            <Dropdown
              menu={{
                items: [{
                  key: 0,
                  label: <a
                    key='bulkCopy'
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleBulkCopy}
                  ><CopyOutlined style={{ marginRight: '8px' }} />{t('Copy')}</a>
                }]
              }}
              placement="bottomRight"
              disabled={selectedRowKeys.length === 0}
            >
              <Button icon={<DownOutlined />} className='dropdownButtonGroupRight'></Button>
            </Dropdown>
          </div>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key='bulkDecompress'
            icon={<FolderOpenOutlined />}
            disabled={selectedRowKeys.filter(fileName => data.find(file => file.name === fileName).type === 'Compressed File').length === 0}
            onClick={handleBulkDecompress}
          >{t('Decompress')}</Button>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key='bulkDelete'
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBulkDelete}
          >{t('Delete')}</Button>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key="rename"
            icon={<EditOutlined />}
            disabled={selectedRowKeys.length !== 1}
            onClick={handleRenameBtnClick}
          >{t('Rename')}</Button>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key="mkDir"
            icon={<FolderAddOutlined />}
            onClick={handleMkDirBtnClick}
          >{t('Create Directory')}</Button>}
          {((searchParams.get('view') || window.localStorage.getItem("view") || defaultViewMode) === 'thumbnails') && <Checkbox
            key="selectAll"
            onChange={handleSelectAll}
            checked={allSelected}
            indeterminate={indeterminated}
            style={{ marginLeft: 'auto' }}
          >{t('Select All')}</Checkbox>}
          {hasEncryption && <Button
            key='inputPassword'
            onClick={() => setArchivePasswordModalVisible(true)}
          >{t('Input Password')}</Button>}
          {(searchParams.get('view') || window.localStorage.getItem('view')) === 'thumbnails' && <Select
            key="sortBy"
            options={[
              { value: 'name', label: t('Name') },
              { value: 'type', label: t('Type') },
              { value: 'size', label: t('Size') },
              { value: 'modified', label: t('Modified Time') },
            ]}
            style={{ width: '140px' }}
            onChange={handleSortBySelectChange}
            loading={loading}
            value={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy)}
            allowClear={true}
            placeholder={t("Sort By")}
            title={t("Sort By")}
          />}
          {(searchParams.get('view') || window.localStorage.getItem('view')) === 'thumbnails' && <Switch
            key='order'
            checkedChildren="DESC"
            unCheckedChildren="ASC"
            checked={(searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) === 'desc'}
            onChange={handleOrderSwitchChange}
            loading={loading}
            title={t("Order")}
          />}
          <Input.Search
            key='search'
            loading={loading}
            onSearch={onInputSearchSubmit}
            defaultValue={searchParams.get('search') || ''}
            allowClear={true}
            style={{ width: '200px', marginLeft: ((searchParams.get('view') || window.localStorage.getItem('view')) === 'thumbnails') ? undefined : 'auto' }}
            title={t("Search")}
          />
          <Button
            key='refresh'
            type="link"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRefreshButtonClick}
            size="small"
            title={t("Refresh")}
          ></Button>
        </div>}
      >
        <Spin spinning={loading}>
          {data.length > 0 ? <Fragment>
            <Flex gap="small" wrap={false}>
              <ProCard ghost={true}>
                {(data.length < Math.min((parseInt(searchParams.get('page')) || 1) * (parseInt(searchParams.get('pageSize')) || parseInt(window.localStorage.getItem("pageSize")) || defaultPageSize), total)) && <Button
                  onClick={handleLoadPreviousClick}
                  block={true}
                  variant="outlined"
                  style={{ marginBottom: '16px' }}
                >{t('Previous Page')}</Button>}
                {(searchParams.get('view') || window.localStorage.getItem('view')) !== 'thumbnails' && <Table
                  dataSource={data}
                  // loading={loading}
                  rowKey='name'
                  // size='small'
                  bordered={false}
                  pagination={false}
                  onChange={handleTableChange}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
                  }}
                  scroll={{
                    x: 'max-content',
                    scrollToFirstRowOnChange: true
                  }}
                  className='tableWrapper'
                >
                  <Column
                    title="Name"
                    dataIndex="name"
                    key="name"
                    align="left"
                    sorter={true}
                    sortOrder={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy) === 'name' ? ((searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) + 'end') : null}
                    render={(value, record, index) => (
                      <Space>
                        <Link
                          key={`${value}`}
                          target={record.path.startsWith('/download/') ? '_blank' : '_self'}
                          to={record.path.startsWith('/download/') ?
                            `${record.path}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}` :
                            record.path
                          }
                          title={`${value}${record.encrypted ? ' *' : ''}`}
                          className='tableRowFileNameLink'
                          // draggable={((selectedRowKeys.length > 0) && !selectedRowKeys.includes(value)) ? false : true}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragEnter={handleDragEnterLink}
                          onDragLeave={handleDragLeaveLink}
                          onDrop={handleDropLink}
                          onDragOver={handleDragOverLink}
                        >
                          <Space>
                            <FileIcon key='icon' type={record.type} style={{ pointerEvents: 'none' }} />
                            <span key='name' style={{ pointerEvents: 'none' }}>{value}{record.encrypted ? ' *' : ''}</span>
                          </Space>
                        </Link>
                        <Link
                          key={`${value}-download`}
                          target='_blank'
                          to={`${record.path.replace(/^\/(folder|view)\//, '/download/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Download')}
                          className="tableRowFileNameHoverLink"
                          draggable={false}
                        >
                          <DownloadOutlined />
                        </Link>
                        {(user.scope && user.scope.includes('admin')) && <Link
                          key={`${value}-rename`}
                          to={`${record.path.replace(/^\/(folder|view|download)\//, '/rename/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Rename')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleRenameClick(value); }}
                          draggable={false}
                        ><EditOutlined /></Link>}
                        {(user.scope && user.scope.includes('admin')) && <Link
                          key={`${value}-move`}
                          to={`${record.path.replace(/^\/(folder|view|download)\//, '/move/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Move')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleMoveClick(value); }}
                          draggable={false}
                        ><ExportOutlined /></Link>}
                        {(user.scope && user.scope.includes('admin')) && <Link
                          key={`${value}-copy`}
                          to={`${record.path.replace(/^\/(folder|view|download)\//, '/copy/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Copy')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleCopyClick(value); }}
                          draggable={false}
                        ><CopyOutlined /></Link>}
                        {(user.scope && user.scope.includes('admin')) && <Link
                          key={`${value}-delete`}
                          to={`${record.path.replace(/^\/(folder|view|download)\//, '/delete/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Delete')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleDeleteClick(value); }}
                          draggable={false}
                        >
                          <DeleteOutlined />
                        </Link>}
                        <Link
                          key={`${value}-brief`}
                          to={`${record.path.replace(/^\/(folder|view|download)\//, '/brief/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Info')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleBriefClick(value); }}
                          draggable={false}
                        ><InfoCircleOutlined /></Link>
                        {(user.scope && user.scope.includes('admin') && (record.type === 'Compressed File') && record.path.startsWith('/folder/')) && <Link
                          key={`${value}-decompress`}
                          to={`${record.path.replace('/folder/', '/decompress/')}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
                          title={t('Decompress')}
                          className="tableRowFileNameHoverLink"
                          onClick={(e) => { e.preventDefault(); handleDecompressClick(value); }}
                          draggable={false}
                        >
                          <FolderOpenOutlined />
                        </Link>}
                      </Space>
                    )}
                  />
                  <Column
                    title={t("Type")}
                    dataIndex="type"
                    key="type"
                    align="center"
                    sorter={true}
                    sortOrder={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy) === 'type' ? ((searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) + 'end') : null}
                    width={200}
                  />
                  <Column
                    title={t("Size")}
                    dataIndex="size"
                    key="size"
                    align="center"
                    sorter={true}
                    sortOrder={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy) === 'size' ? ((searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) + 'end') : null}
                    width={130}
                  />
                  <Column
                    title={t("Modified Time")}
                    dataIndex="modified"
                    key="modified"
                    align="center"
                    sorter={true}
                    sortOrder={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy) === 'modified' ? ((searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) + 'end') : null}
                    width={180}
                    render={(value, record, index) =>
                      record.modifiedTime ? dayjs(record.modifiedTime).format('YYYY-MM-DD HH:mm:ss') : '-'
                    }
                  />
                </Table>}
                {(searchParams.get('view') || window.localStorage.getItem('view')) === 'thumbnails' && <ViewerJS
                  visible={viewerjsVisible}
                  options={viewerjsOptions}
                  setVisible={setViewerjsVisible}
                  showCustomNavBtn={true}
                >
                  {/*<Flex
                    gap="small"
                    justify="flex-start"
                    align="start"
                    wrap={true}
                  >*/}
                  <div
                    className="thumbnailContainer"
                    style={{ gridTemplateColumns: `repeat(auto-fill, ${parseInt(searchParams.get('thumbnailSize')) || parseInt(window.localStorage.getItem("thumbnailSize")) || defaultThumbnailSize}px)` }}
                  >
                    {data.map((file, idx) => <ThumbnailLink
                      key={`${file.name}-${refreshTag}`}
                      file={file}
                      size={parseInt(searchParams.get('thumbnailSize')) || parseInt(window.localStorage.getItem("thumbnailSize")) || defaultThumbnailSize}
                      setInitialViewIndex={setInitialViewIndex}
                      setViewerjsVisible={setViewerjsVisible}
                      allFiles={data}
                      selectedKeys={selectedRowKeys}
                      setSelectedKeys={setSelectedRowKeys}
                      handleBriefClick={handleBriefClick}
                      handleRenameClick={handleRenameClick}
                      handleMoveClick={handleMoveClick}
                      handleCopyClick={handleCopyClick}
                      handleDeleteClick={handleDeleteClick}
                      handleDecompressClick={handleDecompressClick}
                      user={user}
                      t={t}
                      handleDragStart={handleDragStart}
                      handleDragEnd={handleDragEnd}
                      handleDragEnterLink={handleDragEnterLink}
                      handleDragLeaveLink={handleDragLeaveLink}
                      handleDropLink={handleDropLink}
                      handleDragOverLink={handleDragOverLink}
                    />)}
                  </div>
                  {/*</Flex>*/}
                </ViewerJS>}
                {((parseInt(searchParams.get('page')) || 1) * (parseInt(searchParams.get('pageSize')) || parseInt(window.localStorage.getItem("pageSize")) || defaultPageSize) < total) && <Button
                  onClick={handleLoadMoreClick}
                  block={true}
                  variant="outlined"
                  style={{ marginTop: '16px' }}
                >{t('Next Page')}</Button>}
                <Pagination
                  showQuickJumper={true}
                  showSizeChanger={true}
                  total={total}
                  current={parseInt(searchParams.get('page')) || 1}
                  pageSize={parseInt(searchParams.get('pageSize')) || parseInt(window.localStorage.getItem("pageSize")) || defaultPageSize}
                  onChange={(page, pageSize) => {
                    updateSearchParams({ page, pageSize });
                  }}
                  style={{ margin: '16px 0', justifyContent: 'flex-end' }}
                />
              </ProCard>
              {!briefHidden && <BriefPanel
                fileName={fileToBrief}
                setHidden={setBriefHidden}
                messageApi={messageApi}
                pathname={pathname}
                searchParams={searchParams}
                t={t}
              />}
            </Flex>
          </Fragment> : <div className="empty-container">
            <Empty
              style={{ maxWidth: '400px' }}
              image={needsPwd ?
                <LockOutlined style={{ fontSize: '90px', color: 'rgba(0,0,0,0.25)' }} /> :
                <FolderOpenOutlined style={{ fontSize: '100px', color: 'rgba(0,0,0,0.25)' }} />
              }
              description={needsPwd ?
                <Button onClick={() => setArchivePasswordModalVisible(true)}>Input Password</Button> :
                <Paragraph style={{ marginBottom: '16px' }}><Text type="secondary">No Data</Text></Paragraph>
              }
            />
          </div>}
        </Spin>
      </ProCard>
      {
        isDragOver && <div id='dragging-overlay'>
          <div className='dropin-box'>
            <div className='dropin-text'>{t('Drop in to upload')}</div>
          </div>
        </div>
      }
      <Modal
        title={t("Password is needed")}
        open={archivePasswordModalVisible}
        closable={true}
        keyboard={true}
        maskClosable={true}
        onOk={handleArchivePasswordModalOk}
        onCancel={() => setArchivePasswordModalVisible(false)}
        okButtonProps={{ disabled: archivePasswordModalOkButtonDisabled }}
        confirmLoading={loading}
      >
        <Form
          form={formRef}
          disabled={loading}
        >
          <Form.Item
            label={t("Archive Password")}
            name="archivePassword"
            rules={[{ required: true, message: t('Please input archive password!') }]}
          >
            <Input.Password
              onPressEnter={handleArchivePasswordModalOk}
              onChange={handleArchivePasswordInputChange}
            />
          </Form.Item>
        </Form>
      </Modal>
      <MoveModal
        title={moveModalTitle}
        open={moveModalOpen}
        setOpen={setMoveModalOpen}
        selectedRowKeys={selectedRowKeys}
        setSelectedKeys={setSelectedRowKeys}
        refresh={refresh}
        pathname={pathname}
        messageApi={messageApi}
        searchParams={searchParams}
        t={t}
      />
      <DecompressModal
        open={decompressModalOpen}
        setOpen={setDecompressModalOpen}
        selectedRowKeys={selectedRowKeys}
        setSelectedKeys={setSelectedRowKeys}
        refresh={refresh}
        pathname={pathname}
        messageApi={messageApi}
        notificationApi={notificationApi}
        searchParams={searchParams}
        t={t}
      />
      <MkDirModal
        open={mkDirModalOpen}
        setOpen={setMkDirModalOpen}
        refresh={refresh}
        pathname={pathname}
        messageApi={messageApi}
        searchParams={searchParams}
        t={t}
      />
      <RenameModal
        open={renameModalOpen}
        setOpen={setRenameModalOpen}
        selectedRowKeys={selectedRowKeys}
        setSelectedKeys={setSelectedRowKeys}
        refresh={refresh}
        pathname={pathname}
        messageApi={messageApi}
        searchParams={searchParams}
        t={t}
      />
      <FloatButton.BackTop />
    </PageContainer>
  );
};

export default Folder;