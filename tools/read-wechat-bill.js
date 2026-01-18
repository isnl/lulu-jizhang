import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 Excel 文件
const filePath = join(__dirname, '..', '微信支付账单流水文件(20250401-20250701)——【解压密码可在微信支付公众号查看】.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 转换为 JSON
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('=== 微信账单文件分析 ===\n');
    console.log('工作表名称:', sheetName);
    console.log('总行数:', data.length);

    if (data.length > 0) {
        console.log('\n列名:');
        console.log(Object.keys(data[0]));

        console.log('\n前 5 行数据:');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));

        console.log('\n数据示例（第一行）:');
        console.log(data[0]);
    }
} catch (error) {
    console.error('读取文件失败:', error.message);
}
