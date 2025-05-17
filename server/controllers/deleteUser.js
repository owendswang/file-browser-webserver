const method = async (req, res) => {
  const db = res.locals.db;

  const { id } = req.params;

  try {
    db.prepare('DELETE FROM tokens WHERE userId = ?').run(parseInt(id, 10));
    const query = 'DELETE FROM users WHERE id = ?';
    const { changes } = db.prepare(query).run(parseInt(id, 10));
    if (!changes) {
      return res.status(404).send(`Error deleting user ${id}:\nUser not found`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(`Error deleting user ${id}:\n${error.message}`);
  }

  return res.end();
}

module.exports = method;
