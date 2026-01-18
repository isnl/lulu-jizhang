# 迁移指南：从 Express + MongoDB 到 Cloudflare Pages + D1

## 架构变化总览

### 旧架构
- **后端**: Node.js + Express
- **数据库**: MongoDB (Mongoose)
- **前端**: 原生 HTML + JavaScript
- **部署**: 需要服务器托管

### 新架构
- **后端**: Cloudflare Functions (TypeScript)
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: Vue 3 + TypeScript + UnoCSS
- **部署**: Cloudflare Pages (无服务器)

## 主要改进

### 1. 性能提升
- ✅ 全球 CDN 分发
- ✅ 边缘计算，低延迟
- ✅ 自动缓存优化

### 2. 成本优化
- ✅ 无需服务器维护
- ✅ 按需付费
- ✅ 免费额度充足

### 3. 开发体验
- ✅ TypeScript 类型安全
- ✅ 现代化前端框架
- ✅ 组件化开发
- ✅ 热更新开发

### 4. 可维护性
- ✅ 代码结构清晰
- ✅ 类型定义完整
- ✅ 组件复用性高

## 文件对照表

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `app.js` | `functions/api/records.ts` | Express 路由 → Cloudflare Functions |
| `RecordController.js` | `functions/api/records.ts` | 控制器逻辑合并到 Functions |
| `Record Model.js` | `schema.sql` | Mongoose Model → D1 SQL Schema |
| `config.js` | `src/types/index.ts` | 配置常量 → TypeScript 类型 |
| `index.html` | `src/App.vue` + 组件 | 静态 HTML → Vue 组件 |
| `public/main.js` | `src/components/*.vue` | 原生 JS → Vue 组件 |
| `public/style.css` | UnoCSS 配置 | CSS → 原子化 CSS |

## 数据库迁移

### MongoDB → D1 转换

**旧 MongoDB Schema:**
```javascript
const recordSchema = new mongoose.Schema({
  type: String,
  category: String,
  amount: Number,
  date: Date,
  remark: String
})
```

**新 D1 Schema:**
```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  remark TEXT DEFAULT ''
)
```

### 数据迁移步骤

1. **导出 MongoDB 数据**
```bash
mongoexport --db=accounting --collection=records --out=records.json
```

2. **转换为 SQL 插入语句**
```javascript
// 转换脚本示例
const records = require('./records.json')
const sql = records.map(r => 
  `INSERT INTO records (type, category, amount, date, remark) 
   VALUES ('${r.type}', '${r.category}', ${r.amount}, '${r.date}', '${r.remark}');`
).join('\n')
```

3. **导入到 D1**
```bash
npx wrangler d1 execute accounting-db --file=./import.sql
```

## API 变化

### 旧 API (Express)
```javascript
app.post('/api/records', async (req, res) => {
  const record = new Record(req.body)
  await record.save()
  res.json({ success: true, data: record })
})
```

### 新 API (Cloudflare Functions)
```typescript
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await context.request.json()
  await context.env.DB.prepare(
    'INSERT INTO records (...) VALUES (...)'
  ).bind(...).run()
  return new Response(JSON.stringify({ success: true }))
}
```

## 前端变化

### 旧前端 (原生 JS)
```javascript
// main.js
const recordForm = document.getElementById('recordForm')
recordForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const formData = new FormData(recordForm)
  // ...
})
```

### 新前端 (Vue 3)
```vue
<script setup lang="ts">
const formData = ref({ ... })
const handleSubmit = async () => {
  // ...
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- ... -->
  </form>
</template>
```

## 部署流程

### 1. 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 2. 创建 D1 数据库
```bash
# 创建数据库
npx wrangler d1 create accounting-db

# 初始化 schema
npx wrangler d1 execute accounting-db --file=./schema.sql
```

### 3. 部署到 Cloudflare
```bash
# 构建项目
npm run build

# 部署
npm run deploy
```

或通过 Cloudflare Dashboard:
1. 登录 Cloudflare Dashboard
2. Pages → Create a project
3. 连接 Git 仓库
4. 配置构建设置:
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 添加环境变量绑定:
   - Variable name: `DB`
   - D1 database: `accounting-db`

## 功能对比

| 功能 | 旧版本 | 新版本 |
|------|--------|--------|
| 添加记录 | ✅ | ✅ |
| 查询记录 | ✅ | ✅ |
| 每日统计 | ✅ | ✅ |
| 每月统计 | ✅ | ✅ |
| 响应式设计 | ⚠️ 基础 | ✅ 完整 |
| 类型安全 | ❌ | ✅ |
| 组件化 | ❌ | ✅ |
| 现代 UI | ⚠️ 简单 | ✅ 精美 |

## 注意事项

### 1. D1 限制
- 单个数据库最大 2GB
- 每天最多 100,000 次读取（免费版）
- 每天最多 50,000 次写入（免费版）

### 2. Functions 限制
- CPU 时间限制：50ms（免费版）
- 内存限制：128MB
- 请求大小限制：100MB

### 3. 兼容性
- D1 使用 SQLite，部分 SQL 语法可能与 MongoDB 不同
- 需要调整日期处理逻辑（MongoDB Date → SQLite TEXT）

## 下一步

1. ✅ 完成代码迁移
2. ⏳ 测试所有功能
3. ⏳ 迁移现有数据
4. ⏳ 部署到生产环境
5. ⏳ 监控性能和错误

## 技术支持

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Vue 3 文档](https://vuejs.org/)
- [UnoCSS 文档](https://unocss.dev/)
