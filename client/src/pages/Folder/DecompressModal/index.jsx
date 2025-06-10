import React, { useState, useEffect } from 'react';
import { Modal, TreeSelect, Form } from 'antd';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';

const DecompressModal = (props) => {
  const { 
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
      console.error(e);
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
      console.error(e);
      messageApi.error(`${t('Failed to fetch folder tree: ')}${handleErrorContent(e)}`);
    }
  }

  const handleDecompressModalOk = async () => {
    form.submit();
  }

  const handleDecompressModalCancel = () => {
    setOpen(false);
    if ([...new Set(selectedRowKeys)].length === 1) {
      setSelectedKeys([]);
    }
  }

  const handleFormOnFinish = async (values) => {
    setConfirmLoading(true);
    try {
      await folderService.decompress(pathname, [...new Set(selectedRowKeys)], values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
      setOpen(false);
      refresh();
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Decompress failed: ')}${handleErrorContent(e)}`);
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
      title={t("Decompress")}
      open={open}
      onOk={handleDecompressModalOk}
      confirmLoading={confirmLoading}
      onCancel={handleDecompressModalCancel}
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
          label={t('Where would you like to ', { operation: t("Decompress"), who: [...new Set(selectedRowKeys)].length > 1 ? t('them') : t('it') })}
          name="dst"
        >
          <TreeSelect
            treeDataSimpleMode={true}
            style={{ width: 'calc(100% - 16px)' }}
            styles={{
              popup: {
                root: { maxHeight: 400, overflow: 'auto' }
              }
            }}
            placeholder={t('Default to current directory')}
            loadData={fetchFolderTreeSelectOptions}
            treeData={folderTreeSelectOptions}
            disabled={confirmLoading}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DecompressModal;