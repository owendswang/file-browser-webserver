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
import recycleService from '@/services/recycle';
import handleErrorContent from '@/utils/handleErrorContent';
import axios from '@/utils/axios';
import FileIcon from '@/pages/Folder/FileIcon';
import MoveModal from '@/pages/Folder/MoveModal';
import './index.css';

const { Text, Paragraph } = Typography;
const { Column } = Table;

const defaultPageSize = 50;
const defaultSortBy = 'deletedAt';
const defaultOrder = 'desc';

const Recycle = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const { t } = useTranslation('Folder');


  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [formRef] = Form.useForm();

  const [user] = useOutletContext();

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [refreshTag, setRefreshTag] = useState(0);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveModalTitle, setMoveModalTitle] = useState('');

  const allSelected = data.length > 0 && data.length === selectedRowKeys.length;
  const indeterminated = data.length > selectedRowKeys.length && selectedRowKeys.length > 0;

  const fetchData = async (signal) => {
    setLoading(true);
    setSelectedRowKeys([]);
    const params = {
      page: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || parseInt(window.localStorage.getItem("pageSize")) || defaultPageSize,
      sortBy: searchParams.get('sortBy') || window.localStorage.getItem("sortBy") || defaultSortBy,
      order: searchParams.get('order') || window.localStorage.getItem("order") || defaultOrder,
      search: searchParams.get('search') || '',
    };
    try {
      const res = await recycleService.getList(params, signal);
      if (res?.files && Array.isArray(res.files)) {
        if (res.files.length > 0 || (parseInt(searchParams.get('page')) || 1) === 1) {
          setData(res.files);
          setTotal(res.pagination.total);
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

  const handleRefreshButtonClick = () => {
    refresh();
  };

  const handleLoadMoreClick = () => {
    updateSearchParams({ page: (parseInt(searchParams.get('page')) || 1) + 1 });
  };

  const handleLoadPreviousClick = () => {
    updateSearchParams({ page: (parseInt(searchParams.get('page')) || 1) - 1 });
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
    searchParams.get('sortBy'),
    searchParams.get('order'),
    searchParams.get('search'),
    refreshTag
  ]);

  const handleProgressDelete = async (name) => {
    let fileNames = [];
    if (name) {
      fileNames = [name];
    } else {
      fileNames = [...new Set(selectedRowKeys)];
    }
    const fileNamesStr = fileNames.join(', ');
    try {
      const params = {};
      const response = await axios.post(`/delete/${pathname}`, fileNames, {
        params,
        responseType: 'stream',
      });

      const stream = response.data;
      const reader = stream.pipeThrough(new TextDecoderStream('utf-8')).getReader();

      let hasError;
      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          for (const event of value.split('\n').filter(Boolean)) {
            const data = JSON.parse(event.replace(/^data: /, ''));
            const { progress, error } = data;
            if (error) {
              hasError = error
              await reader.cancel(); // 主动关闭流，防止挂起
            } else if (typeof(progress) === 'number') {
              notificationApi.open({
                key: fileNamesStr,
                message: `${t('Deleting: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
                description: <Progress percent={Math.round(progress)} status="active" />,
                icon: <SyncOutlined spin style={{ color: '#1890ff' }} />,
                duration: null,
                closeIcon: false,
                role: 'status',
                placement: 'bottomRight',
              });
            }
          }
        }
        if (done) {
          if (hasError) {
            notificationApi.open({
              key: fileNamesStr,
              message: `${t('Delete error: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
              description: handleErrorContent(hasError),
              icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
              duration: null,
              // closeIcon: true,
              role: 'status',
              placement: 'bottomRight',
            });
          } else {
            notificationApi.open({
              key: fileNamesStr,
              message: `${t('Deleted: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
              description: <Progress percent={100} status="success" />,
              icon: <CheckCircleFilled style={{ color: '#52c41a' }} />,
              duration: 3,
              // closeIcon: true,
              role: 'status',
              placement: 'bottomRight',
            });
          }
          break;
        }
      }
    } catch(e) {
      console.error(e);
      // messageApi.error(`${t('Move failed: ')}${handleErrorContent(e)}`);
      notificationApi.open({
        key: fileNamesStr,
        message: `${t(title.includes('Copy') ? 'Copy error: ' : 'Move error: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
        description: handleErrorContent(e),
        icon: <CloseCircleFilled />,
        duration: null,
        // closeIcon: true,
        role: 'status',
        placement: 'bottomRight',
      });
    } finally {
      refresh();
    }
  }

  const handleDeleteClick = (name) => {
    // console.log(pn);
    setSelectedRowKeys([name]);
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete it?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        // axios 方法，显示进度
        handleProgressDelete(name);

        // 不显示进度
        /*try {
          if (!name) {
            throw new Error(t('Nothing to delete'));
          }
          await folderService.delete(pathname, [name], {});
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        } finally {
          refresh();
        }*/
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
        // axios 方法，显示进度
        handleProgressDelete();

        // 不显示进度
        /*try {
          await folderService.delete(pathname, selectedRowKeys, {});
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        } finally {
          refresh();
        }*/
      }
    });
  }

  const handleMoveClick = (name) => {
    // console.log(name);
    setSelectedRowKeys([name]);
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleBulkMove = (e) => {
    // console.log('trying to move: ', selectedRowKeys.join(', '));
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleSelectAll = (e) => {
    if (allSelected) {
      setSelectedRowKeys([]);
    } else {
      setSelectedRowKeys(data.map((item) => item.name));
    }
  }

  return (
    <PageContainer
      title={t('Recycle Bin')}
      breadcrumb={{}}
    >
      <Helmet>
        <title>{t('Recycle Bin')} - {t('File Browser')}</title>
      </Helmet>
      {messageContextHolder}
      {notificationContextHolder}
      {modalContextHolder}
      <ProCard
        className="folderCardWrapper"
        title={<div className='folderCardTitle'>
          {(user.scope && user.scope.includes('admin')) && <Button
            key='bulkMove'
            icon={<ExportOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBulkMove}
            className='dropdownButtonGroupLeft'
          >{t('Move')}</Button>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key='bulkDelete'
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBulkDelete}
          >{t('Delete')}</Button>}
          {((searchParams.get('view') || window.localStorage.getItem("view") || defaultViewMode) === 'thumbnails') && <Checkbox
            key="selectAll"
            onChange={handleSelectAll}
            checked={allSelected}
            indeterminate={indeterminated}
            style={{ marginLeft: 'auto' }}
          >{t('Select All')}</Checkbox>}
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
                        to={record.path}
                        title={`${value}${record.encrypted ? ' *' : ''}`}
                        className='tableRowFileNameLink'
                      >
                        <Space>
                          <FileIcon key='icon' type={record.type} style={{ pointerEvents: 'none' }} />
                          <span key='name' style={{ pointerEvents: 'none' }}>{value}{record.encrypted ? ' *' : ''}</span>
                        </Space>
                      </Link>
                      <Link
                        key={`${value}-download`}
                        target='_blank'
                        to={`${record.path.replace(/^\/(folder|view)\//, '/download/')}`}
                        title={t('Download')}
                        className="tableRowFileNameHoverLink"
                        draggable={false}
                      >
                        <DownloadOutlined />
                      </Link>
                      {(user.scope && user.scope.includes('admin')) && <Link
                        key={`${value}-move`}
                        to={`${record.path.replace(/^\/(folder|view|download)\//, '/move/')}`}
                        title={t('Move')}
                        className="tableRowFileNameHoverLink"
                        onClick={(e) => { e.preventDefault(); handleMoveClick(value); }}
                        draggable={false}
                      ><ExportOutlined /></Link>}
                      {(user.scope && user.scope.includes('admin')) && <Link
                        key={`${value}-delete`}
                        to={`${record.path.replace(/^\/(folder|view|download)\//, '/delete/')}`}
                        title={t('Delete')}
                        className="tableRowFileNameHoverLink"
                        onClick={(e) => { e.preventDefault(); handleDeleteClick(value); }}
                        draggable={false}
                      >
                        <DeleteOutlined />
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
                  title={t("Deleted Time")}
                  dataIndex="deletedAt"
                  key="deletedAt"
                  align="center"
                  sorter={true}
                  sortOrder={(searchParams.get('sortBy') || window.localStorage.getItem('sortBy') || defaultSortBy) === 'deletedAt' ? ((searchParams.get('order') || window.localStorage.getItem('order') || defaultOrder) + 'end') : null}
                  width={180}
                  render={(value, record, index) =>
                    record.modifiedTime ? dayjs(record.modifiedTime).format('YYYY-MM-DD HH:mm:ss') : '-'
                  }
                />
              </Table>}
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
          </Fragment> : <div className="empty-container">
            <Empty
              style={{ maxWidth: '400px' }}
              image={<FolderOpenOutlined style={{ fontSize: '100px', color: 'rgba(0,0,0,0.25)' }} />}
              description={<Paragraph style={{ marginBottom: '16px' }}><Text type="secondary">No Data</Text></Paragraph>}
            />
          </div>}
        </Spin>
      </ProCard>
      <MoveModal
        title={moveModalTitle}
        open={moveModalOpen}
        setOpen={setMoveModalOpen}
        selectedRowKeys={selectedRowKeys}
        setSelectedKeys={setSelectedRowKeys}
        refresh={refresh}
        pathname={pathname}
        messageApi={messageApi}
        notificationApi={notificationApi}
        searchParams={searchParams}
        t={t}
      />
      <FloatButton.BackTop />
    </PageContainer>
  );
};

export default Recycle;