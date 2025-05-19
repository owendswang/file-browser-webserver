import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router';
import { ConfigProvider, Switch, theme, message, FloatButton, Dropdown, Space } from 'antd';
import { MoonOutlined, SunOutlined, SettingOutlined, UserOutlined, LogoutOutlined, LoadingOutlined, TeamOutlined, GithubOutlined, DownOutlined, GlobalOutlined } from '@ant-design/icons';
import { ProLayout, DefaultFooter } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import * as dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import handleErrorContent from '@/utils/handleErrorContent';
import userService from '@/services/user';
import '@/pages/Layout/index.css';

const { defaultAlgorithm, darkAlgorithm } = theme;

const defaultLanguage = 'zh-CN';
const languageLabelMapping = {
  'zh-CN': '中文',
  'en-US': 'English'
};
const antdLocaleMapping = {
  'zh-CN': zhCN,
  'en-US': enUS
};
const dayjsLocaleMapping = {
  'zh-CN': 'zh-cn',
  'en-US': 'en',
}
dayjs.locale(dayjsLocaleMapping[window.localStorage.getItem('language') || defaultLanguage]);

const Layout = () => {
  const location = useLocation();

  let navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { t, i18n } = useTranslation('Layout');

  const [messageApi, messageContextHolder] = message.useMessage();

  const [darkMode, setDarkMode] = useState((window.localStorage.getItem('darkMode') === 'true') ? true : false);
  const [user, setUser] = useState({});
  const [language, setLanguage] = useState(window.localStorage.getItem('language') || defaultLanguage);

  const handleTitleClick = (e) => {
    let newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.delete('page');
    newSearchParams.delete('search');
    navigate({
      pathname: "/home",
      search: newSearchParams.toString() ? ('?' + newSearchParams.toString()) : '',
    });
  }

  const handleDarkModeSwitch = (checked, event) => {
    setDarkMode(checked);
    window.localStorage.setItem('darkMode', checked ? 'true' : 'false');
  }

  const footerRender = (props) => (
    <DefaultFooter
      copyright={`2024-${BUILD_YEAR} OWENDSWANG`}
      links={[{
        key: 'github',
        title: <><GithubOutlined /> {t('File Browser')} v{APP_VERSION}</>,
        href: 'https://github.com/owendswang/file-browser-webserver',
        blankTarget: true,
      }]}
    />
  );

  const logout = async () => {
    // const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
    // if (refreshToken) {
      try {
        const res = await userService.logout();
        /*sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('expiresAt');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('expiresAt');*/
        navigate({
          pathname: '/login',
          search: `?redirect=${encodeURIComponent(location.pathname)}`
        });
      } catch (e) {
        console.log(e);
        messageApi.error(`${t('Failed to logout: ')}${handleErrorContent(e)}`);
      }
    // }
  }

  const avatarDropdownOnClick = ({ key }) => {
    switch (key) {
      case 'edit':
        navigate('/user');
        break;
      case 'users':
        navigate('/users');
        break;
      case 'config':
        navigate('/config');
        break;
      case 'logout':
        logout();
        break;
      default:
        break;
    }
  };

  const avatarProps = {
    icon: Object.keys(user).length === 0 ? <LoadingOutlined /> : <UserOutlined />,
    size: 'small',
    title: user.username,
    render: (props, dom) => {
      return (
        Object.keys(user).length === 0 ?
        dom :
        <Dropdown
          menu={{
            items: [{
              key: 'edit',
              icon: <UserOutlined />,
              label: t('Edit Info'),
            },
            (user.scope && user.scope.includes('admin')) && ({
              key: 'users',
              icon: <TeamOutlined />,
              label: t('User management'),
            }),
            (user.scope && user.scope.includes('admin')) && ({
              key: 'config',
              icon: <SettingOutlined />,
              label: t('Config'),
            }), {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: t('Logout'),
            }].filter(Boolean),
            onClick: avatarDropdownOnClick
          }}
        >
          {dom}
        </Dropdown>
      );
    },
  };

  const languageDropdownMenuItems = Object.entries(languageLabelMapping).map(([key, val]) => ({ label: val, key }));

  const handleLanguageDropdownMenuClick = ({ key }) => {
    window.localStorage.setItem('language', key);
    setLanguage(key);
    dayjs.locale(dayjsLocaleMapping[key]);
    i18n.changeLanguage(key);
  }

  const actionsRender = (props) => {
    return [
      <Dropdown
        key="language"
        menu={{
          items: languageDropdownMenuItems,
          onClick: handleLanguageDropdownMenuClick
        }}
        placement="bottom"
      >
        <a onClick={(e) => e.preventDefault()} style={{ fontSize: '0.88rem' }}>
          <Space size="small" wrap={false}>
            <GlobalOutlined />
            {/*languageLabelMapping[language]*/}
            <DownOutlined />
          </Space>
        </a>
      </Dropdown>,
      <div key="darkMode">
        <Switch
          checked={darkMode}
          onChange={handleDarkModeSwitch}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
        />
      </div>
    ];
  }

  useEffect(() => {
    const controller = new AbortController();
    const initUser = async () => {
      try {
        const res = await userService.getUserInfo(controller.signal);
        setUser(res);
        if (['/login', '/register'].includes(location.pathname)) {
          if (location.search) {
            const sp = new URLSearchParams(location.search);
            const redirectUrl = sp.get('redirect');
            navigate(redirectUrl, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }
      } catch (e) {
        setUser({});
        console.log(e);
        if (!['/login', '/register'].includes(location.pathname)) {
          navigate({
            pathname: `/login`,
            search: ['/', '/login', '/register'].includes(location.pathname) ? location.search : `?redirect=${encodeURIComponent(location.pathname)}`
          }, { replace: true });
        }
      }
    }
    if ((Object.keys(user).length === 0 && location.pathname !== '/login') || location.pathname === '/login') {
      initUser();
    }
    return () => {
      controller.abort();
    }
  }, [location.pathname]);

  return (
    <ConfigProvider
      theme={{ algorithm: darkMode ? darkAlgorithm : defaultAlgorithm }}
      locale={antdLocaleMapping[language]}
    >
      {messageContextHolder}
      {['/login', '/register'].includes(location.pathname) ?
      <div className={`loginCtn${darkMode ? ' ant-dark' : ''}`}>
        <Outlet context={[languageDropdownMenuItems, handleLanguageDropdownMenuClick, /*languageLabelMapping, language,*/ darkMode, handleDarkModeSwitch]} />
      </div> :
      <ProLayout
        layout='top'
        logo={<img src="/favicon.ico" alt="logo" />}
        title={t("File Browser")}
        onMenuHeaderClick={handleTitleClick}
        footerRender={footerRender}
        actionsRender={actionsRender}
        avatarProps={avatarProps}
        loading={Object.keys(user).length === 0}
        className={darkMode ? 'ant-dark' : ''}
      >
        <Outlet context={[user, setUser]} />
        <FloatButton.BackTop />
      </ProLayout>}
    </ConfigProvider>
  );
};

export default Layout;