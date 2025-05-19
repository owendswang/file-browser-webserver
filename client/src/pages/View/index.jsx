import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate, Link } from "react-router";
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@ant-design/pro-components';
import { message, Empty, Typography, Space, Button, Spin } from 'antd';
import { FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons';
import ViewerJS from '@/components/ViewerJS';
import handleErrorContent from '@/utils/handleErrorContent';
import viewService from '@/services/view';
import "@/pages/View/index.css";

const { Text, Paragraph } = Typography;

const View = () => {
  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { t } = useTranslation('View');

  const { '*': originalPathname } = useParams();
  const pathname = encodeURIComponent(originalPathname).replaceAll('%2F', '/');
  const pathParts = pathname.split('/').filter(Boolean);
  const fileName = decodeURIComponent(pathParts[pathParts.length - 1]);

  const breadcrumbItems = pathParts.slice(0, pathParts.length - 1).map((part, idx) => {
    if ((idx === pathParts.length - 1)) {
      return { title: decodeURIComponent(part) };
    } else {
      return { title: <Link
        to={`/folder/${pathParts.slice(0, idx + 1).join('/')}`}
      >{decodeURIComponent(part)}</Link> };
    }
  });

  const [messageApi, contextHolder] = message.useMessage();

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [textContent, setTextContent] = useState('');

  const viewerjsOptions = {
    toolbar: {
      zoomIn: 1,
      zoomOut: 1,
      oneToOne: 1,
      reset: 1,
      prev: 0,
      play: 0,
      next: 0,
      rotateLeft: 1,
      rotateRight: 1,
      flipHorizontal: 1,
      flipVertical: 1,
    },
    navbar: false,
    initialViewIndex: 0,
    title: true,
    keyboard: true,
    fullscreen: true,
    zIndex: 2000,
    zoomRatio: 1,
    inline: true,
    backdrop: true,
  };

  const fetchData = async (signal) => {
    setLoading(true);
    try {
      const params = {
        archivePassword: searchParams.get('archivePassword'),
      }
      const res = await viewService.get(pathname, params, signal);
      // console.log(res);
      if (res) {
        setData(res);
        if (!['Image File', 'Ico File', 'Video File', 'Audio File'].includes(res.fileType)) {
          await fetchTextContent(signal);
        }
      }
    } catch (e) {
      console.log(e);
      if (e.message !== 'canceled') {
        messageApi.error(`${t('Failed to fetch data: ')}${handleErrorContent(e)}`);
      }
    }
    setLoading(false);
  }

  const fetchTextContent = async (signal) => {
    try {
      const params = {
        archivePassword: searchParams.get('archivePassword'),
        type: 'view'
      };
      const res = await viewService.download(pathname, params, signal);
      if (res) {
        setTextContent(res);
      }
    } catch (error) {
      console.error(error);
      setTextContent(t("Failed to load file content."));
    }
  };

  const handleRefreshButtonClick = (e) => {
    fetchData();
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
      title={fileName}
      breadcrumb={{
        items: breadcrumbItems,
      }}
      onBack={() => navigate(-1)}
      extra={<Space>
        <Button
          key="refresh"
          type="link"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={handleRefreshButtonClick}
          size="small"
          title={t("Refresh")}
        ></Button>
      </Space>}
    >
      <Helmet>
        <title>{fileName} - {t('File Browser')}</title>
      </Helmet>
      {contextHolder}
      <Spin spinning={loading}>
        {(!data || Object.keys(data).length === 0) && 
        <div className="empty-container">
          <Empty
            style={{ maxWidth: '400px' }}
            image={<FolderOpenOutlined style={{ fontSize: '100px', color: 'rgba(0,0,0,0.25)' }} />} // Empty.PRESENTED_IMAGE_SIMPLE
            description={<Paragraph style={{ marginBottom: '16px' }}>
              <Text type="secondary">{t('No Data')}</Text>
            </Paragraph>}
          />
        </div>}
        {!loading && ['Image File', 'Ico File'].includes(data.fileType) && <ViewerJS options={viewerjsOptions} className="viewerjs-container">
          <img
            src={`/download/${pathname}${searchParams.get('archivePassword') ? ('?archivePassword=' + searchParams.get('archivePassword')) : ''}`}
            alt={fileName}
            style={{ display: 'none' }}
          />
        </ViewerJS>}
        {!loading && Object.keys(data).length > 0 && !['Image File', 'Ico File', 'Video File', 'Audio File'].includes(data.fileType) && <pre id="text-content">
          {textContent}
        </pre>}
      </Spin>
    </PageContainer>
  );
};

export default View;