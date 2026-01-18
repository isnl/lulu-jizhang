# 🚀 本地开发指南（简化版）

## 快速开始 - 分离式开发（推荐）

### 启动方式

**终端 1 - 前端开发服务器（Vite HMR）**:
```bash
npm run dev
```
访问: http://localhost:5173

**终端 2 - 后端 API 服务器（Wrangler Dev）**:
```bash
npm run dev:api
```
API 地址: http://localhost:8787

### 工作原理

- **前端**: Vite 开发服务器，支持热模块替换（HMR），修改代码立即生效
- **后端**: Wrangler Dev 运行 Functions，连接本地 D1 数据库
- **环境变量**: `.env.development` 配置前端请求指向 `http://localhost:8787/api`

### 优势

✅ **前端热更新** - 修改 Vue 组件立即看到效果  
✅ **后端独立运行** - Functions 在独立进程，便于调试  
✅ **真实环境** - 使用真实的 D1 数据库  
✅ **开发体验好** - 两个终端分别查看日志  

---

## 环境配置说明

### 开发环境 (`.env.development`)
```env
VITE_API_BASE_URL=http://localhost:8787/api
```

### 生产环境 (`.env.production`)
```env
VITE_API_BASE_URL=/api
```

前端会根据环境自动选择正确的 API 地址。

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务器 (localhost:5173) |
| `npm run dev:api` | 启动后端 API 服务器 (localhost:8787) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run deploy` | 部署到 Cloudflare Pages |

---

## 测试 API

### 浏览器测试
直接在应用中操作即可，前端会自动请求 `http://localhost:8787/api`

### curl 测试

**创建记录**:
```bash
curl -X POST http://localhost:8787/api/records \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"支出\",\"category\":\"学习\",\"amount\":100,\"date\":\"2024-01-16\",\"remark\":\"测试\"}"
```

**查询记录**:
```bash
curl "http://localhost:8787/api/records?startMonth=2024-01&endMonth=2024-01"
```

---

## D1 数据库操作

### 查看数据
```bash
npx wrangler d1 execute accounting-db --local --command "SELECT * FROM records"
```

### 清空数据
```bash
npx wrangler d1 execute accounting-db --local --command "DELETE FROM records"
```

### 重新初始化
```bash
npx wrangler d1 execute accounting-db --local --file=./schema.sql
```

---

## 常见问题

### Q: API 请求失败？
确保后端 API 服务器正在运行：
```bash
npm run dev:api
```

### Q: 修改代码不生效？
- **前端代码**: Vite 会自动热更新
- **后端代码**: 需要重启 `npm run dev:api`

### Q: 端口被占用？
修改 `.env.development` 中的端口：
```env
VITE_API_BASE_URL=http://localhost:9999/api
```
然后启动 API 时指定端口：
```bash
npx wrangler dev functions/api/records.ts --port 9999 --d1 DB=accounting-db
```

---

## 部署流程

```bash
# 1. 构建项目
npm run build

# 2. 部署到 Cloudflare Pages
npm run deploy
```

或者通过 Git 集成自动部署（推荐）。

---

## 项目结构

```
├── functions/api/records.ts    # Cloudflare Functions API
├── src/
│   ├── components/             # Vue 组件
│   ├── config/api.ts           # API 配置（环境变量）
│   ├── types/                  # TypeScript 类型
│   └── App.vue                 # 主应用
├── .env.development            # 开发环境变量
├── .env.production             # 生产环境变量
└── wrangler.toml               # Cloudflare 配置
```
