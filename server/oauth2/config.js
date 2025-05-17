const { randomBytes } = require('crypto');
const hashPassword = require('@/utils/hassPassword');
const getConfig = require('@/utils/getConfig');

module.exports = (db, verbose = false) => {
  const config = getConfig();
  const clientId = config.oauth.clientId;
  const clientSecret = config.oauth.clientSecret;
  const clientUserId = config.oauth.clientUserId;
  const clientScope = ['admin', 'view'];
  
  return {
    model: {
      generateAccessToken: (client, user, scope) => {
        if (verbose) console.log('generateAccessToken');
        // 生成访问令牌
        return randomBytes(32).toString('hex'); // 生成随机访问令牌
      },
      generateRefreshToken: (client, user, scope) => {
        if (verbose) console.log('generateRefreshToken');
        // 生成刷新令牌
        return randomBytes(32).toString('hex'); // 生成随机刷新令牌
      },
      /*generateAuthorizationCode: (client, user, scope) => {
        if (verbose) console.log('generateAuthorizationCode');
        // 生成客户端认证秘钥，这里不需要，直接返回固定值
        return clientSecret;
      },*/
      getClient: async (clientId, clientSecret) => {
        if (verbose) console.log('getClient');
        // 获取客户端信息（需根据需求进行实际查找，这里返回固定值）
        return {
          id: clientId,
          secret: clientSecret,
          grants: ['client_credentials', 'refresh_token', 'password']
        };
      },
      getUserFromClient: async (client) => {
        if (verbose) console.log('getUserFromClient');
        // 客户端认证不与用户绑定，所以虚拟一个固定用户
        if (client.id === clientId && client.secret === clientSecret) {
          return { id: clientUserId };
        } else {
          return null;
        }
      },
      getUser: (username, password, client) => {
        if (verbose) console.log('getUser');
        const user = db.prepare('SELECT * FROM users WHERE username = ? and approved = ?').get(username, 1);
        if (!user) return false;

        const hashedPassword = hashPassword(password, user.salt);
        return hashedPassword === user.password ? { id: user.id, username: user.username, scope: JSON.parse(user.scope) } : false;
      },
      saveToken: async (token, client, user) => {
        if (verbose) console.log('saveToken');
        // 删除过期的刷新令牌
        db.exec('DELETE FROM tokens WHERE refreshTokenExpiresAt < CURRENT_TIMESTAMP');

        // console.log(token);
        // 保存令牌，包括访问令牌和刷新令牌
        db.prepare('INSERT OR REPLACE INTO tokens (accessToken, refreshToken, userId, accessTokenExpiresAt, refreshTokenExpiresAt) VALUES (?, ?, ?, ?, ?)').run(
          token.accessToken,
          token.refreshToken,
          user.id,
          token.accessTokenExpiresAt.toISOString(),
          token.refreshTokenExpiresAt.toISOString(),
        );
        return {
          ...token,
          scope: user.scope || [],
          client,
          user
        };
      },
      validateScope: async (user, client, scope) => {
        if (verbose) console.log('validateScope'/*, scope*/);
        // 不需要验证作用域，直接返回
        return clientScope;
      },
      getAccessToken: async (accessToken) => {
        if (verbose) console.log('getAccessToken');
        const token = db.prepare('SELECT * FROM tokens WHERE accessToken = ?').get(accessToken);
        if (!token) return false;
        const user = db.prepare('SELECT * FROM users WHERE id = ? and approved = ?').get(token.userId, 1);
        if (!user) return false;
        return {
          accessToken,
          accessTokenExpiresAt: new Date(token.accessTokenExpiresAt),
          scope: JSON.parse(user.scope),
          client: { id: clientId },
          user: { id: token.userId, username: user.username, scope: JSON.parse(user.scope) }
        };
      },
      getRefreshToken: async (refreshToken) => {
        if (verbose) console.log('getRefreshToken'/*, refreshToken*/);
        const token = db.prepare('SELECT * FROM tokens WHERE refreshToken = ?').get(refreshToken);
        // console.log(token);
        if (!token) return false;
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(token.userId);
        if (!user) return false;
        return {
          refreshToken,
          refreshTokenExpiresAt: new Date(token.refreshTokenExpiresAt),
          scope: JSON.parse(user.scope),
          client: { id: clientId },
          user: { id: token.userId }
        };
      },
      /*getAuthorizationCode: async (authorizationCode) => {
        if (verbose) console.log('getAuthorizationCode');
        // 校验客户端秘钥，这里不需要，直接返回固定值
        return {
          authorizationCode: clientSecret,
          expiresAt: new Date(8640000000000000),
          redirectUri: '',
          scope: [],
          client: { id: clientId },
          user: {},
        };
      },*/
      revokeToken: async (token) => {
        if (verbose) console.log('revokeToken');
        const res = db.prepare('DELETE FROM tokens WHERE refreshToken = ?').run(token.refreshToken);
        if (res.changes) {
          return true;
        } else {
          return false;
        }
      },
      verifyScope: (token, requestedScopes) => {
        if (verbose) console.log('verifyScope'/*, requestedScopes*/);
        if (!token.scope) return false;
        return requestedScopes.every(s => token.scope.includes(s));
      },
      /*validateRedirectUri: (redirectUri, client) => {
        if (verbose) console.log('validateRedirectUri');
        // 不需要，直接通过
        return true;
      },
      saveAuthorizationCode: (code, client, user) => {
        if (verbose) console.log('saveAuthorizationCode');
        // 不需要，直接返回
        return {
          authorizationCode: clientSecret,
          expiresAt: new Date(8640000000000000),
          redirectUri: '',
          scope: [],
          client: { id: clientId },
          user: {},
        };
      },*/
    },
    useErrorHandler: false,
    continueMiddleware: true,
    // options for 'authenticate'
    scope: undefined,
    addAcceptedScopesHeader: true,
    addAuthorizedScopesHeader: true,
    allowBearerTokensInQueryString: false,
    // options for 'authorize'
    authenticateHandler: undefined,
    allowEmptyState: false,
    authorizationCodeLifetime: 300, // 5 minutes
    // options for 'token'
    accessTokenLifetime: 3600, // 1 hour
    refreshTokenLifetime: 1209600, // 2 weeks
    allowExtendedTokenAttributes: false,
    requireClientAuthentication: {
      authorization_code: true,
      client_credentials: true,
      password: true,
      refresh_token: true,
    },
    alwaysIssueNewRefreshToken: true,
    extendedGrantTypes: {},
  };
};