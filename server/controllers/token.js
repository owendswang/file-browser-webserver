const method = async (req, res) => {
  // console.log(res.locals.oauth);
  // console.log(req.cookies);
  const { token } = res.locals.oauth;
  if (req.cookies.autoLogin === 'true') {
    res.cookie('autoLogin', true, {
      httpOnly: true,
      secure: false,
      maxAge: 31536000,
      sameSite: 'Strict'
    });
  } else {
    res.cookie('autoLogin', false, {
      httpOnly: true,
      secure: false,
      maxAge: 31536000,
      sameSite: 'Strict'
    });
  }
  if (token.accessToken && token.accessTokenExpiresAt) {
    res.cookie('access_token', token.accessToken, {
      httpOnly: true,
      secure: false,
      expires: req.cookies.autoLogin === 'true' ? token.accessTokenExpiresAt : null,
      signed: false,
      sameSite: 'Strict'
    });
  }
  if (token.refreshToken && token.refreshTokenExpiresAt) {
    res.cookie('refresh_token', token.refreshToken, {
      path: '/api/token',
      httpOnly: true,
      secure: false,
      expires: req.cookies.autoLogin === 'true' ? token.refreshTokenExpiresAt : null,
      signed: false,
      sameSite: 'Strict'
    });
  }
  // return res.send();
}

module.exports = method;