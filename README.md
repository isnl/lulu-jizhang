# Cloudflare AI记账小程序

基于 Cloudflare Pages + Functions + D1 的现代化记账应用

## 技术栈

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全
- **UnoCSS** - 原子化 CSS 引擎
- **Vite** - 下一代前端构建工具

### 后端
- **Cloudflare Functions** - 无服务器函数
- **Cloudflare D1** - SQLite 数据库
- **TypeScript** - 类型安全的 API

## 项目结构

```
├── functions/          # Cloudflare Functions (API)
│   └── api/
│       └── records.ts  # 记录 API 端点
├── src/               # Vue 3 前端源码
│   ├── components/    # Vue 组件
│   ├── types/         # TypeScript 类型定义
│   ├── App.vue        # 根组件
│   └── main.ts        # 入口文件
├── schema.sql         # D1 数据库架构
├── wrangler.toml      # Cloudflare 配置
├── vite.config.ts     # Vite 配置
├── uno.config.ts      # UnoCSS 配置
└── package.json       # 项目依赖
```

## 开发指南

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create accounting-db

# 记录返回的 database_id，更新到 wrangler.toml 中
```

### 3. 初始化数据库架构

```bash
npx wrangler d1 execute accounting-db --file=./schema.sql
```

### 4. 本地开发

```bash
# 启动前端开发服务器
npm run dev

# 在另一个终端启动 Cloudflare Functions 本地开发
npx wrangler pages dev dist --d1 DB=accounting-db
```

### 5. 构建项目

```bash
npm run build
```

### 6. 部署到 Cloudflare Pages

```bash
npm run deploy
```

或者通过 Cloudflare Dashboard:
1. 连接 Git 仓库
2. 设置构建命令: `npm run build`
3. 设置输出目录: `dist`
4. 绑定 D1 数据库

## 功能特性

- ✅ 添加收支记录
- ✅ 按月份查询统计
- ✅ 每日/每月分类汇总
- ✅ 响应式设计
- ✅ 现代化 UI
- ✅ 类型安全
- ✅ 无服务器架构

## API 端点

### POST /api/records
创建新记录

**请求体:**
```json
{
  "type": "支出",
  "category": "学习",
  "amount": 100,
  "date": "2024-01-15",
  "remark": "买书"
}
```

### GET /api/records
查询记录

**查询参数:**
- `startMonth`: 开始月份 (YYYY-MM)
- `endMonth`: 结束月份 (YYYY-MM)

**响应:**
- 单月查询: 返回每日明细
- 多月查询: 返回每月汇总

## 数据库架构

```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 环境变量

在 Cloudflare Pages 设置中配置:
- `DB`: D1 数据库绑定

## License

MIT
