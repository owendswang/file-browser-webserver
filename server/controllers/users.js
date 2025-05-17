const method = async (req, res) => {
  const db = res.locals.db;

  const { sortBy, order, page, pageSize, search } = req.query;

  const pageInt = parseInt(page, 10) || 1;
  const pageSizeInt = parseInt(pageSize, 10) || 20;

  const queryVars = [];
  const countQueryVars = [];

  let where = 'WHERE id != ?';
  queryVars.push(1);
  if (search) {
    where += ' AND LOWER(username) LIKE ?';
    const likeStr = `%${search.toLowerCase()}%`;
    queryVars.push(likeStr);
    countQueryVars.push(likeStr);
  }

  let queryOrder = '';
  if (sortBy) {
    queryOrder = `ORDER BY ${sortBy} ${order.toUpperCase()}`;
  }

  const limit = pageSizeInt;
  const offset = (pageInt - 1) * pageSizeInt;

  queryVars.push(limit, offset);

  const query = `SELECT id, username, approved FROM users ${where} ${queryOrder} LIMIT ? OFFSET ?`;
  const users = db.prepare(query).all(...queryVars);

  try {
    const countQuery = `SELECT COUNT(*) FROM users ${where}`;
    const countRes = db.prepare(countQuery).get(...countQueryVars);
    const total = countRes['COUNT(*)'];
    const totalPages = Math.ceil(total / pageSizeInt);

    const pages = [];
    for (let i = 1; i <= total; i++) {
      if (Math.abs(i - pageInt) < 3 || i === pageInt || i === 1 || i === total) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    const pagination = {
      currentPage: pageInt,
      totalPages,
      pageSize: pageSizeInt,
      pages,
      total,
    };

    const responseData = {
      users,
      pagination,
    };

    return res.json(responseData);
  } catch (error) {
    console.error(error);
    return res.status(500),send(`Error getting users:\n${error.message}`);
  }
}

module.exports = method;
