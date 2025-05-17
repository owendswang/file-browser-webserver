import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams, Link } from 'react-router';
import { ConfigProvider, Switch, theme, message, FloatButton, Dropdown } from 'antd';
import { MoonOutlined, SunOutlined, SettingOutlined, UserOutlined, LogoutOutlined, LoadingOutlined, TeamOutlined, GithubOutlined } from '@ant-design/icons';
import { ProLayout, DefaultFooter } from '@ant-design/pro-components';
import enUS from 'antd/locale/en_US';
import handleErrorContent from '@/utils/handleErrorContent';
import userService from '@/services/user';
import '@/pages/Layout/index.css';

const { defaultAlgorithm, darkAlgorithm } = theme;

const Layout = () => {
  const location = useLocation();

  let navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const [messageApi, messageContextHolder] = message.useMessage();

  const [darkMode, setDarkMode] = useState((window.localStorage.getItem('darkMode') === 'true') ? true : false);
  const [user, setUser] = useState({});

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

  const footerRender = (props) => {
    return (
      <DefaultFooter
        copyright={`2024-${BUILD_YEAR} OWENDSWANG`}
        links={[{
          key: 'github',
          title: <><GithubOutlined /> File Browser v{APP_VERSION}</>,
          href: 'https://github.com/owendswang/file-browser',
          blankTarget: true,
        }]}
      />
    );
  }

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
        messageApi.error(`Failed to logout: ${handleErrorContent(e)}`);
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
              label: 'Edit Info',
            },
            (user.scope && user.scope.includes('admin')) && ({
              key: 'users',
              icon: <TeamOutlined />,
              label: 'User management',
            }),
            (user.scope && user.scope.includes('admin')) && ({
              key: 'config',
              icon: <SettingOutlined />,
              label: 'Config',
            }), {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Logout',
            }].filter(Boolean),
            onClick: avatarDropdownOnClick
          }}
        >
          {dom}
        </Dropdown>
      );
    },
  };

  const actionsRender = (props) => {
    return [
      <div><Switch
        key="darkMode"
        checked={darkMode}
        onChange={handleDarkModeSwitch}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
      /></div>
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
      locale={enUS}
    >
      {messageContextHolder}
      {['/login', '/register'].includes(location.pathname) ?
      <div className={`loginCtn${darkMode ? ' ant-dark' : ''}`}>
        <Outlet />
      </div> :
      <ProLayout
        layout='top'
        logo={<img src="/favicon.ico" alt="logo" />}
        title="File Browser"
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