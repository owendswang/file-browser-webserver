import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from "react-router";
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Table, message, Empty, Space, Button, Typography, Spin } from 'antd';
import { ReloadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import handleErrorContent from '@/utils/handleErrorContent';
import diskService from '@/services/disk';
import './index.css';

const { Text, Paragraph } = Typography;
const { Column } = Table;

function formatSize(bytes, toFixed = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  while (bytes >= 1000 && unitIndex < units.length - 1) {
    bytes /= 1000;
    unitIndex++;
  }
  return `${bytes.toFixed(toFixed)}${units[unitIndex]}`;
}

const Disk = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { diskId } = useParams();

  const [messageApi, contextHolder] = message.useMessage();

  const { t } = useTranslation('Disk');

  const [data, setData] = useState({});
  const [smartInfoTableData, setSmartInfoTableData] = useState({
    headers: [],
    rows: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async (signal) => {
    setLoading(true);
    try {
      const res = await diskService.get(diskId, signal);
      if (res) {
        setData(res);
        let tableData = [];
        let tableHeaders = ['Key', 'Value'];
        if (res.diskInfo?.device?.type === 'nvme') {
          res.smartInfo?.split(res.EOL).filter((line) => line.match(/:\s+/)).forEach(line => {
            const parts = line.trim().split(/:\s+/);
            tableData.push({ Key: parts[0], Value: parts[1] });
          });
        } else {
          const headerLine = res.smartInfo?.split(res.EOL).find((line) => line.startsWith('ID#'));
          if (headerLine) {
            tableHeaders = headerLine.split(/\s+/);
            res.smartInfo?.split(res.EOL).filter((line) => line.match(/^ *\d+ /)).forEach(line => {
              if (line.trim()) {
                const parts = line.trim().split(/\s+/);
                let row = {};
                for (let i = 0; i < tableHeaders.length; i += 1) {
                  row[tableHeaders[i]] = parts[i];
                }
                tableData.push(row);
              }
            });
          }
        }
        setSmartInfoTableData({
          headers: tableHeaders,
          rows: tableData,
        })
      }
    } catch (e) {
      console.log(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch data: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  }

  const handleRefreshButtonClick = (e) => {
    fetchData();
  }

  const handleRowClassName = (record, index) => {
    if (data.diskInfo?.device?.type === 'sat') {
      if (record['VALUE'] === '0') {
        return 'rowError';
      } if (record['THRESH'] !== '0' && parseInt(record['VALUE']) <= parseInt(record['THRESH'])) {
        return 'rowError';
      } else if (record['ID#'] === '5') { // Reallocated_Sector_Ct
        if (parseInt(record['RAW_VALUE']) > 0) {
          return 'rowWarning';
        }
      } else if (record['ID#'] === '196') { // Reallocated_Event_Count
        if (parseInt(record['RAW_VALUE']) > 0) {
          return 'rowWarning';
        }
      } else if (record['ID#'] === '197') { // Current_Pending_Sector
        if (parseInt(record['RAW_VALUE']) > 0) {
          return 'rowWarning';
        }
      } else if (record['ID#'] === '198') { // Offline_Uncorrectable
        if (parseInt(record['RAW_VALUE']) > 0) {
          return 'rowError';
        }
      } else if (record['ID#'] === '199') { // UDMA_CRC_Error_Count
        if (parseInt(record['RAW_VALUE']) > 0) {
          return 'rowWarning';
        }
      } else if (record['ID#'] === '9') { // Power_On_Hours
        if (parseInt(record['RAW_VALUE']) >= 30000) {
          return 'rowWarning';
        }
      } else if (record['ID#'] === '194') { // Temperature_Celsius
        if (parseInt(record['RAW_VALUE']) > 50 || parseInt(record['RAW_VALUE']) < 10) {
          return 'rowWarning';
        }
      }
    }
    return '';
  }

  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);
    return () => {
      abortController.abort();
    }
  }, [location.pathname]);

  return (
    <PageContainer
      title={diskId}
      breadcrumb={{}}
      onBack={() => navigate(-1)}
    >
      <Helmet>
        <title>{diskId} {t('Disk Info')} - {t('File Browser')}</title>
      </Helmet>
      {contextHolder}
      <ProCard
        title={`${data.diskInfo?.model_name} ${data.diskInfo?.user_capacity.bytes ? ('(' + formatSize(data.diskInfo?.user_capacity.bytes) + ')') : ''} ${data.diskInfo?.device?.type === 'nvme' ? ('(NVME ' + data.diskInfo?.sata_version.string + ')') : ''}${data.diskInfo?.device?.type === 'sat' ? ('(' + data.diskInfo?.sata_version.string + ')') : ''} `}
        tooltip={data.diskInfo?.serial_number ? `S/N: ${data.diskInfo?.serial_number}` : ''}
        extra={<Space>
          <Button
            key="refresh"
            type="link"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRefreshButtonClick}
            size="small"
            title={t('Refresh')}
          ></Button>
        </Space>}
      >
        <Spin spinning={loading}>
          {(smartInfoTableData.rows.length > 0) ?
            <Table
              dataSource={smartInfoTableData.rows}
              loading={loading}
              rowKey={data.diskInfo?.device?.type === 'nvme' ? 'Key' : 'ID#'}
              pagination={false}
              // size="small"
              bordered={false}
              style={{ marginBottom: '1em' }}
              rowClassName={handleRowClassName}
            >
              {smartInfoTableData.headers.map((colName, idx) => (
                <Column
                  key={idx}
                  title={colName}
                  dataIndex={colName}
                  align='left'
                />
              ))}
            </Table> :
            <div className="empty-container">
              <Empty
                style={{ maxWidth: '400px' }}
                image={<CloseCircleOutlined style={{ fontSize: '90px', color: 'rgba(0,0,0,0.25)' }} />}  // Empty.PRESENTED_IMAGE_SIMPLE
                description={<Paragraph style={{ marginBottom: '1em', whiteSpace: 'pre-line' }}>
                  <Text>{
                    data.smartInfo?.split(`${data.EOL}${data.EOL}`)[1] ||
                    t('Failed to get data!')
                  }</Text>
                </Paragraph>}
              />
            </div>
          }
          <Typography style={{ whiteSpace: 'pre-line' }}>
            <Paragraph>
              <Text type="secondary">{data.smartInfo?.split(`${data.EOL}${data.EOL}`)[0]}</Text>
            </Paragraph>
          </Typography>
        </Spin>
      </ProCard>
    </PageContainer>
  );
};

export default Disk;