-- D1 Database Schema for Accounting App

-- 家庭成员表
DROP TABLE IF EXISTS members;

CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,              -- 成员姓名（用于匹配支付宝/信用卡账单）
  wechat_nickname TEXT DEFAULT '',        -- 微信昵称（用于匹配微信账单）
  color TEXT DEFAULT '#3b82f6',           -- 标识颜色
  is_active INTEGER DEFAULT 1,            -- 是否启用（1=启用，0=禁用）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成员索引
CREATE INDEX idx_members_is_active ON members(is_active);
CREATE INDEX idx_members_name ON members(name);

-- 记录表
DROP TABLE IF EXISTS records;

CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('支出', '收入')),
  category TEXT NOT NULL CHECK(category IN (
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗', '保险',
    '通讯', '服饰', '还贷',
    '工资', '投资收入', '稿费收入', '其他'
  )),
  amount REAL NOT NULL CHECK(amount >= 0 AND amount <= 999999999),
  date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  member_id INTEGER REFERENCES members(id),  -- 关联家庭成员（NULL表示家庭共同账单）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 记录索引
CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_records_category ON records(category);
CREATE INDEX idx_records_member_id ON records(member_id);
