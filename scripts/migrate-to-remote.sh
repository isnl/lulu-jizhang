#!/bin/bash

# 本地数据库迁移到远程脚本
# 用法: ./scripts/migrate-to-remote.sh

set -e

DB_NAME="accounting-db"
EXPORT_DIR="./data-export"

echo "=== 开始迁移本地数据到远程 ==="

# 创建导出目录
mkdir -p $EXPORT_DIR

# 1. 导出本地 members 数据
echo "导出 members 表..."
npx wrangler d1 execute $DB_NAME --local --command "SELECT * FROM members" --json > $EXPORT_DIR/members.json 2>/dev/null || echo "[]" > $EXPORT_DIR/members.json

# 2. 导出本地 records 数据
echo "导出 records 表..."
npx wrangler d1 execute $DB_NAME --local --command "SELECT * FROM records" --json > $EXPORT_DIR/records.json 2>/dev/null || echo "[]" > $EXPORT_DIR/records.json

# 3. 生成 SQL 插入语句
echo "生成 SQL 文件..."
node scripts/generate-insert-sql.js

# 4. 导入到远程
echo "导入 members 到远程..."
if [ -s $EXPORT_DIR/members.sql ]; then
    npx wrangler d1 execute $DB_NAME --remote --file=$EXPORT_DIR/members.sql
fi

echo "导入 records 到远程..."
if [ -s $EXPORT_DIR/records.sql ]; then
    npx wrangler d1 execute $DB_NAME --remote --file=$EXPORT_DIR/records.sql
fi

echo "=== 迁移完成 ==="
echo "可以删除临时文件: rm -rf $EXPORT_DIR"
