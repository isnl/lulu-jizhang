-- 添加家庭成员表（如果不存在）
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  wechat_nickname TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成员索引（忽略已存在的错误）
CREATE INDEX IF NOT EXISTS idx_members_is_active ON members(is_active);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);

-- 为 records 表添加 member_id 列（如果不存在）
-- 注意：SQLite 不支持 IF NOT EXISTS 语法添加列，需要手动检查
-- 如果列已存在会报错，可以忽略
ALTER TABLE records ADD COLUMN member_id INTEGER REFERENCES members(id);

-- 为 member_id 添加索引
CREATE INDEX IF NOT EXISTS idx_records_member_id ON records(member_id);
