import React from 'react';
import { useNavigate } from 'react-router';
import { Result, Button, Space } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';

const ErrorPage = () => {
  let navigate = useNavigate();

  return (
    <PageContainer
      header={{
        title: false,
        ghost: true,
        breadcrumb: {},
      }}
      ghost={true}
    >
      <Result
        status={404}
        title="404"
        subTitle="未找到路径"
        extra={<Space>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={(e) => { navigate(-1); }}>返回</Button>
          <Button icon={<HomeOutlined />} onClick={(e) => { navigate('/'); }}>主页</Button>
        </Space>}
      />
    </PageContainer>
  );
};

export default ErrorPage;