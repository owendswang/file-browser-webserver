import React, { useState, useEffect, Fragment } from 'react';
import { Link, useSearchParams, useLocation, useNavigate, useOutletContext } from "react-router";
import { Helmet } from "react-helmet";
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Table,
  message,
  Modal,
  Input,
  Space,
  Empty,
  Pagination,
  Button,
  Typography,
  FloatButton,
  notification,
  Progress,
  Spin
} from 'antd';
import {
  FolderOpenOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ExportOutlined,
  SyncOutlined,
  CheckCircleFilled,
  CloseCircleFilled
} from '@ant-design/icons';
import * as dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import recycleService from '@/services/recycle';
import handleErrorContent from '@/utils/handleErrorContent';
import axios from '@/utils/axios';
import FileIcon from '@/pages/Folder/FileIcon';
import MoveModal from '@/pages/Recycle/MoveModal';
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

  const { t } = useTranslation('Recycle');

  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [user] = useOutletContext();

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [refreshTag, setRefreshTag] = useState(0);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveModalTitle, setMoveModalTitle] = useState('');

  const fetchData = async (signal) => {
    setLoading(true);
    setSelectedRowKeys([]);
    const params = {
      page: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || parseInt(defaultPageSize),
      sortBy: searchParams.get('sortBy') || defaultSortBy,
      order: searchParams.get('order') || defaultOrder,
      search: searchParams.get('search') || '',
    };
    try {
      const res = await recycleService.getList(params, signal);
      if (res?.recycleItems && Array.isArray(res.recycleItems)) {
        if (res.recycleItems.length > 0 || (parseInt(searchParams.get('page')) || 1) === 1) {
          setData(res.recycleItems);
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

  const handleProgressDelete = async (name, pathname) => {
    let fileNames = [];
    let filePathnames = [];
    if (name) {
      fileNames = [name];
    } else {
      fileNames = [...new Set(selectedRowKeys)].map((path) => path.split('/')[path.split('/').length - 1]);
    }
    if (pathname) {
      filePathnames = [pathname];
    } else {
      filePathnames = [...new Set(selectedRowKeys)];
    }
    const fileNamesStr = fileNames.join(', ');
    try {
      const params = {};
      const response = await axios.post(`/delete`, filePathnames, {
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

  const handleDeleteClick = (name, pathname) => {
    // console.log(pn);
    setSelectedRowKeys([pathname]);
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete it?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        // axios 方法，显示进度
        handleProgressDelete(name, pathname);

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

  const handleMoveClick = (pathname) => {
    // console.log(name);
    setSelectedRowKeys([pathname]);
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleBulkMove = (e) => {
    // console.log('trying to move: ', selectedRowKeys.join(', '));
    setMoveModalOpen(true);
    setMoveModalTitle('Move');
  }

  const handleProgressEmptyRecycleBin = async () => {
    try {
      const response = await axios.delete(`/recycle`, {
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
                key: 'emptyRecycleBin',
                message: `${t('Emptying: ')}`,
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
              key: 'emptyRecycleBin',
              message: `${t('Empty error: ')}`,
              description: handleErrorContent(hasError),
              icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
              duration: null,
              // closeIcon: true,
              role: 'status',
              placement: 'bottomRight',
            });
          } else {
            notificationApi.open({
              key: 'emptyRecycleBin',
              message: `${t('Emptied: ')}`,
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
        key: 'emptyRecycleBin',
        message: `${t('Empty error: ')}`,
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

  const handleEmptyRecycleBin = (e) => {
    modalApi.confirm({
      title: t('Empty Recycle Bin'),
      content: t('Are you sure to empty the recycle bin?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        // axios 方法，显示进度
        handleProgressEmptyRecycleBin();

        // 不显示进度
        /*try {
          await recycleService.delete();
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Empty failed: ')}${handleErrorContent(e)}`);
        } finally {
          refresh();
        }*/
      }
    });
  }

  return (
    <PageContainer
      title={t('Recycle Bin')}
      breadcrumb={{}}
      onBack={() => navigate(-1)}
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
          {(user.scope && user.scope.includes('admin')) && <Button
            key='emptyRecycleBin'
            icon={<DeleteOutlined />}
            disabled={data.length === 0}
            onClick={handleEmptyRecycleBin}
          >{t('Empty Recycle Bin')}</Button>}
          <Input.Search
            key='search'
            loading={loading}
            onSearch={onInputSearchSubmit}
            defaultValue={searchParams.get('search') || ''}
            allowClear={true}
            style={{ width: '200px', marginLeft: 'auto' }}
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
              {(data.length < Math.min((parseInt(searchParams.get('page')) || 1) * (parseInt(searchParams.get('pageSize')) || parseInt(defaultPageSize)), total)) && <Button
                onClick={handleLoadPreviousClick}
                block={true}
                variant="outlined"
                style={{ marginBottom: '16px' }}
              >{t('Previous Page')}</Button>}
              <Table
                dataSource={data}
                // loading={loading}
                rowKey='path'
                // size='small'
                bordered={false}
                pagination={false}
                onChange={handleTableChange}
                rowSelection={{
                  selectedRowKeys,
                  onChange: (e) => { /*console.log(e);*/ setSelectedRowKeys(e); },
                  selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
                }}
                scroll={{
                  x: 'max-content',
                  scrollToFirstRowOnChange: true
                }}
                className='tableWrapper'
              >
                <Column
                  title='Path'
                  dataIndex='path'
                  hidden={true}
                />
                <Column
                  title={t('Name')}
                  dataIndex="name"
                  align="left"
                  sorter={true}
                  sortOrder={(searchParams.get('sortBy') || defaultSortBy) === 'name' ? ((searchParams.get('order') || defaultOrder) + 'end') : null}
                  render={(value, record, index) => (
                    <Space>
                      <Link
                        key={`${value}`}
                        target={'_blank'}
                        to={record.type === 'Folder' ? ('/folder' + record.path) : ('/download' + record.path)}
                        title={value}
                        className='tableRowRecycleFileNameLink'
                        onClick={(e) => { e.preventDefault(); }}
                      >
                        <Space>
                          <FileIcon key='icon' type={record.type} style={{ pointerEvents: 'none' }} />
                          <span key='name' style={{ pointerEvents: 'none' }}>{value}{record.encrypted ? ' *' : ''}</span>
                        </Space>
                      </Link>
                      <Link
                        key={`${value}-download`}
                        target='_blank'
                        to={'/download' + record.path}
                        title={t('Download')}
                        className="tableRowFileNameHoverLink"
                        draggable={false}
                      >
                        <DownloadOutlined />
                      </Link>
                      {(user.scope && user.scope.includes('admin')) && <Link
                        key={`${value}-move`}
                        to={'/move' + record.path}
                        title={t('Move')}
                        className="tableRowFileNameHoverLink"
                        onClick={(e) => { e.preventDefault(); handleMoveClick(record.path); }}
                        draggable={false}
                      ><ExportOutlined /></Link>}
                      {(user.scope && user.scope.includes('admin')) && <Link
                        key={`${value}-delete`}
                        to={'/delete' + record.path}
                        title={t('Delete')}
                        className="tableRowFileNameHoverLink"
                        onClick={(e) => { e.preventDefault(); handleDeleteClick(value, record.path); }}
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
                  align="center"
                  sorter={true}
                  sortOrder={(searchParams.get('sortBy') || defaultSortBy) === 'type' ? ((searchParams.get('order') || defaultOrder) + 'end') : null}
                  width={200}
                />
                <Column
                  title={t("Size")}
                  dataIndex="size"
                  align="center"
                  sorter={true}
                  sortOrder={(searchParams.get('sortBy') || defaultSortBy) === 'size' ? ((searchParams.get('order') || defaultOrder) + 'end') : null}
                  width={130}
                />
                <Column
                  title={t("Deleted Time")}
                  dataIndex="deletedAt"
                  align="center"
                  sorter={true}
                  sortOrder={(searchParams.get('sortBy') || defaultSortBy) === 'deletedAt' ? ((searchParams.get('order') || defaultOrder) + 'end') : null}
                  width={180}
                  render={(value, record, index) =>
                    record.deletedAt ? dayjs(record.deletedAt).format('YYYY-MM-DD HH:mm:ss') : '-'
                  }
                />
              </Table>
              {((parseInt(searchParams.get('page')) || 1) * (parseInt(searchParams.get('pageSize')) || parseInt(defaultPageSize)) < total) && <Button
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
                pageSize={parseInt(searchParams.get('pageSize')) || parseInt(defaultPageSize)}
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
              description={<Paragraph style={{ marginBottom: '16px' }}><Text type="secondary">{t('No Data')}</Text></Paragraph>}
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