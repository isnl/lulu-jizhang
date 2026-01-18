// MongoDB连接测试脚本
const mongoose = require('mongoose');

// 测试不同的MongoDB连接
const testConnections = [
  {
    name: '原始IP地址',
    url: 'mongodb://192.168.31.67:27017/accounting'
  },
  {
    name: '本地MongoDB',
    url: 'mongodb://localhost:27017/accounting'
  },
  {
    name: '本地MongoDB (127.0.0.1)',
    url: 'mongodb://127.0.0.1:27017/accounting'
  }
];

async function testConnection(config) {
  console.log(`\n🔍 测试连接: ${config.name}`);
  console.log(`📍 URL: ${config.url}`);
  
  try {
    // 设置较短的超时时间
    const connection = await mongoose.createConnection(config.url, {
      serverSelectionTimeoutMS: 5000, // 5秒超时
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    
    console.log(`✅ ${config.name} 连接成功！`);
    
    // 测试数据库操作
    const testSchema = new mongoose.Schema({ test: String });
    const TestModel = connection.model('Test', testSchema);
    
    // 尝试插入一条测试数据
    const testDoc = new TestModel({ test: 'connection test' });
    await testDoc.save();
    console.log(`✅ 数据库写入测试成功`);
    
    // 尝试查询数据
    const count = await TestModel.countDocuments();
    console.log(`✅ 数据库读取测试成功，共有 ${count} 条测试记录`);
    
    // 清理测试数据
    await TestModel.deleteMany({ test: 'connection test' });
    console.log(`✅ 测试数据清理完成`);
    
    await connection.close();
    return true;
    
  } catch (error) {
    console.log(`❌ ${config.name} 连接失败:`);
    console.log(`   错误类型: ${error.name}`);
    console.log(`   错误信息: ${error.message}`);
    
    if (error.name === 'MongoServerSelectionError') {
      console.log(`   💡 建议: 检查MongoDB服务是否启动，或者网络连接是否正常`);
    }
    
    return false;
  }
}

async function main() {
  console.log('🚀 开始MongoDB连接测试...\n');
  
  let successCount = 0;
  
  for (const config of testConnections) {
    const success = await testConnection(config);
    if (success) {
      successCount++;
      console.log(`\n🎉 找到可用的MongoDB连接: ${config.name}`);
      console.log(`   建议在config.js中使用: ${config.url}`);
      break; // 找到第一个可用连接就停止
    }
    
    // 等待一下再测试下一个
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (successCount === 0) {
    console.log('\n❌ 所有MongoDB连接都失败了');
    console.log('\n💡 解决方案:');
    console.log('1. 安装并启动本地MongoDB服务');
    console.log('2. 检查防火墙设置');
    console.log('3. 使用MongoDB Atlas云数据库');
    console.log('4. 使用Docker运行MongoDB');
    
    console.log('\n📋 快速启动MongoDB的方法:');
    console.log('方法1 - 使用MongoDB Community Server:');
    console.log('  下载: https://www.mongodb.com/try/download/community');
    console.log('  安装后运行: mongod');
    
    console.log('\n方法2 - 使用Docker:');
    console.log('  docker run -d -p 27017:27017 --name mongodb mongo');
    
    console.log('\n方法3 - 使用MongoDB Atlas (推荐):');
    console.log('  1. 访问 https://www.mongodb.com/atlas');
    console.log('  2. 创建免费账户和集群');
    console.log('  3. 获取连接字符串');
  }
  
  console.log('\n🏁 测试完成');
  process.exit(0);
}

// 处理未捕获的异常
process.on('unhandledRejection', (error) => {
  console.error('未处理的Promise拒绝:', error);
  process.exit(1);
});

main();
