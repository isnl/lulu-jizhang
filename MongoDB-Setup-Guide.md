# MongoDB 连接设置指南

## 🎯 推荐方案：MongoDB Atlas（免费云数据库）

### 步骤1：创建MongoDB Atlas账户
1. 访问 https://www.mongodb.com/atlas
2. 点击 "Try Free" 创建免费账户
3. 验证邮箱并登录

### 步骤2：创建集群
1. 选择 "Build a Database"
2. 选择 "FREE" 计划（M0 Sandbox）
3. 选择云提供商和区域（推荐选择离您最近的区域）
4. 集群名称可以保持默认或自定义
5. 点击 "Create Cluster"

### 步骤3：设置数据库访问
1. 在左侧菜单选择 "Database Access"
2. 点击 "Add New Database User"
3. 选择 "Password" 认证方式
4. 设置用户名和密码（请记住这些信息）
5. 在 "Database User Privileges" 选择 "Read and write to any database"
6. 点击 "Add User"

### 步骤4：设置网络访问
1. 在左侧菜单选择 "Network Access"
2. 点击 "Add IP Address"
3. 选择 "Allow Access from Anywhere" (0.0.0.0/0)
4. 点击 "Confirm"

### 步骤5：获取连接字符串
1. 回到 "Database" 页面
2. 点击您的集群的 "Connect" 按钮
3. 选择 "Connect your application"
4. 选择 "Node.js" 和版本 "4.1 or later"
5. 复制连接字符串，格式类似：
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 步骤6：配置应用
1. 在项目根目录创建 `.env` 文件：
   ```
   MONGODB_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/accounting?retryWrites=true&w=majority
   ```
   
2. 或者直接修改 `config.js` 文件，将连接字符串替换到相应位置

## 🔧 备选方案：本地MongoDB安装

### Windows安装
1. 下载MongoDB Community Server：
   https://www.mongodb.com/try/download/community
2. 运行安装程序，选择 "Complete" 安装
3. 勾选 "Install MongoDB as a Service"
4. 安装完成后，MongoDB会自动启动

### 启动MongoDB服务
```bash
# 方法1：通过服务管理器
services.msc -> 找到MongoDB -> 启动

# 方法2：命令行
net start MongoDB
```

### 验证安装
```bash
# 连接到MongoDB
mongo
# 或者新版本
mongosh
```

## 🐳 Docker方案（推荐给开发者）

```bash
# 拉取并运行MongoDB容器
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest

# 验证运行状态
docker ps
```

## 🧪 测试连接

运行测试脚本验证连接：
```bash
node test-mongodb.js
```

或者启动应用查看连接状态：
```bash
npm run dev
```

## 🔍 故障排除

### 常见错误及解决方案

1. **MongoServerSelectionError**
   - 检查网络连接
   - 确认MongoDB服务正在运行
   - 检查防火墙设置

2. **Authentication failed**
   - 检查用户名和密码
   - 确认用户权限设置正确

3. **Connection timeout**
   - 检查网络连接
   - 尝试增加超时时间
   - 确认IP白名单设置

### 环境变量设置

创建 `.env` 文件（推荐）：
```env
MONGODB_URL=your_mongodb_connection_string_here
PORT=3000
```

然后在应用中使用：
```javascript
require('dotenv').config();
```

## 📞 获取帮助

如果遇到问题，可以：
1. 查看MongoDB Atlas文档
2. 检查应用日志
3. 使用测试脚本诊断问题
