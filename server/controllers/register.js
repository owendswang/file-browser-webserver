const { randomBytes } = require('crypto');
const hashPassword = require('@/utils/hassPassword');

const method = async (req, res) => {
  const db = res.locals.db;

  const { username, password, confirm } = req.body;
  if (!username || !password) {
    return res.status(400).send('Error creating user:\nUsername and password required.');
  }
  if (password !== confirm) {
    return res.status(400).send('Error creating user:\n2 passwords not match');
  }

  const salt = randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(password, salt);

  try {
    let query = 'INSERT INTO users (username, password, salt) VALUES (?, ?, ?)';
    db.prepare(query).run(username, hashedPassword, salt);

    query = 'SELECT * FROM users WHERE username = ? AND password = ? AND salt = ?';
    let row = db.prepare(query).get(username, hashedPassword, salt);

    if (row?.id) {
      return res.status(201).end();
    }
  } catch (e) {
    console.error(e);
    if (e.message.includes('UNIQUE')) return res.status(409).send('Error creating user:\nUsername already exists.')
    return res.status(400).send(`Error creating user:\n${e.message}`);
  }
}

module.exports = method;
