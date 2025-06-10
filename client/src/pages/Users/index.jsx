import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from "react-router";
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { message, Table, Button, Input, Pagination, Checkbox, Spin, Modal } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import usersService from '@/services/users';
import handleErrorContent from '@/utils/handleErrorContent';
import '@/pages/Folder/index.css';

const { Column } = Table;

const defaultPageSize = 20;

const Users = () => {
  const navigate = useNavigate();

  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [searchParams, setSearchParams] = useSearchParams();

  const { t } = useTranslation('Users');

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [refreshTag, setRefreshTag] = useState(0);

  const fetchData = async (signal) => {
    setLoading(true);
    setSelectedRowKeys([]);
    const params = {
      page: parseInt(searchParams.get('page')) || 1,
      pageSize: parseInt(searchParams.get('pageSize')) || defaultPageSize,
      sortBy: searchParams.get('sortBy') || '',
      order: searchParams.get('order') || '',
      search: searchParams.get('search') || '',
    };
    try {
      const res = await usersService.getList(params, signal);
      if (res?.users && Array.isArray(res.users)) {
        setData(res.users);
        setTotal(res.pagination.total);
      }
    } catch(e) {
      console.error(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch data: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  };

  const handleApprovalChange = async (userId, checked) => {
    setLoading(true);
    try {
      await usersService.update({
        id: userId,
        approved: checked ? 1 : 0,
      });
      refresh();
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Approval failed: ')}${handleErrorContent(e)}`);
      setLoading(false);
    }
  }

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
    setRefreshTag(refreshTag + 1);
  }

  const onInputSearchSubmit = (value) => {
    updateSearchParams({ page: 1, search: value });
  };

  const handleRefreshButtonClick = () => {
    refresh();
  };

  const handleDeleteClick = (userId) => {
    // console.log(pn);
    setSelectedRowKeys([userId]);
    modalApi.confirm({
      title: t('Delete'),
      content: t('Are you sure to delete it?'),
      closable: true,
      maskClosable: true,
      onOk: async () => {
        try {
          if (!userId) {
            throw new Error(t('Nothing to delete'));
          }
          await usersService.delete(userId);
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
          await Promise.all(selectedRowKeys.map((userId) => {
            return usersService.delete(userId);
          }));
          refresh();
        } catch(e) {
          console.error(e);
          messageApi.error(`${t('Delete failed: ')}${handleErrorContent(e)}`);
        }
      }
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => {
      controller.abort();
    }
  }, [refreshTag, searchParams]);

  return (
    <PageContainer
      title={t("User Management")}
      breadcrumb={{}}
      onBack={() => navigate(-1)}
    >
      <Helmet>
        <title>{t('User Management')} - {t('File Browser')}</title>
      </Helmet>
      {messageContextHolder}
      {modalContextHolder}
      <ProCard
        className="folderCardWrapper"
        title={<div className='folderCardTitle'>
          <Button
            key='bulkDelete'
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBulkDelete}
          >{t('Delete')}</Button>
          <Input.Search
            key='search'
            loading={loading}
            onSearch={onInputSearchSubmit}
            defaultValue={searchParams.get('search') || ''}
            allowClear={true}
            style={{ width: '200px', marginLeft: 'auto' }}
          />
          <Button
            key='refresh'
            type="link"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRefreshButtonClick}
            size="small"
          ></Button>
        </div>}
      >
        <Spin spinning={loading}>
          <Table
            dataSource={data}
            // loading={loading}
            rowKey='id'
            // size='small'
            bordered={false}
            pagination={false}
            onChange={handleTableChange}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
            }}
            scroll={{ scrollToFirstRowOnChange: true }}
          >
            <Column
              title="ID"
              dataIndex="id"
              key="id"
              hidden={true}
            />
            <Column
              title={t("User name")}
              dataIndex="username"
              key="username"
              align="left"
              sorter={true}
            />
            <Column
              title={t("Approved")}
              dataIndex="approved"
              key="approved"
              align="center"
              sorter={true}
              width={200}
              render={(value, record, index) => <Checkbox checked={!!value} onChange={(e) => { handleApprovalChange(record.id, e.target.checked); }} />}
            />
            <Column
              title={t("Actions")}
              dataIndex="id"
              key="id"
              align="center"
              width={500}
              render={(value, record, index) => <Button type="link" onClick={(e) => { e.preventDefault(); handleDeleteClick(value); }} >Delete</Button>}
            />
          </Table>
          <Pagination
            showQuickJumper={true}
            showSizeChanger={true}
            total={total}
            current={parseInt(searchParams.get('page')) || 1}
            pageSize={parseInt(searchParams.get('pageSize')) || defaultPageSize}
            onChange={(page, pageSize) => {
              updateSearchParams({ page, pageSize });
            }}
            style={{ margin: '16px 0', justifyContent: 'flex-end' }}
          />
        </Spin>
      </ProCard>
    </PageContainer>
  );
};

export default Users;