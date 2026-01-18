// 直接分析微信支付账单数据
const data = require('fs').readFileSync('f:\\AI记账软件\\记账小程序\\wechat_bill_data.json', 'utf8');
const billData = JSON.parse(data);

// 构建行数据
const rows = {};
billData.cells.forEach(cell => {
    if (!rows[cell.row]) {
        rows[cell.row] = {};
    }
    rows[cell.row][cell.column] = cell.value;
});

// 找出所有支出记录
const expenses = [];

// 从第6行开始是数据(前5行是标题)
for (let rowNum = 6; rowNum <= 89; rowNum++) {
    const row = rows[rowNum];
    if (!row) continue;

    const paymentStatus = row[5]; // E列:收/支
    const amountStr = row[6]; // F列:金额(元)

    // 只统计支出
    if (paymentStatus === '支出' && amountStr) {
        // 解析金额,去掉 ¥ 符号
        const amount = parseFloat(amountStr.replace('¥', '').replace(',', ''));

        if (!isNaN(amount) && amount > 0) {
            expenses.push({
                date: row[1], // A列:交易时间
                type: row[2], // B列:交易类型
                merchant: row[3], // C列:商户
                product: row[4], // D列:商品
                amount: amount,
                paymentMethod: row[7], // G列:支付方式
                status: row[8], // H列:当前状态
                transactionId: row[9], // I列:交易单号
                merchantOrderId: row[10], // J列:商户单号
                remark: row[11] // K列:备注
            });
        }
    }
}

// 找出最高消费
if (expenses.length === 0) {
    console.log('没有找到支出记录');
    process.exit(0);
}

const maxExpense = expenses.reduce((max, current) =>
    current.amount > max.amount ? current : max
);

console.log('\n=== 微信支付账单分析结果 ===\n');
console.log(`总支出记录数: ${expenses.length} 笔`);
console.log(`总支出金额: ¥${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}`);
console.log(`\n🔥 消费最高的一笔:\n`);
console.log(`📅 交易时间: ${maxExpense.date}`);
console.log(`🏷️  交易类型: ${maxExpense.type}`);
console.log(`🏪 商户名称: ${maxExpense.merchant}`);
console.log(`📦 商品说明: ${maxExpense.product}`);
console.log(`💰 金额: ¥${maxExpense.amount.toFixed(2)}`);
console.log(`💳 支付方式: ${maxExpense.paymentMethod}`);
console.log(`✅ 交易状态: ${maxExpense.status}`);
console.log(`🔢 交易单号: ${maxExpense.transactionId}`);
if (maxExpense.remark && maxExpense.remark !== '/') {
    console.log(`📝 备注: ${maxExpense.remark}`);
}

// 显示前5笔最高消费
console.log('\n\n📊 前5笔最高消费:\n');
const top5 = expenses.sort((a, b) => b.amount - a.amount).slice(0, 5);
top5.forEach((expense, index) => {
    console.log(`${index + 1}. ¥${expense.amount.toFixed(2).padStart(10)} - ${expense.merchant} - ${expense.product}`);
    console.log(`   ${expense.date}\n`);
});
