const { pbkdf2Sync } = require('crypto');

const hashPassword = (password, salt) => {
  const ALGORITHM = 'sha256';
  const ITERATIONS = 100000;
  const KEY_LENGTH = 32;
  const DIGEST = 'hex';
  return pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, ALGORITHM).toString(DIGEST);
}

module.exports = hashPassword;