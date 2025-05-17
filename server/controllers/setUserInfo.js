const { randomBytes } = require('crypto');
const hashPassword = require('@/utils/hassPassword');

const method = async (req, res) => {
  const oauth = res.locals.oauth;

  const db = res.locals.db;

  const { username, password, confirm } = req.body;

  let columns = [];

  if (username) columns.push({ name: 'username', value: username });

  if (password || confirm) {
    if (password === confirm) {
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = hashPassword(password, salt);

      columns.push({ name: 'password', value: hashedPassword });
      columns.push({ name: 'salt', value: salt });
    } else {
      return res.status(400).send('Error updating user:\n2 passwords not match');
    }
  }

  try {
    let query = `UPDATE users SET ${columns.map(col => `${col.name} = ?`).join(', ')} WHERE id = ?`;
    const { changes } = db.prepare(query).run(...columns.map(col => col.value), oauth.token.user.id);

    if (changes) {
      return res.json({ id: oauth.token.user.id, username });
    } else {
      return res.status(404).send(`Error updating user:\nUser not found`);
    }
  } catch (e) {
    console.error(e);
    if (e.message.includes('UNIQUE')) return res.status(409).send('Error updating user:\nUsername already exists.')
    return res.status(400).send(`Error updating user:\n${e.message}`);
  }
}

module.exports = method;