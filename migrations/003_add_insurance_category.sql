-- 迁移脚本: 添加"保险"分类
-- 创建时间: 2026-02-08
-- 说明: 在支出类别中新增"保险"分类,用于区分保险支出和医疗支出

-- 由于 SQLite 不支持直接修改 CHECK 约束,需要重建表

-- 1. 创建新表结构(包含保险分类)
CREATE TABLE records_new (
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
  member_id INTEGER REFERENCES members(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 复制旧表数据到新表
INSERT INTO records_new (id, type, category, amount, date, remark, member_id, created_at, updated_at)
SELECT id, type, category, amount, date, remark, member_id, created_at, updated_at
FROM records;

-- 3. 删除旧表
DROP TABLE records;

-- 4. 重命名新表
ALTER TABLE records_new RENAME TO records;

-- 5. 重建索引
CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_records_category ON records(category);
CREATE INDEX idx_records_member_id ON records(member_id);

-- 迁移完成
