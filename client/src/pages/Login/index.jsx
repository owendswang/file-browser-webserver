import React, { Fragment, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Helmet } from "react-helmet";
import { Tabs, theme, Alert } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginFormPage, ProFormText, ProFormCheckbox } from '@ant-design/pro-components';
import handleErrorContent from '@/utils/handleErrorContent';
import userService from '@/services/user';
import '@/pages/Login/index.css';

const { useToken } = theme;

const Login = () => {
  const location = useLocation();

  const token = useToken();

  let navigate = useNavigate();

  const timerRef = useRef(0);

  const [message, setMessage] = useState('');

  const handleFormOnFinish = async (values) => {
    setMessage('');
    try {
      if (location.pathname === '/login') {
        const res = await userService.login(values);
        /*const currentDate = new Date();
        const expiresAt = new Date(currentDate.getTime() + res.expires_in * 1000);
        if (values.autoLogin) {
          localStorage.setItem('autoLogin', true);
          localStorage.setItem('accessToken', res.access_token);
          localStorage.setItem('refreshToken', res.refresh_token);
          localStorage.setItem('expiresAt', expiresAt);
        } else {
          localStorage.setItem('autoLogin', false);
          sessionStorage.setItem('accessToken', res.access_token);
          sessionStorage.setItem('refreshToken', res.refresh_token);
          sessionStorage.setItem('expiresAt', expiresAt);
        }*/
        if (location.search) {
          const sp = new URLSearchParams(location.search);
          const redirectUrl = sp.get('redirect');
          navigate(redirectUrl, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else if (location.pathname === '/register') {
        await userService.register(values);
        setMessage('Register successfully. Please Login now.');
        timerRef.current = setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (e) {
      console.log(e);
      setMessage(handleErrorContent(e));
    }
  }

  useEffect(() => {
    setMessage('');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [location.pathname]);

  return (
    <Fragment>
      <Helmet>
        <title>{(location.pathname === '/login') ? 'Login' : 'Register'} - File Browser</title>
      </Helmet>
      <LoginFormPage
        key={location.pathname}
        logo="/favicon.ico"
        title="File Browser"
        containerStyle={{
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          backdropFilter: 'blur(4px)',
        }}
        subTitle="Manage and view your files in a web browser"
        message={message ? <Alert message={message} type="error" /> : null}
        submitter={{
          searchConfig: {
            submitText: (location.pathname === '/login') ? 'Login' : 'Register',
          },
        }}
        onFinish={handleFormOnFinish}
        initialValues={(location.pathname === '/login') ? { autoLogin: true } : {}}
      >
        <Tabs
          centered
          activeKey={location.pathname}
          onChange={(activeKey) => navigate({ ...location, pathname: activeKey }, { replace: true })}
          items={[{
            key: '/login',
            label: 'Login',
            children: <Fragment>
              <ProFormText
                name="username"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <UserOutlined
                      style={{ color: token.colorText }}
                      className='prefixIcon'
                    />
                  ),
                }}
                placeholder='User Name'
                rules={[{
                  required: true,
                  message: 'Please input username',
                }, {
                  min: 4,
                  max: 16,
                  message: 'Length limit between 4 and 16'
                }]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{ color: token.colorText }}
                      className='prefixIcon'
                    />
                  ),
                }}
                placeholder='Password'
                rules={[{
                  required: true,
                  message: 'Please input password',
                }, {
                  min: 4,
                  max: 16,
                  message: 'Length limit between 4 and 16'
                }]}
              />
              <div style={{ marginBlockEnd: 42 }}>
                <ProFormCheckbox noStyle name="autoLogin">Auto Login</ProFormCheckbox>
              </div>
            </Fragment>,
          }, {
            key: '/register',
            label: 'Register',
            children: <Fragment>
              <ProFormText
                name="username"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <UserOutlined
                      style={{ color: token.colorText }}
                      className='prefixIcon'
                    />
                  ),
                }}
                placeholder='User Name'
                rules={[{
                  required: true,
                  message: 'Please input username!',
                }, {
                  min: 4,
                  max: 16,
                  message: 'Length limit between 4 and 16'
                }]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{ color: token.colorText }}
                      className='prefixIcon'
                    />
                  ),
                }}
                placeholder='Password'
                rules={[{
                  required: true,
                  message: 'Please input password!',
                }, {
                  min: 4,
                  max: 16,
                  message: 'Length limit between 4 and 16'
                }]}
              />
              <ProFormText.Password
                name="confirm"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{ color: token.colorText }}
                      className='prefixIcon'
                    />
                  ),
                }}
                placeholder='Repeat Password'
                rules={[{
                  required: true,
                  message: 'Please repeat your password!',
                }, {
                  min: 4,
                  max: 16,
                  message: 'Length limit between 4 and 16'
                }, ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('The new password that you entered do not match!'));
                  },
                })]}
              />
            </Fragment>,
          }]}
        />
      </LoginFormPage>
    </Fragment>
  );
}

export default Login;