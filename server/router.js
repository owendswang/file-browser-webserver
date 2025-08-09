const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
// const cors = require('cors');
const compression = require('compression')
const Thumbnails = require('./utils/thumbnails');
const homeRouter = require('./controllers/home');
const folderRouter = require('./controllers/folder');
const folderTreeRouter = require('./controllers/folderTree');
const downloadRouter = require('./controllers/download');
const viewRouter = require('./controllers/view');
const diskRouter = require('./controllers/disk');
const previewRouter = require('./controllers/preview');
// const playRouter = require('./controllers/play');
const uploadRouter = require('./controllers/upload');
const deleteRouter = require('./controllers/delete');
const moveRouter = require('./controllers/move');
const copyRouter = require('./controllers/copy');
const decompressRouter = require('./controllers/decompress');
const renameRouter = require('./controllers/rename');
const getConfigRouter = require('./controllers/getConfig');
const setConfigRouter = require('./controllers/setConfig');
const mkDirRouter = require('./controllers/mkDir');
const briefRouter = require('./controllers/brief');
const sleepRouter = require('./controllers/sleep');
const registerRouter = require('./controllers/register');
const logoutRouter = require('./controllers/logout');
const getUserInfoRouter = require('./controllers/getUserInfo');
const setUserInfoRouter = require('./controllers/setUserInfo');
const loginRouter = require('./controllers/login');
const tokenRouter = require('./controllers/token');
const usersRouter = require('./controllers/users');
const updateUserRouter = require('./controllers/updateUser');
const deleteUserRouter = require('./controllers/deleteUser');
const recycleRouter = require('./controllers/recycle');
const recycleMoveRouter = require('./controllers/recycleMove');
const recycleDeleteRouter = require('./controllers/recycleDelete');
const emptyRecycleRouter = require('./controllers/emptyRecycle');
const restoreRouter = require('./controllers/restore');
const clearCacheRouter = require('./controllers/clearCache');
const clearTempRouter = require('./controllers/clearTemp');
const db = require('./db');
const OAuth2Server = require('./oauth2');
const getConfig = require('./utils/getConfig');
const thumbnails = require('./utils/thumbnails');

const config = getConfig();

// create application/json parser
router.use(bodyParser.json());

// create application/x-www-form-urlencoded parser
router.use(bodyParser.urlencoded({ extended: false }));

// enable compression and res.flush()
router.use(compression());

// pass db object to methods
const dbMiddleWare = (req, res, next) => {
  res.locals.db = db;
  return next();
}

// create one single Thumbnail object for all methods
const thumbnailMiddleWare = (req, res, next) => {
  res.locals.thumbnails = thumbnails;
  return next();
}

// create one single OAuth2.0 server
const oauth = new OAuth2Server(db, true);
const oauthServerMiddleWare = (req, res, next) => {
  res.locals.oauthServer = oauth;
  return next();
}

// prevent cache
const nocacheMiddleware = (req, res, next) => {
  res.set('Surrogate-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Expires', '0');
  return next();
}

// Middleware that converts cookies to form data
router.use(cookieParser());
const cookie2token = (req, res, next) => {
  const accessToken = req.cookies.access_token;
  if (accessToken) {
    req.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return next();
}
router.use(cookie2token);

// Home route to display mounted folders
router.get('/api/home', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), homeRouter);

// Serve folder contents dynamically
router.get('/api/folder/*', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), folderRouter);

// Serve folder contents dynamically
router.get('/api/foldertree/*', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), folderTreeRouter);

// File download route
router.get('/download/*', thumbnailMiddleWare, downloadRouter);

// File upload route
router.post('/api/upload/*', oauth.authenticate({ scope: ['admin'] }), uploadRouter);

// File delete route
router.post('/api/delete/*', oauth.authenticate({ scope: ['admin'] }), deleteRouter);

// File delete route
router.post('/api/delete', oauth.authenticate({ scope: ['admin'] }), recycleDeleteRouter);

// File move route
router.post('/api/move/*', oauth.authenticate({ scope: ['admin'] }), moveRouter);

// File move route
router.post('/api/move', oauth.authenticate({ scope: ['admin'] }), recycleMoveRouter);

// File copy route
router.post('/api/copy/*', oauth.authenticate({ scope: ['admin'] }), copyRouter);

// Archive file decompress route
router.post('/api/decompress/*', oauth.authenticate({ scope: ['admin'] }), decompressRouter);

// File rename route
router.get('/api/rename/*', oauth.authenticate({ scope: ['admin'] }), renameRouter);

// Serve files for viewing
router.get('/api/view/*', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), viewRouter);

// Serve SMART information for a specific disk
router.get('/api/disk/*', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), diskRouter);

// Image and video  preview and caching
router.get('/preview/*', thumbnailMiddleWare, previewRouter);

// Video transcode to m3u8
// router.get('/play/*', cors(), thumbnailMiddleWare, playRouter);

// Get config data
router.get('/api/config', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), getConfigRouter);

// Set config data
router.post('/api/config', oauth.authenticate({ scope: ['admin'] }), setConfigRouter);

// Create directory
router.get('/api/mkdir/*', oauth.authenticate({ scope: ['admin'] }), mkDirRouter);

// Put all disks to sleep
router.get('/api/sleep', oauth.authenticate({ scope: ['admin'] }), sleepRouter);

// Get brief of file
router.get('/api/brief/*', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), briefRouter);

// User register
router.post('/api/register', nocacheMiddleware, dbMiddleWare, registerRouter);

// User login
router.post('/api/login', nocacheMiddleware, (req, res, next) => {
  req.body.grant_type = 'password';
  req.body.client_id = config.oauth.clientId;
  req.body.client_secret = config.oauth.clientSecret;
  return next();
}, oauth.token(), loginRouter);

// OAuth2 token
router.post('/api/token', nocacheMiddleware, (req, res, next) => {
  const refreshToken = req.cookies.refresh_token;
  if (refreshToken) {
    req.body.refresh_token = refreshToken;
  }
  req.body.grant_type = 'refresh_token';
  req.body.client_id = config.oauth.clientId;
  req.body.client_secret = config.oauth.clientSecret;
  return next();
}, oauth.token(), tokenRouter);

// User logout
router.post('/api/logout', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), oauthServerMiddleWare, dbMiddleWare, logoutRouter);

// Get user info
router.get('/api/user', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), getUserInfoRouter);

// Get user info
router.post('/api/user', nocacheMiddleware, oauth.authenticate({ scope: ['view'] }), dbMiddleWare, setUserInfoRouter);

// list all users
router.get('/api/users', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), dbMiddleWare, usersRouter);

// manage specific user
router.post('/api/users/:id', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), dbMiddleWare, updateUserRouter);

// delete specific user
router.delete('/api/users/:id', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), dbMiddleWare, deleteUserRouter);

// list items in all recycle bins
router.get('/api/recycle', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), recycleRouter);

// empty items in all recycle bins
router.delete('/api/recycle', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), emptyRecycleRouter);

// restore deleted files from recycle bins
router.post('/api/restore', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), restoreRouter);

// clear cache
router.get('/api/clearcache', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), clearCacheRouter);

// clear temp files
router.get('/api/cleartemp', nocacheMiddleware, oauth.authenticate({ scope: ['admin'] }), clearTempRouter);

module.exports = router;
