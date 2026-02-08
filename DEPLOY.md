# 部署指南

## 前置条件

1. 安装 Node.js (>= 18)
2. 安装依赖：`npm install`
3. 登录 Cloudflare：`npx wrangler login`

## 首次部署

### 1. 创建 D1 数据库

```bash
npx wrangler d1 create accounting-db
```

执行后会返回 `database_id`，更新到 `wrangler.toml` 中。

### 2. 初始化数据库

```bash
npx wrangler d1 execute accounting-db --remote --file=./schema.sql
```

### 3. 运行数据库迁移

```bash
npx wrangler d1 execute accounting-db --remote --file=./migrations/001_add_members.sql
npx wrangler d1 execute accounting-db --remote --file=./migrations/002_add_auth.sql
```

### 4. 部署应用

```bash
npm run deploy
```

首次部署会提示创建 Pages 项目，选择 `Create a new project`，项目名输入 `accounting-app`。

## 日常更新

```bash
npm run deploy
```

## 环境变量

在 Cloudflare Dashboard 设置以下变量（Settings > Environment variables）：

| 变量名 | 说明 |
|--------|------|
| DEEPSEEK_API_KEY | DeepSeek API 密钥 |
| JWT_SECRET | JWT 签名密钥（生产环境必改） |
| ADMIN_USERNAME | 管理员用户名 |
| ADMIN_PASSWORD | 管理员密码 |

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（前端） |
| `npm run build` | 构建项目 |
| `npm run deploy` | 构建并部署 |
| `npx wrangler d1 execute accounting-db --remote --file=./migrations/xxx.sql` | 运行迁移 |
| `npx wrangler d1 execute accounting-db --remote --command "SELECT * FROM records"` | 远程查询数据库 |
