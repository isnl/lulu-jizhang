-- Add "保健" and "工作待报销" expense categories.
-- SQLite/D1 cannot alter an existing CHECK constraint in place, so the table is rebuilt.

CREATE TABLE records_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('支出', '收入')),
  category TEXT NOT NULL CHECK(category IN (
    '生活费', '交通', '饮食', '日用品', '娱乐', '学习',
    '电子产品', '人情', '宠物', '饰品', '美妆护肤', '医疗', '保险',
    '保健', '通讯', '服饰', '还贷', '家电/家具', '工作待报销',
    '工资', '投资收入', '稿费收入', '其他'
  )),
  amount REAL NOT NULL CHECK(amount >= 0 AND amount <= 999999999),
  date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  source TEXT DEFAULT '',
  counterparty TEXT DEFAULT '',
  product TEXT DEFAULT '',
  pay_method TEXT DEFAULT '',
  source_transaction_id TEXT DEFAULT '',
  dedupe_key TEXT DEFAULT '',
  member_id INTEGER REFERENCES members(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO records_new (
  id, type, category, amount, date, remark, source,
  counterparty, product, pay_method, source_transaction_id, dedupe_key,
  member_id, created_at, updated_at
)
SELECT
  id, type, category, amount, date, remark, source,
  counterparty, product, pay_method, source_transaction_id, dedupe_key,
  member_id, created_at, updated_at
FROM records;

DROP TABLE records;
ALTER TABLE records_new RENAME TO records;

CREATE INDEX idx_records_date ON records(date);
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_records_category ON records(category);
CREATE INDEX idx_records_member_id ON records(member_id);
CREATE INDEX IF NOT EXISTS idx_records_dedupe_key ON records(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_records_source_transaction_id ON records(source, source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_records_amount_date_type ON records(type, amount, date);
