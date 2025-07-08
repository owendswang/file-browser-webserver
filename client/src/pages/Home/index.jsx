import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate, useOutletContext } from "react-router";
import { Helmet } from "react-helmet";
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { Table, message, Progress, Space, Button, Empty, Typography, Spin } from 'antd';
import { ReloadOutlined, FolderOpenOutlined, MoonOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import handleErrorContent from '@/utils/handleErrorContent';
import homeService from '@/services/home';
import FileIcon from '@/pages/Folder/FileIcon';

const { Text, Paragraph } = Typography;
const { Column } = Table;

const Home = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { t } = useTranslation('Home');

  const [messageApi, contextHolder] = message.useMessage();

  const [user] = useOutletContext();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sleepBtnloading, setSleepBtnloading] = useState(false);
  const [sleepable, setSleepable] = useState(false);
  const [recycleBinEnabled, setRecycleBinEnabled] = useState(false);

  const fetchData = async (signal) => {
    setLoading(true);
    try {
      const res = await homeService.getFolders(signal);
      // console.log(res);
      if (res && res.folders && Array.isArray(res.folders)) {
        setData(res.folders);
        setSleepable(res.sleepable);
        setRecycleBinEnabled(res.recycleBinEnabled);
      }
    } catch(e) {
      console.error(e);
      if (e.message !== 'canceled') {
        messageApi.error(`Failed to fetch data: ${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  }

  const handleRecycleBtnClick = (e) => {
    e.preventDefault();
    navigate('/recycle');
  };

  const handleSleepBtnClick = async (e) => {
    setSleepBtnloading(true);
    try {
      const res = await homeService.sleep();
      // console.log(res);
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Failed to put disks to sleep: ')}${handleErrorContent(e)}`);
    }
    setSleepBtnloading(false);
  };

  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);
    return () => {
      abortController.abort();
    }
  }, [window.location.pathname]);

  return (
    <PageContainer
      header={{
        title: t("Home"),
        ghost: true,
        breadcrumb: {},
      }}
      ghost={true}
    >
      <Helmet>
        <title>{t('Home')} - {t('File Browser')}</title>
      </Helmet>
      {contextHolder}
      <ProCard
        extra={<Space>
          {(user.scope && user.scope.includes('admin') && recycleBinEnabled) && <Button
            key="recycle"
            type="link"
            icon={<DeleteOutlined />}
            size="small"
            title={t("Recycle Bin")}
            href="/recycle"
            onClick={handleRecycleBtnClick}
          ></Button>}
          {(user.scope && user.scope.includes('admin')) && <Button
            key="sleep"
            type="link"
            icon={<MoonOutlined />}
            loading={sleepBtnloading || loading}
            onClick={handleSleepBtnClick}
            disabled={!sleepable}
            size="small"
            title={t("Sleep")}
          ></Button>}
          <Button
            key="refresh"
            type="link"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => { fetchData(); }}
            size="small"
            title={t("Refresh")}
          ></Button>
        </Space>}
      >
        <Spin spinning={loading}>
          { data.length > 0 ?
            <Table
              dataSource={data}
              // loading={loading}
              rowKey="name"
              pagination={false}
              // size="small"
              bordered={false}
              scroll={{ x: 'max-content' }}
            >
              <Column
                title={t("Folder Name")}
                dataIndex="name"
                key="name"
                align="left"
                render={function(value, record, index) {
                  let newSearchParams = new URLSearchParams(searchParams.toString());
                  newSearchParams.delete('page');
                  return (
                    <Link
                      to={{
                        pathname: record.path.replace(/^\/home\//, '/folder/'),
                        search: newSearchParams.toString() ? ('?' + newSearchParams.toString()) : '',
                      }}
                    ><FileIcon type="Folder" style={{ paddingRight: '8px' }} />{value}</Link>
                  );
                }}
              />
              <Column
                title={t("Disk Status")}
                dataIndex="status"
                key="status"
                align="center"
                width={150}
                render={function(value, record, index) {
                  let color = "primary";
                  if (value === "Healthy") {
                    color = "green";
                  } else if (value === "Unhealty") {
                    color = "danger";
                  }
                  return (
                    <Button
                      variant="outlined"
                      color={color}
                      size="small"
                      disabled={!['Healthy', 'Unhealty'].includes(value)}
                      onClick={(e) => {
                        navigate({
                          pathname: `/disk/${record.device}`,
                          search: searchParams.toString() ? ('?' + searchParams.toString()) : '',
                        })
                      }}
                    >{t(value)}</Button>
                  );
                }}
              />
              <Column
                title={t("Total Space")}
                dataIndex="total"
                key="total"
                align="center"
                width={150}
              />
              <Column
                title={t("Used Space")}
                dataIndex="used"
                key="used"
                align="center"
                width={150}
              />
              <Column
                title={t("Free Space")}
                dataIndex="available"
                key="available"
                align="center"
                width={150}
              />
              {/*<Column
                title={t("Usage")}
                dataIndex="percentUsed"
                key="percentUsed"
                align="center"
                width={150}
                render={function(value, record, index) {
                  if (isNaN(value)) {
                    return '-';
                  } else {
                    return (
                      <span>{value} %</span>
                    );
                  }
                }}
              />*/}
              <Column
                title={t("Usage Bar")}
                dataIndex="percentUsed"
                key="percentUsed"
                align="center"
                width={340}
                render={function(value, record, index) {
                  if (isNaN(value)) {
                    return '-';
                  } else {
                    let status = "normal";
                    if (value > 90) {
                      status = "exception";
                    }
                    return (
                      <Progress
                        percent={value}
                        percentPosition={{ align: 'end', type: 'inner' }}
                        size={[300, 20]}
                        strokeLinecap="butt"
                        status={status}
                        trailColor="rgba(82,196,26,0.75)"
                      />
                    );
                  }
                }}
              />
            </Table> :
            <div className="empty-container">
              <Empty
                style={{ maxWidth: '400px' }}
                image={<FolderOpenOutlined style={{ fontSize: '100px', color: 'rgba(0,0,0,0.25)' }} />}  // Empty.PRESENTED_IMAGE_SIMPLE
                description={<Paragraph style={{ marginBottom: '16px' }}>
                  <Text type="secondary">{t('No Data')}</Text>
                </Paragraph>}
              />
            </div>
          }
        </Spin>
      </ProCard>
    </PageContainer>
  );
};

export default Home;