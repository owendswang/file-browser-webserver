import React, { useState, useEffect } from 'react';
import { Button, Tree, Spin, Empty } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';
import handleErrorContent from '@/utils/handleErrorContent';
import folderService from '@/services/folder';

const BriefPanel = (props) => {
  const { setHidden, fileName, messageApi, pathname, searchParams, t } = props;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const convertObj2TreeData = (objData, parentKey = '') => {
    const treeData = [];
    let i = 0;
    for (const [key, val] of Object.entries(objData)) {
      if (typeof(val) === 'object') {
        treeData.push({
          title: `${key}`,
          key: `${parentKey}${i}`,
          children: convertObj2TreeData(val, `${parentKey}${i}-`),
        });
      } else if (['Modified Time', 'Accessed Time', 'Changed Time'].includes(key) && val.length > 2) {
        const dayObj = dayjs(val);
        treeData.push({
          title: `${key}: ${dayObj.format('YYYY-MM-DD HH:mm:ss')}`,
          key: `${parentKey}${i}`,
        });
      } else {
        treeData.push({
          title: `${key}: ${val}`,
          key: `${parentKey}${i}`,
        });
      }
      i += 1;
    }
    return treeData;
  }

  const fetchData = async (signal) => {
    setLoading(true);
    try {
      const res = await folderService.brief(`${pathname}/${encodeURIComponent(fileName)}`, searchParams.get('archivePassword') ? { archivePassword: searchParams.get('archivePassword') } : {}, signal);
      if (res && Object.keys(res).length > 0) {
        const treeData = convertObj2TreeData(res);
        setData(treeData);
      }
    } catch (e) {
      console.log(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch brief: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    if (fileName) {
      fetchData(controller.signal);
    }
    return () => {
      controller.abort();
    }
  }, [fileName]);

  const handleCloseBtnClick = (e) => {
    setHidden(true);
  }

  return (
    <ProCard
      title={<div
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '270px'
        }}
        title={fileName}
      >
        <InfoCircleOutlined style={{ marginRight: '8px' }} />{fileName || t('Empty')}
      </div>}
      extra={<Button
        icon={<CloseOutlined />}
        onClick={handleCloseBtnClick}
        type="text"
      />}
      style={{ width: '360px', flexShrink: '0' }}
      bordered={true}
    >
      <Spin spinning={loading}>
        {data.length > 0 ?
        <Tree
          key={loading}
          treeData={data}
          defaultExpandAll={true}
          selectable={false}
        /> :
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Spin>
    </ProCard>
  );
}

export default BriefPanel;