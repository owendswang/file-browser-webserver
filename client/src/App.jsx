import React from 'react';
import { Routes, Route } from 'react-router';
import Layout from './pages/Layout';
import ErrorPage from './components/ErrorPage';
import NotFound from './components/NotFound';
import Index from './pages/index';
import Home from './pages/Home';
import Folder from './pages/Folder';
import View from './pages/View';
import Play from './pages/Play';
import Disk from './pages/Disk';
import Config from './pages/Config';
import Login from './pages/Login';
import User from './pages/User';
import Users from './pages/Users';
import Recycle from './pages/Recycle';

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />} errorElement={<ErrorPage />}>
        <Route index element={<Index />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login />} />
        <Route path="user" element={<User />} />
        <Route path='home' element={<Home />} />
        <Route path='config' element={<Config />} />
        <Route path='folder/*' element={<Folder />} />
        <Route path='view/*' element={<View />} />
        <Route path='vaplay/*' element={<Play />} />
        <Route path='disk/:diskId' element={<Disk />} />
        <Route path="users" element={<Users />} />
        <Route path="recycle" element={<Recycle />} />
        <Route path='*' element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
