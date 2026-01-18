// 应用配置文件
const config = {
  // 记录类型
  recordTypes: ['支出', '收入'],
  
  // 记录分类
  categories: ['学习', '娱乐', '美妆', '日用', '服饰', '人情', '还贷', '主业', '副业'],
  
  // 数据库配置
  database: {
    // 优先使用环境变量中的MongoDB连接字符串
    url: process.env.MONGODB_URL ||
         // MongoDB Atlas 连接字符串示例（需要替换为您的实际连接字符串）
         // 'mongodb+srv://username:password@cluster.mongodb.net/accounting?retryWrites=true&w=majority' ||
         // 本地MongoDB备选方案
         'mongodb://192.168.31.67:27017/accounting' ||
         'mongodb://localhost:27017/accounting',
    options: {
      serverSelectionTimeoutMS: 5000, // 5秒超时
      connectTimeoutMS: 10000, // 10秒连接超时
      socketTimeoutMS: 45000, // 45秒socket超时
    }
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 3000
  },
  
  // 验证规则
  validation: {
    amount: {
      min: 0,
      max: 999999999
    },
    monthFormat: /^\d{4}-\d{2}$/
  }
};

module.exports = config;
