# 本地数据库迁移到远程脚本 (PowerShell)
# 用法: .\scripts\migrate-to-remote.ps1

$ErrorActionPreference = "Stop"

$DB_NAME = "accounting-db"
$EXPORT_DIR = "./data-export"

Write-Host "=== 开始迁移本地数据到远程 ===" -ForegroundColor Green

# 创建导出目录
New-Item -ItemType Directory -Force -Path $EXPORT_DIR | Out-Null

# 1. 导出本地 members 数据
Write-Host "导出 members 表..."
npx wrangler d1 execute $DB_NAME --local --command "SELECT * FROM members" --json > "$EXPORT_DIR/members.json" 2>$null
if (-not $?) { "[]" | Out-File "$EXPORT_DIR/members.json" }

# 2. 导出本地 records 数据
Write-Host "导出 records 表..."
npx wrangler d1 execute $DB_NAME --local --command "SELECT * FROM records" --json > "$EXPORT_DIR/records.json" 2>$null
if (-not $?) { "[]" | Out-File "$EXPORT_DIR/records.json" }

# 3. 生成 SQL 插入语句
Write-Host "生成 SQL 文件..."
node scripts/generate-insert-sql.js

# 4. 导入到远程
if (Test-Path "$EXPORT_DIR/members.sql") {
    $content = Get-Content "$EXPORT_DIR/members.sql" -Raw
    if ($content.Trim().Length -gt 0) {
        Write-Host "导入 members 到远程..."
        npx wrangler d1 execute $DB_NAME --remote --file="$EXPORT_DIR/members.sql"
    }
}

if (Test-Path "$EXPORT_DIR/records.sql") {
    $content = Get-Content "$EXPORT_DIR/records.sql" -Raw
    if ($content.Trim().Length -gt 0) {
        Write-Host "导入 records 到远程..."
        npx wrangler d1 execute $DB_NAME --remote --file="$EXPORT_DIR/records.sql"
    }
}

Write-Host "=== 迁移完成 ===" -ForegroundColor Green
Write-Host "可以删除临时文件: Remove-Item -Recurse $EXPORT_DIR"
