const method = async (req, res) => {
  const db = res.locals.db;

  const { id } = req.params;

  if (typeof(req.body) !== 'object' || Object.keys(req.body).length === 0) {
    return res.status(400).send(`Error updating user ${id}:\nNo data provided`);
  }

  try {
    const query = `UPDATE users SET ${Object.keys(req.body).map((key) => `${key} = ?`).join(', ')} WHERE id = ?`;
    const vars = [
      ...Object.entries(req.body).map(([_, val]) => val),
      parseInt(id, 10)
    ];

    const { changes } = db.prepare(query).run(...vars);
    if (!changes) {
      return res.status(404).send(`Error updating user ${id}:\nUser not found`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(`Error updating user ${id}:\n${error.message}`);
  }

  return res.end();
}

module.exports = method;
