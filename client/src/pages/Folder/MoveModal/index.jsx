import React, { useState, useEffect } from 'react';
import { Modal, TreeSelect, Form } from 'antd';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';

const MoveModal = (props) => {
  const { 
    title,
    open,
    setOpen,
    selectedRowKeys,
    setSelectedKeys,
    refresh,
    pathname,
    messageApi,
    searchParams,
    t
  } = props;

  const [form] = Form.useForm();

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [folderTreeSelectOptions, setFolderTreeSelectOptions] = useState([]);

  const initFolderTreeSelectOptions = async (signal) => {
    try {
      const res = await folderService.getFolderTree('', searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {}, signal);
      setFolderTreeSelectOptions(res.map((folderPath) => ({
        id: folderPath,
        pId: 0,
        value: folderPath,
        title: decodeURIComponent(folderPath.split('/')[folderPath.split('/').length - 1])
      })))
    } catch(e) {
      console.log(e);
      messageApi.error(`${t('Failed to fetch folder tree: ')}${handleErrorContent(e)}`);
    }
  }

  const fetchFolderTreeSelectOptions = async (treeNode) => {
    // console.log(treeNode);
    const { id } = treeNode;
    try {
      const res = await folderService.getFolderTree(id, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
      setFolderTreeSelectOptions(prevOptions => 
        prevOptions.concat(res.map((folderPath) => ({
          id: folderPath,
          pId: id,
          value: folderPath,
          title: decodeURIComponent(folderPath.split('/')[folderPath.split('/').length - 1])
        })))
      );
    } catch(e) {
      console.log(e);
      messageApi.error(`${t('Failed to fetch folder tree: ')}${handleErrorContent(e)}`);
    }
  }

  const handleMoveModalOk = async () => {
    form.submit();
  }

  const handleMoveModalCancel = () => {
    setOpen(false);
    if (selectedRowKeys.length === 1) {
      setSelectedKeys([]);
    }
  }

  const handleFormOnFinish = async (values) => {
    setConfirmLoading(true);
    try {
      if (title.includes('Move')) {
        await Promise.all(selectedRowKeys.map((fileName) => {
          return folderService.move(`${pathname}/${encodeURIComponent(fileName)}`, values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
        }));
        setOpen(false);
        refresh();
      } else if (title.includes('Copy')) {
        await Promise.all(selectedRowKeys.map((fileName) => {
          return folderService.copy(`${pathname}/${encodeURIComponent(fileName)}`, values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
        }));
        setOpen(false);
        refresh();
      } else {
        throw new Error(`${t('Invalid operation: ')}${title}`);
      }
    } catch(e) {
      console.log(e);
      messageApi.error(`${t('Move failed: ')}${handleErrorContent(e)}`);
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    if (open) {
      initFolderTreeSelectOptions(controller.signal);
    } else {
      form.resetFields();
    }
    return () => {
      controller.abort();
    };
  }, [open]);

  return (
    <Modal
      title={t(title)}
      open={open}
      onOk={handleMoveModalOk}
      confirmLoading={confirmLoading}
      onCancel={handleMoveModalCancel}
      destroyOnHidden={true}
    >
      <Form
        onFinish={handleFormOnFinish}
        form={form}
        style={{ marginTop: '16px' }}
        requiredMark={false}
        disabled={confirmLoading}
        layout="vertical"
      >
        <Form.Item
          label={t('Where would you like to ', { operation: t(title?.toLowerCase()), who: selectedRowKeys.length > 1 ? t('them') : t('it') })}
          name="dst"
          rules={[{ required: true, message: t('Please select destination') }]}
        >
          <TreeSelect
            treeDataSimpleMode={true}
            style={{ width: 'calc(100% - 16px)' }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            placeholder={t('Please select destination')}
            loadData={fetchFolderTreeSelectOptions}
            treeData={folderTreeSelectOptions}
            disabled={confirmLoading}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MoveModal;