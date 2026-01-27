-- 用户表（单用户系统）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- 存储密码哈希
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Token 表（用于快捷指令等外部调用）
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                     -- Token 名称（如：iPhone快捷指令）
  token TEXT NOT NULL UNIQUE,             -- Token 值
  last_used_at DATETIME,                  -- 最后使用时间
  is_active INTEGER DEFAULT 1,            -- 是否启用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active ON api_tokens(is_active);
