-- D1 Database Schema for Accounting App

DROP TABLE IF EXISTS records;

CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('支出', '收入')),
  category TEXT NOT NULL CHECK(category IN (
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习', 
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗', 
    '通讯', '服饰', '还贷',
    '工资', '投资收入', '稿费收入', '其他'
  )),
  amount REAL NOT NULL CHECK(amount >= 0 AND amount <= 999999999),
  date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster date queries
CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_records_category ON records(category);
