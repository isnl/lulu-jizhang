-- 添加记录来源字段
-- 老数据默认空字符串，后续导入/手动记账会写入来源

ALTER TABLE records ADD COLUMN source TEXT DEFAULT '';
