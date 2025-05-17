require('module-alias/register');
const path = require('path');
// const { styleText } = require('util');
const express = require('express');
const router = require('./router');

const app = express();
const PORT = 3000;

// logger middleware
app.use((req, res, next) => {
  const start = Date.now(); // 记录开始时间
  console.log(`[${req.method}] - ${req.hostname} - ${decodeURIComponent(req.path)} - (${new Date(start).toLocaleString()})`);
  /*process.stdout.write(styleText('grey', `[${req.method}] - ${req.hostname} - ${decodeURIComponent(req.path)} - (${new Date(start).toLocaleString()})\n`));

  // 设置响应结束事件的监听
  res.on('finish', () => {
    const end = Date.now(); // 记录结束时间
    const duration = end - start; // 计算持续时间
    process.stdout.write(`[${req.method}] - ${req.hostname} - ${decodeURIComponent(req.path)} - (${new Date(end).toLocaleString()}) - [${res.statusCode}] [${duration}ms]\n`);
  });*/

  next(); // 继续处理请求
});

app.use(express.static(path.resolve(__dirname, 'public')));

app.use('/', router);

app.get('*', (req, res) => {
  return res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
})

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
