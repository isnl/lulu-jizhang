import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 智能分类映射函数
const smartCategoryMapping = (type, counterparty, product) => {
    let category = type === '支出' ? '日用品' : '其他'

    if (type === '支出') {
        const categoryRules = [
            { keywords: ['素心微暖', '美妆', '护肤', '化妆品'], category: '美妆护肤' },
            { keywords: ['唯品会', '快乐的鞋子', '衣服', '服饰', '鞋'], category: '服饰' },
            { keywords: ['得到', '知识', '课程', '培训', '书店'], category: '学习' },
            { keywords: ['电影', '游戏', 'KTV', '酒吧'], category: '娱乐' },
            { keywords: ['喜乐', '崔小七', '饰品', '首饰', '珠宝'], category: '饰品' },
            { keywords: ['停车', '打车', '滴滴', '公交', '地铁', '加油', '出行', '中国铁路', '12306'], category: '交通' },
            { keywords: ['医院', '药店', '诊所', '体检', '挂号'], category: '医疗' },
            { keywords: ['美团', '饿了么', '外卖', '餐饮', '饭店', '食堂', '盒马', '麻辣', '拼多多平台商户'], category: '饮食' },
            { keywords: ['京东', '快团团', '超市', '便利店', '淘宝', '拼多多'], category: '日用品' },
            { keywords: ['话费', '流量', '宽带', '移动', '联通', '电信'], category: '通讯' },
            { keywords: ['宠物', '猫粮', '狗粮', '宠物医院'], category: '宠物' },
        ]

        for (const rule of categoryRules) {
            if (rule.keywords.some(keyword => counterparty.includes(keyword) || product.includes(keyword))) {
                category = rule.category
                break
            }
        }
    } else {
        const incomeRules = [
            { keywords: ['工资', '薪资', '薪酬', '公司'], category: '工资' },
            { keywords: ['投资', '理财', '股票', '基金', '分红'], category: '投资收入' },
            { keywords: ['稿费', '写作', '文章', '版税'], category: '稿费收入' },
            { keywords: ['红包', '现金奖励'], category: '其他' },
        ]

        for (const rule of incomeRules) {
            if (rule.keywords.some(keyword => counterparty.includes(keyword) || product.includes(keyword))) {
                category = rule.category
                break
            }
        }
    }

    return category
}

// 解析支付宝账单
const parseAlipayBill = (rows) => {
    if (rows.length < 6) {
        throw new Error('支付宝账单文件格式不正确')
    }

    // 第5行（索引4）是表头
    const headerRow = rows[4]
    if (!headerRow || String(headerRow[0]).trim() !== '交易号') {
        throw new Error('无法识别支付宝账单格式，未找到正确的表头')
    }

    const records = []

    // 从第6行（索引5）开始是数据
    for (let i = 5; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length < 11) continue

        const paymentTimeRaw = row[3] // 付款时间（保留原始类型）
        const counterparty = String(row[7] || '').trim() // 交易对方
        const product = String(row[8] || '').trim() // 商品名称
        const amountStr = String(row[9] || '').trim() // 金额（元）
        const direction = String(row[10] || '').trim() // 收/支
        const status = String(row[11] || '').trim() // 交易状态
        const remark = String(row[14] || '').trim() // 备注

        // Filter valid transaction status
        if (status !== '交易成功') continue

        // Determine Type
        let type
        if (direction === '支出') type = '支出'
        else if (direction === '收入') type = '收入'
        else continue // Skip "不计收支" or other types

        // Parse Amount
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount === 0) continue

        // Parse Date
        // XLSX可能将日期转换为Excel序列号，需要特殊处理
        let dateObj
        if (typeof paymentTimeRaw === 'number') {
            // Excel日期序列号转换为JavaScript Date
            // Excel起始日期是1900-01-01，但实际是1899-12-30（Excel的bug）
            dateObj = new Date((paymentTimeRaw - 25569) * 86400 * 1000)
        } else {
            dateObj = new Date(paymentTimeRaw)
        }

        if (isNaN(dateObj.getTime())) continue
        const formattedDate = dateObj.toISOString().split('T')[0]

        // Smart Category Mapping
        const category = smartCategoryMapping(type, counterparty, product)

        // Construct Remark
        const finalRemark = remark || `${counterparty} - ${product}`.substring(0, 50)

        records.push({
            type,
            category,
            amount,
            date: formattedDate,
            remark: finalRemark
        })
    }

    return records
}

// 读取支付宝账单CSV文件
const filePath = join(__dirname, '..', 'alipay_record_20260116_1744_1.csv')

try {
    // 使用codepage选项读取GBK编码的CSV文件
    // XLSX默认使用UTF-8，需要指定codepage为936（GBK）
    const workbook = XLSX.readFile(filePath, {
        type: 'file',
        codepage: 936  // GBK编码
    })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

    console.log('=== 支付宝账单解析测试 ===\n')
    console.log('总行数:', rows.length)

    const records = parseAlipayBill(rows)

    console.log('\n成功解析记录数:', records.length)
    console.log('\n前 10 条记录:')
    console.log(JSON.stringify(records.slice(0, 10), null, 2))

    // 统计分类分布
    const categoryStats = {}
    const typeStats = { '支出': 0, '收入': 0 }
    let totalExpense = 0
    let totalIncome = 0

    records.forEach(record => {
        categoryStats[record.category] = (categoryStats[record.category] || 0) + 1
        typeStats[record.type]++
        if (record.type === '支出') {
            totalExpense += record.amount
        } else {
            totalIncome += record.amount
        }
    })

    console.log('\n=== 统计信息 ===')
    console.log('收入记录数:', typeStats['收入'], '总金额:', totalIncome.toFixed(2), '元')
    console.log('支出记录数:', typeStats['支出'], '总金额:', totalExpense.toFixed(2), '元')
    console.log('\n分类分布:')
    Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} 条`)
    })

} catch (error) {
    console.error('解析失败:', error.message)
    console.error(error.stack)
}
