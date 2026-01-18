# 旧版本文件清理清单

## 📋 可以安全删除的旧版本文件

迁移到 Cloudflare 架构后，以下文件和目录已经不再需要，可以安全删除。

---

## 🗑️ 旧后端文件（Node.js + Express + MongoDB）

### 主要文件
- [ ] `app.js` - 旧的 Express 应用入口
- [ ] `RecordController.js` - 旧的控制器逻辑
- [ ] `Record Model.js` - Mongoose 数据模型
- [ ] `GET-records.js` - 旧的路由文件
- [ ] `config.js` - 旧的配置文件
- [ ] `test-api.js` - 旧的测试 API 服务器
- [ ] `test-mongodb.js` - MongoDB 测试脚本

### 文档
- [ ] `MongoDB-Setup-Guide.md` - MongoDB 设置指南（已不需要）
- [ ] `.env.example` - 旧的环境变量示例（MongoDB 相关）

---

## 🗑️ 旧前端文件（原生 HTML/JS）

### 目录
- [ ] `public/` - 整个目录
  - `public/main.js` - 旧的原生 JavaScript
  - `public/style.css` - 旧的 CSS 样式

**注意**: 删除整个 `public/` 目录即可

---

## 🗑️ 旧依赖相关

### package-lock.json
- [ ] `package-lock.json` - 旧的依赖锁文件

**建议**: 删除后重新运行 `npm install` 生成新的锁文件

---

## ✅ 新架构文件（保留）

### 后端 (Cloudflare Functions)
- ✅ `functions/` - Cloudflare Functions 目录
  - `functions/api/records.ts` - TypeScript API 端点
- ✅ `schema.sql` - D1 数据库架构
- ✅ `wrangler.toml` - Cloudflare 配置

### 前端 (Vue 3)
- ✅ `src/` - Vue 3 源码目录
  - `src/components/` - Vue 组件
  - `src/config/` - 配置文件
  - `src/types/` - TypeScript 类型
  - `src/App.vue` - 主应用
  - `src/main.ts` - 入口文件
  - `src/vite-env.d.ts` - 类型定义
- ✅ `index.html` - 新的 HTML 入口

### 配置文件
- ✅ `vite.config.ts` - Vite 配置
- ✅ `uno.config.ts` - UnoCSS 配置
- ✅ `tsconfig.json` - TypeScript 配置
- ✅ `tsconfig.node.json` - Node TypeScript 配置
- ✅ `package.json` - 新的依赖配置

### 环境变量
- ✅ `.env.development` - 开发环境变量
- ✅ `.env.production` - 生产环境变量

### 文档
- ✅ `README.md` - 项目文档
- ✅ `MIGRATION.md` - 迁移指南
- ✅ `QUICKSTART.md` - 快速开始
- ✅ `DEV-GUIDE.md` - 开发指南
- ✅ `CLEANUP.md` - 本文件

### 辅助目录
- ✅ `.wrangler-public/` - Wrangler Pages Dev 使用
- ✅ `.gitignore` - Git 忽略配置

---

## 🔧 清理步骤

### 方式 1: 手动删除（推荐）

逐个检查并删除，确保不误删：

```bash
# 1. 删除旧后端文件
rm app.js
rm RecordController.js
rm "Record Model.js"
rm GET-records.js
rm config.js
rm test-api.js
rm test-mongodb.js
rm MongoDB-Setup-Guide.md
rm .env.example

# 2. 删除旧前端目录
rm -rf public

# 3. 删除旧依赖锁文件
rm package-lock.json

# 4. 重新安装依赖
npm install
```

### 方式 2: 使用脚本（谨慎）

创建一个清理脚本 `cleanup.sh`:

```bash
#!/bin/bash
echo "开始清理旧版本文件..."

# 备份（可选）
mkdir -p .backup
cp -r public .backup/ 2>/dev/null
cp app.js .backup/ 2>/dev/null
cp RecordController.js .backup/ 2>/dev/null

# 删除文件
rm -f app.js RecordController.js "Record Model.js" GET-records.js
rm -f config.js test-api.js test-mongodb.js
rm -f MongoDB-Setup-Guide.md .env.example
rm -rf public
rm -f package-lock.json

echo "清理完成！"
echo "备份文件保存在 .backup/ 目录"
```

---

## ⚠️ 注意事项

### 删除前确认

1. **确保新版本正常运行**
   - 前端可以访问 (http://localhost:5173)
   - API 可以正常响应 (http://localhost:8787)
   - 数据库操作正常

2. **备份重要数据**
   - 如果 MongoDB 中有重要数据，先导出
   - 可以创建备份目录保存旧文件

3. **Git 版本控制**
   - 如果使用 Git，先提交当前状态
   - 删除后可以随时恢复

### 删除后操作

```bash
# 1. 重新安装依赖
npm install

# 2. 测试新版本
npm run dev        # 终端 1
npm run dev:api    # 终端 2

# 3. 访问测试
# http://localhost:5173
```

---

## 📊 文件大小对比

### 旧版本
- 后端: ~15 KB (7 个文件)
- 前端: ~15 KB (2 个文件)
- 文档: ~3 KB
- **总计**: ~33 KB

### 新版本
- 后端: ~8 KB (1 个 TypeScript 文件)
- 前端: ~20 KB (多个 Vue 组件)
- 配置: ~5 KB
- 文档: ~15 KB
- **总计**: ~48 KB

**代码更模块化，但总体大小相近**

---

## ✅ 清理检查清单

删除后检查以下项目：

- [ ] `npm run dev` 可以正常启动
- [ ] `npm run dev:api` 可以正常启动
- [ ] 前端页面可以访问
- [ ] API 请求正常
- [ ] 数据库操作正常
- [ ] 构建成功: `npm run build`
- [ ] 没有报错或警告

---

## 🎯 推荐清理时机

1. **立即清理**: 如果确认新版本完全正常
2. **测试后清理**: 运行 1-2 天，确保稳定后清理
3. **部署后清理**: 部署到生产环境并验证后清理

---

## 💡 提示

如果不确定是否要删除某个文件，可以：
1. 先移动到 `.backup/` 目录
2. 运行一段时间
3. 确认不需要后再删除

```bash
mkdir -p .backup
mv app.js .backup/
mv public .backup/
# ... 测试一段时间 ...
rm -rf .backup  # 确认后删除备份
```
