import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const filePath = join(__dirname, '..', 'alipay_record_20260116_1744_1.csv')

const workbook = XLSX.readFile(filePath, {
    type: 'file',
    codepage: 936
})
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

console.log('总行数:', rows.length)
console.log('\n从第6行开始的所有数据行分析:\n')

let validCount = 0
let skippedCount = 0
const skipReasons = {}

for (let i = 5; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) {
        console.log(`第${i + 1}行: [空行]`)
        skippedCount++
        skipReasons['空行'] = (skipReasons['空行'] || 0) + 1
        continue
    }

    if (row.length < 11) {
        console.log(`第${i + 1}行: [列数不足: ${row.length}]`)
        skippedCount++
        skipReasons['列数不足'] = (skipReasons['列数不足'] || 0) + 1
        continue
    }

    const status = String(row[11] || '').trim()
    const direction = String(row[10] || '').trim()
    const amount = String(row[9] || '').trim()
    const counterparty = String(row[7] || '').trim()

    let skipReason = null

    if (status !== '交易成功') {
        skipReason = `状态不是"交易成功": [${status}]`
    } else if (direction !== '支出' && direction !== '收入') {
        skipReason = `收/支类型: [${direction}]`
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) === 0) {
        skipReason = `金额无效: [${amount}]`
    } else {
        validCount++
        console.log(`第${i + 1}行: ✓ 有效 - ${direction} ¥${amount} - ${counterparty}`)
        continue
    }

    skippedCount++
    skipReasons[skipReason] = (skipReasons[skipReason] || 0) + 1
    console.log(`第${i + 1}行: ✗ 跳过 - ${skipReason}`)
}

console.log('\n=== 统计结果 ===')
console.log(`有效记录: ${validCount} 条`)
console.log(`跳过记录: ${skippedCount} 条`)
console.log('\n跳过原因分布:')
Object.entries(skipReasons).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count} 条`)
})
