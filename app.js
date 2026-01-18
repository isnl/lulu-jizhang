const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const recordRoutes = require('./GET-records');
const config = require('./config');

// 尝试加载环境变量（如果dotenv可用）
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using default config');
}

const app = express();
const PORT = config.server.port;

// 连接MongoDB
console.log('尝试连接MongoDB...');
console.log('连接URL:', config.database.url.replace(/\/\/.*@/, '//***:***@')); // 隐藏密码

mongoose.connect(config.database.url, config.database.options)
.then(() => {
  console.log('✅ MongoDB连接成功!');
  console.log('数据库名称:', mongoose.connection.db.databaseName);
})
.catch(err => {
  console.error('❌ MongoDB连接失败:', err.message);
  console.log('\n💡 解决方案:');
  console.log('1. 检查MongoDB服务是否启动');
  console.log('2. 验证连接字符串是否正确');
  console.log('3. 查看 MongoDB-Setup-Guide.md 获取详细设置指南');
  console.log('4. 考虑使用MongoDB Atlas云数据库');

  // 不退出进程，让应用继续运行（可以使用测试服务器）
  console.log('\n⚠️  应用将继续运行，但数据库功能不可用');
  console.log('💡 您可以访问 http://localhost:3001 使用测试版本');
});

// 监听连接事件
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose连接已建立');
});

mongoose.connection.on('error', (err) => {
  console.error('📡 Mongoose连接错误:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose连接已断开');
});

// 中间件
app.use(cors());
app.use(express.json());

// API路由
app.use('/api', recordRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器错误' });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 前端路由处理 - 仅匹配前端路由
app.get(['/', '/records', '/add-record'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
