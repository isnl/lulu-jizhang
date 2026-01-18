# 快速开始指南

## 🚀 5分钟快速部署

### 前置要求
- Node.js 18+ 
- npm 或 pnpm
- Cloudflare 账号

### 步骤 1: 安装依赖

```bash
npm install
```

### 步骤 2: 创建 D1 数据库

```bash
# 登录 Cloudflare
npx wrangler login

# 创建数据库
npx wrangler d1 create accounting-db
```

**重要**: 复制返回的 `database_id`，更新到 `wrangler.toml` 文件中:

```toml
[[d1_databases]]
binding = "DB"
database_name = "accounting-db"
database_id = "你的-database-id-这里"  # 替换这里
```

### 步骤 3: 初始化数据库

```bash
npx wrangler d1 execute accounting-db --file=./schema.sql
```

### 步骤 4: 本地开发

```bash
# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 步骤 5: 部署到 Cloudflare Pages

#### 方式 A: 命令行部署

```bash
# 构建项目
npm run build

# 部署
npm run deploy
```

#### 方式 B: Git 集成（推荐）

1. 将代码推送到 GitHub/GitLab
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Pages → Create a project → Connect to Git
4. 选择你的仓库
5. 配置构建设置:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. 点击 "Save and Deploy"
7. 在 Settings → Functions → D1 database bindings 中添加:
   - **Variable name**: `DB`
   - **D1 database**: `accounting-db`

## 🧪 测试 API

### 创建记录
```bash
curl -X POST http://localhost:8788/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "type": "支出",
    "category": "学习",
    "amount": 100,
    "date": "2024-01-15",
    "remark": "买书"
  }'
```

### 查询记录
```bash
curl "http://localhost:8788/api/records?startMonth=2024-01&endMonth=2024-01"
```

## 📁 项目结构

```
记账小程序/
├── functions/              # Cloudflare Functions (后端 API)
│   └── api/
│       └── records.ts      # 记录 CRUD API
├── src/                    # Vue 3 前端
│   ├── components/         # Vue 组件
│   │   ├── RecordForm.vue  # 添加记录表单
│   │   ├── RecordFilter.vue # 查询过滤器
│   │   └── RecordTable.vue # 数据表格
│   ├── types/              # TypeScript 类型
│   │   └── index.ts
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── schema.sql              # D1 数据库架构
├── wrangler.toml           # Cloudflare 配置
├── vite.config.ts          # Vite 配置
├── uno.config.ts           # UnoCSS 配置
└── package.json            # 项目依赖
```

## 🔧 常见问题

### Q: 本地开发时如何测试 Functions?

A: 使用 Wrangler 的本地开发模式:

```bash
# 终端 1: 启动 Vite 开发服务器
npm run dev

# 终端 2: 启动 Cloudflare Pages 本地开发
npx wrangler pages dev dist --d1 DB=accounting-db --live-reload
```

### Q: 如何查看 D1 数据库内容?

```bash
# 查询所有记录
npx wrangler d1 execute accounting-db --command "SELECT * FROM records"

# 查看表结构
npx wrangler d1 execute accounting-db --command ".schema"
```

### Q: 如何更新数据库架构?

```bash
# 创建迁移 SQL 文件
# 然后执行:
npx wrangler d1 execute accounting-db --file=./migration.sql
```

### Q: 部署后 API 404?

检查:
1. Functions 文件路径是否正确: `functions/api/records.ts`
2. D1 绑定是否配置: Settings → Functions → D1 database bindings
3. 重新部署项目

### Q: 如何迁移现有 MongoDB 数据?

参考 `MIGRATION.md` 文件中的数据迁移章节。

## 📊 性能优化建议

1. **启用缓存**: 在 Functions 中添加 Cache-Control 头
2. **图片优化**: 使用 Cloudflare Images
3. **代码分割**: Vite 自动处理
4. **CDN 加速**: Cloudflare 自动提供

## 🔐 安全建议

1. **环境变量**: 敏感信息使用 Cloudflare Secrets
2. **CORS 配置**: 限制允许的域名
3. **输入验证**: 已在 Functions 中实现
4. **SQL 注入防护**: 使用参数化查询（已实现）

## 📈 监控和日志

在 Cloudflare Dashboard 中查看:
- **Analytics**: Pages → 你的项目 → Analytics
- **Logs**: Workers & Pages → 你的项目 → Logs
- **D1 Metrics**: D1 → accounting-db → Metrics

## 🎯 下一步

- [ ] 添加用户认证
- [ ] 实现数据导出功能
- [ ] 添加图表可视化
- [ ] 支持多币种
- [ ] 移动端优化

## 📚 相关资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Vue 3 文档](https://vuejs.org/)
- [UnoCSS 文档](https://unocss.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)

## 💬 获取帮助

遇到问题? 
- 查看 `MIGRATION.md` 了解架构变化
- 查看 `README.md` 了解详细文档
- 提交 Issue 到项目仓库
