import React, { useState, useEffect } from 'react';
import { Modal, Form, Input } from 'antd';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';

const MkDirModal = (props) => {
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

  const handleModalOnOk = async () => {
    form.submit();
  }

  const handleModalOnCancel = () => {
    setOpen(false);
    setSelectedKeys([]);
  }

  const handleFormOnFinish = async (values) => {
    setConfirmLoading(true);
    try {
      await folderService.rename(`${pathname}/${encodeURIComponent(selectedRowKeys[0])}`, values.newName, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
      setOpen(false);
      refresh();
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Failed to rename: ')}${handleErrorContent(e)}`);
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      form.setFieldValue('newName', selectedRowKeys[0]);
    } else {
      form.resetFields();
    }
  }, [open, selectedRowKeys]);

  return (
    <Modal
      title={t("Rename")}
      open={open}
      onOk={handleModalOnOk}
      confirmLoading={confirmLoading}
      onCancel={handleModalOnCancel}
      destroyOnHidden={true}
    >
      <Form
        onFinish={handleFormOnFinish}
        form={form}
        style={{ marginTop: '16px' }}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        requiredMark={false}
        disabled={confirmLoading && selectedRowKeys.length !== 1}
      >
        <Form.Item
          label={t("New name")}
          name="newName"
          rules={[{ required: true, message: t('Please input a new name') }]}
        >
          <Input
            placeholder={t("Please input a new name here...")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MkDirModal;