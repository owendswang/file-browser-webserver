const method = async (req, res) => {
  const oauth = res.locals.oauth;
  // console.log(oauth);

  return res.json(oauth.token.user);
}

module.exports = method;