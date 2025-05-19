import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhConfig from '../pages/Config/translations/zh-CN.json';
import zhDisk from '../pages/Disk/translations/zh-CN.json';
import zhFolder from '../pages/Folder/translations/zh-CN.json';
import zhHome from '../pages/Home/translations/zh-CN.json';
import zhLayout from '../pages/Layout/translations/zh-CN.json';
import zhLogin from '../pages/Login/translations/zh-CN.json';
import zhPlay from '../pages/Play/translations/zh-CN.json';
import zhUser from '../pages/User/translations/zh-CN.json';
import zhUsers from '../pages/Users/translations/zh-CN.json';
import zhView from '../pages/View/translations/zh-CN.json';
import zhNotFound from '../components/NotFound/translations/zh-CN.json';
import zhErrorPage from '../components/ErrorPage/translations/zh-CN.json';

import enConfig from '../pages/Config/translations/en-US.json';
import enDisk from '../pages/Disk/translations/en-US.json';
import enFolder from '../pages/Folder/translations/en-US.json';
import enHome from '../pages/Home/translations/en-US.json';
import enLayout from '../pages/Layout/translations/en-US.json';
import enLogin from '../pages/Login/translations/en-US.json';
import enPlay from '../pages/Play/translations/en-US.json';
import enUser from '../pages/User/translations/en-US.json';
import enUsers from '../pages/Users/translations/en-US.json';
import enView from '../pages/View/translations/en-US.json';
import enNotFound from '../components/NotFound/translations/en-US.json';
import enErrorPage from '../components/ErrorPage/translations/en-US.json';

const defaultLanguage = 'zh-CN';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': {
        Config: zhConfig,
        Disk: zhDisk,
        Folder: zhFolder,
        Home: zhHome,
        Layout: zhLayout,
        Login: zhLogin,
        Play: zhPlay,
        User: zhUser,
        Users: zhUsers,
        View: zhView,
        NotFound: zhNotFound,
        ErrorPage: zhErrorPage,
      },
      'en-US': {
        Config: enConfig,
        Disk: enDisk,
        Folder: enFolder,
        Home: enHome,
        Layout: enLayout,
        Login: enLogin,
        Play: enPlay,
        User: enUser,
        Users: enUsers,
        View: enView,
        NotFound: enNotFound,
        ErrorPage: enErrorPage,
      }
    },
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
  });

export default i18n;