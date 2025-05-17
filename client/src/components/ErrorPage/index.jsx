import React from 'react';
import { useNavigate, useRouteError } from 'react-router';
import { Result, Button } from 'antd';
import { PageContainer } from '@ant-design/pro-components';

const ErrorPage = () => {
  const routeError = useRouteError();
  console.error(routeError);

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
        status={routeError.status}
        title={routeError.status}
        subTitle={routeError.statusText}
        extra={<Button type="primary" onClick={(e) => { navigate('/'); }}>返回主页</Button>}
      />
    </PageContainer>
  );
};

export default ErrorPage;