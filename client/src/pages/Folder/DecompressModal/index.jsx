import React, { useState, useEffect } from 'react';
import { Modal, TreeSelect, Form, Progress } from 'antd';
import { SyncOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';
import axios from '@/utils/axios';

const DecompressModal = (props) => {
  const { 
    open,
    setOpen,
    selectedRowKeys,
    setSelectedKeys,
    refresh,
    pathname,
    messageApi,
    notificationApi,
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
    const fileNames = [...new Set(selectedRowKeys)];
    const fileNamesStr = fileNames.join(', ');
    try {
      // 不显示进度
      // await folderService.decompress(pathname, [...new Set(selectedRowKeys)], values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
      setOpen(false);

      // axios 方法，显示进度
      const response = await axios.post(`/decompress/${pathname}`, fileNames, {
        params: {
          dst: values.dst, 
          archivePassword: searchParams.get('archivePassword'),
        },
        responseType: 'stream',
        // onDownloadProgress: function (axiosProgressEvent) {
        //   console.log(axiosProgressEvent);
        // }
      });

      const stream = response.data;
      const reader = stream.pipeThrough(new TextDecoderStream('utf-8')).getReader();

      let hasError;
      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          for (const event of value.split('\n').filter(Boolean)) {
            const data = JSON.parse(event.replace(/^data: /, ''));
            // console.log('data:', data);
            const { progress, error } = data;
            if (error) {
              hasError = error
              await reader.cancel(); // 主动关闭流，防止挂起
            } else if (typeof(progress) === 'number') {
              notificationApi.open({
                key: fileNamesStr,
                message: `${t('Decompressing: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
              message: `${t('Decompress error: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
              message: `${t('Decompressed: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
/*
      // fetch 方法，显示进度
      const response = await fetch(`/api/decompress/${pathname}${searchParams.get('archivePassword') ? `?archivePassword=${searchParams.get('archivePassword')}` : ''}`, {
        method: 'post',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([...new Set(selectedRowKeys)]),
        responseType: 'text',
      });

      // 检查响应是否有效
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      // 获取响应流
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // 处理流数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          notificationApi.open({
            key: fileNamesStr,
            message: `${t('Decompressed: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
            description: <Progress percent={100} status="success" />,
            icon: <CheckCircleFilled style={{ color: '#52c41a' }} />,
            duration: 3,
            // closeIcon: true,
            role: 'status',
            placement: 'bottomRight',
          });
          break; // 流结束时退出
        }

        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split('\n').filter(line => line.startsWith('data:'));

        for (const event of events) {
          const data = JSON.parse(event.replace(/^data: /, ''));
          notificationApi.open({
            key: fileNamesStr,
            message: `${t('Decompressing: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
            description: <Progress percent={Math.round(data.progress)} status="active" />,
            icon: <SyncOutlined spin style={{ color: '#1890ff' }} />,
            duration: null,
            closeIcon: false,
            role: 'status',
            placement: 'bottomRight',
          });
          // console.log('Received event:', data);
        }
      }
*/
      refresh();
    } catch(e) {
      console.error(e);
      // messageApi.error(`${t('Decompress failed: ')}${handleErrorContent(e)}`);
      notificationApi.open({
        key: fileNamesStr,
        message: `${t('Decompress error: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
        description: handleErrorContent(e),
        icon: <CloseCircleFilled />,
        duration: null,
        // closeIcon: true,
        role: 'status',
        placement: 'bottomRight',
      });
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