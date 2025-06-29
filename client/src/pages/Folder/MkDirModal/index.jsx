import React, { useState, useEffect } from 'react';
import { Modal, Form, Input } from 'antd';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';

const MkDirModal = (props) => {
  const { 
    open,
    setOpen,
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
  }

  const handleFormOnFinish = async (values) => {
    setConfirmLoading(true);
    try {
      await folderService.mkdir(`${pathname}`, values.dir, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
      setOpen(false);
      refresh();
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Failed to create directory: ')}${handleErrorContent(e)}`);
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open]);

  return (
    <Modal
      title={t("Create Directory")}
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
        disabled={confirmLoading}
      >
        <Form.Item
          label={t("Directory name")}
          name="dir"
          rules={[{
            required: true,
            message: t('Please input directory name')
          }, () => ({
            validator(_, value) {
              const invalidCharsPattern = /[\/|\\|<|>|\:|"|\||\?|\*]/g;
              if (invalidCharsPattern.test(value)) {
                return Promise.reject(new Error(t('Directory name cannot conain following characters "/\\<>:"|?*')));
              }
              return Promise.resolve();
            },
          })]}
        >
          <Input
            placeholder={t("Please input directory name here...")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MkDirModal;