const method = async (req, res) => {
  const oauthServer = res.locals.oauthServer;
  const oauth = res.locals.oauth;
  const db = res.locals.db;
  // console.log(oauth, oauthServer, db);

  // const { refreshToken } = req.body;
  const { refreshToken } = db.prepare('SELECT refreshToken FROM tokens WHERE accessToken = ?').get(oauth.token.accessToken);
  if (!refreshToken) {
    return res.status(400).send('Failed to logout:\nMissing data.');
  }

  await oauthServer.server.options.model.revokeToken({ refreshToken });

  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/token' });
  res.clearCookie('autoLogin', { path: '/' });

  return res.end();
}

module.exports = method;
