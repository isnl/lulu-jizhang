// 生成 INSERT SQL 语句
const fs = require('fs');
const path = require('path');

const EXPORT_DIR = './data-export';

function escapeSQL(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return value;
    return `'${String(value).replace(/'/g, "''")}'`;
}

function generateInsertSQL(tableName, data, columns) {
    if (!data || data.length === 0) return '';

    const lines = data.map(row => {
        const values = columns.map(col => escapeSQL(row[col]));
        return `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
    });

    return lines.join('\n');
}

try {
    // 读取导出的 JSON
    const membersRaw = fs.readFileSync(path.join(EXPORT_DIR, 'members.json'), 'utf8');
    const recordsRaw = fs.readFileSync(path.join(EXPORT_DIR, 'records.json'), 'utf8');

    // wrangler d1 execute --json 输出格式: [{ results: [...], success: true }]
    let members = [];
    let records = [];

    try {
        const membersData = JSON.parse(membersRaw);
        members = membersData[0]?.results || [];
    } catch (e) {
        console.log('members.json 解析失败或为空');
    }

    try {
        const recordsData = JSON.parse(recordsRaw);
        records = recordsData[0]?.results || [];
    } catch (e) {
        console.log('records.json 解析失败或为空');
    }

    console.log(`找到 ${members.length} 条 members 记录`);
    console.log(`找到 ${records.length} 条 records 记录`);

    // 生成 members SQL
    const membersSQL = generateInsertSQL('members', members,
        ['id', 'name', 'wechat_nickname', 'color', 'is_active', 'created_at', 'updated_at']);
    fs.writeFileSync(path.join(EXPORT_DIR, 'members.sql'), membersSQL);

    // 生成 records SQL
    const recordsSQL = generateInsertSQL('records', records,
        ['id', 'type', 'category', 'amount', 'date', 'remark', 'member_id', 'created_at', 'updated_at']);
    fs.writeFileSync(path.join(EXPORT_DIR, 'records.sql'), recordsSQL);

    console.log('SQL 文件生成完成');
} catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
}
