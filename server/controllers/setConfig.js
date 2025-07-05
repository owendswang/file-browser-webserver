const fs = require('fs');

const method = async (req, res) => {
  let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  fs.writeFile('./config.json', JSON.stringify({
    ...config,
    ...req.body,
  }, null, '  '), 'utf8', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send(`Error writing to config file:\n${err.message}`);
    }
    return res.end();
  });
}

module.exports = method;