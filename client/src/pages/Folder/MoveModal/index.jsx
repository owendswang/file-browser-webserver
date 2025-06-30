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

  const handleMoveModalOk = async () => {
    form.submit();
  }

  const handleMoveModalCancel = () => {
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
/*
      if (title.includes('Move')) {
        await folderService.move(pathname, fileNames values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
        setOpen(false);
        refresh();
      } else if (title.includes('Copy')) {
        await folderService.copy(pathname, fileNames, values.dst, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {});
        setOpen(false);
        refresh();
      } else {
        throw new Error(`${t('Invalid operation: ')}${title}`);
      }
*/
      setOpen(false);
      // axios 方法，显示进度
      const params = {
        dst: values.dst,
        keepSrc: title.includes('Copy') ? 1 : 0,
      };
      if (searchParams.get('archivePassword')) {
        params['archivePassword'] = searchParams.get('archivePassword');
      }
      const response = await axios.post(`/move/${pathname}`, fileNames, {
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
            // console.log('data:', data);
            const { progress, error } = data;
            if (error) {
              hasError = error
              await reader.cancel(); // 主动关闭流，防止挂起
            } else if (typeof(progress) === 'number') {
              notificationApi.open({
                key: fileNamesStr,
                message: `${t(title.includes('Copy') ? 'Copying: ' : 'Moving: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
              message: `${t(title.includes('Copy') ? 'Copy error: ' : 'Move error: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
              message: `${t(title.includes('Copy') ? 'Copied: ' : 'Moved: ')}${t('l"')}${fileNamesStr}${t('r"')}`,
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
          label={t('Where would you like to ', { operation: t(title?.toLowerCase()), who: [...new Set(selectedRowKeys)].length > 1 ? t('them') : t('it') })}
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