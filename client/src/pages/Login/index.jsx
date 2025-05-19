import React, { Fragment, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router';
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { Tabs, theme, Alert, Space, Dropdown, Switch } from 'antd';
import { LockOutlined, UserOutlined, DownOutlined, MoonOutlined, SunOutlined, GlobalOutlined } from '@ant-design/icons';
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

  const [languageDropdownMenuItems, handleLanguageDropdownMenuClick, /*languageLabelMapping, language,*/ darkMode, handleDarkModeSwitch] = useOutletContext();

  const { t } = useTranslation('Login');

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
        <title>{(location.pathname === '/login') ? t('Login') : t('Register')} - {t('File Browser')}</title>
      </Helmet>
      <LoginFormPage
        key={location.pathname}
        logo="/favicon.ico"
        title={t("File Browser")}
        containerStyle={{
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          backdropFilter: 'blur(4px)',
        }}
        subTitle={t("Browse your files in the web-browser")}
        message={message ? <Alert message={t(message)} type="error" /> : null}
        submitter={{
          searchConfig: {
            submitText: (location.pathname === '/login') ? t('Login') : t('Register'),
          },
        }}
        onFinish={handleFormOnFinish}
        initialValues={(location.pathname === '/login') ? { autoLogin: true } : {}}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '1rem', marginBottom: '1rem' }}>
          <Dropdown
            key="language"
            menu={{
              items: languageDropdownMenuItems,
              onClick: handleLanguageDropdownMenuClick
            }}
            placement="bottomLeft"
          >
            <a onClick={(e) => e.preventDefault()} style={{ fontSize: '0.88rem' }}>
              <Space size="small" wrap={false}>
                <GlobalOutlined />
                {/*languageLabelMapping[language]*/}
                <DownOutlined />
              </Space>
            </a>
          </Dropdown>
          <div key="darkMode">
            <Switch
              checked={darkMode}
              onChange={handleDarkModeSwitch}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
          </div>
        </div>
        <Tabs
          centered
          activeKey={location.pathname}
          onChange={(activeKey) => navigate({ ...location, pathname: activeKey }, { replace: true })}
          items={[{
            key: '/login',
            label: t('Login'),
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
                placeholder={t('User Name')}
                rules={[{
                  required: true,
                  message: t('Please input username'),
                }, {
                  min: 4,
                  max: 16,
                  message: t('Length limit between 4 and 16')
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
                placeholder={t('Password')}
                rules={[{
                  required: true,
                  message: t('Please input password'),
                }, {
                  min: 4,
                  max: 16,
                  message: t('Length limit between 4 and 16')
                }]}
              />
              <div style={{ marginBlockEnd: 42 }}>
                <ProFormCheckbox noStyle name="autoLogin">{t('Auto Login')}</ProFormCheckbox>
              </div>
            </Fragment>,
          }, {
            key: '/register',
            label: t('Register'),
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
                placeholder={t('User Name')}
                rules={[{
                  required: true,
                  message: t('Please input username'),
                }, {
                  min: 4,
                  max: 16,
                  message: t('Length limit between 4 and 16')
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
                placeholder={t('Password')}
                rules={[{
                  required: true,
                  message: t('Please input password'),
                }, {
                  min: 4,
                  max: 16,
                  message: t('Length limit between 4 and 16')
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
                placeholder={t('Repeat Password')}
                rules={[{
                  required: true,
                  message: t('Please repeat your password'),
                }, {
                  min: 4,
                  max: 16,
                  message: t('Length limit between 4 and 16')
                }, ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('The new password that you entered do not match')));
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