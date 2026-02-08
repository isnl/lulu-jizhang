<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Upload, FileText, CreditCard, Smartphone, Loader2, Users, ShoppingBag, Building2, AlertCircle } from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { convertGBKtoUTF8 } from '../utils/gbk-converter'
import { authFetch } from '../utils/auth'
import type { RecordData, Member } from '../types'
import Modal from './ui/Modal.vue'
import CustomSelect from './ui/CustomSelect.vue'

const props = defineProps<{
  onImportSuccess?: () => void
  members?: Member[]  // 从父组件传入成员列表
}>()

const emit = defineEmits<{
  (e: 'error', msg: string): void
  (e: 'success', msg: string): void
  (e: 'records-added'): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const previewRecords = ref<RecordData[]>([])
const showPreview = ref(false)
const billType = ref<'wechat' | 'alipay' | 'credit' | 'jd' | 'bank'>('wechat') // 账单类型

// 成员选择相关
const selectedMemberId = ref<number | null>(null)
const detectedMemberName = ref<string>('')  // 从账单中检测到的姓名/昵称
const suggestedMemberId = ref<number | null>(null)  // 智能推荐的成员ID
const showMemberConfirm = ref(false)  // 成员确认对话框
const lastSelectedMemberId = ref<number | null>(null)  // 上次选择的成员ID

// 分类后的数据
const validRecords = ref<RecordData[]>([]) // 需导入的数据
const duplicateRecords = ref<RecordData[]>([]) // 重复数据

// 导入分类常量
import { CATEGORIES } from '../types'

// 活跃成员列表
const activeMembers = computed(() => {
  return props.members?.filter(m => m.isActive) || []
})

// 根据检测到的姓名/昵称智能匹配成员
const matchMember = (name: string, isWechat: boolean = false): number | null => {
  if (!name || activeMembers.value.length === 0) return null

  const normalizedName = name.trim().toLowerCase()

  for (const member of activeMembers.value) {
    if (isWechat) {
      // 微信账单：匹配微信昵称
      if (member.wechatNickname && member.wechatNickname.trim().toLowerCase() === normalizedName) {
        return member.id || null
      }
    } else {
      // 支付宝/信用卡账单：匹配姓名
      if (member.name.trim().toLowerCase() === normalizedName) {
        return member.id || null
      }
    }
  }
  return null
}

// 组件挂载时读取上次选择的成员
onMounted(() => {
  const saved = localStorage.getItem('lastSelectedMemberId')
  if (saved && saved !== 'null') {
    lastSelectedMemberId.value = parseInt(saved)
  }
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

// 判断是否为重复数据（支付宝/微信）
const isDuplicateRecord = (record: RecordData): boolean => {
  const remark = record.remark || ''
  return remark.includes('支付宝-') || remark.includes('财付通-')
}

// 从微信账单中提取昵称
const extractWechatNickname = (rows: any[][]): string => {
  // 微信账单前几行通常包含用户信息
  // 格式可能是: "微信昵称,xxx" 或类似格式
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (row && row.length >= 2) {
      const firstCell = String(row[0] || '').trim()
      if (firstCell === '微信昵称' || firstCell.includes('昵称')) {
        return String(row[1] || '').trim()
      }
    }
  }
  return ''
}

// 分类数据
const classifyRecords = (records: RecordData[]) => {
  validRecords.value = []
  duplicateRecords.value = []

  for (const record of records) {
    if (isDuplicateRecord(record)) {
      duplicateRecords.value.push(record)
    } else {
      validRecords.value.push(record)
    }
  }
}

// 解析微信账单
const parseWechatBill = (rows: any[][]): RecordData[] => {
  // Find header row (starts with "交易时间")
  const headerRowIndex = rows.findIndex(row => row[0] === '交易时间')
  if (headerRowIndex === -1) {
    throw new Error('无法识别微信账单格式,未找到"交易时间"列')
  }

  const records: RecordData[] = []
  
  // Iterate over data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 6) continue // Skip empty rows

      const dateStr = row[0]
      const transactionType = row[1] // 交易类型
      const counterparty = row[2] // 交易对方
      const product = row[3] // 商品
      const direction = row[4] // 收/支
      const amountStr = row[5] // 金额
      const status = row[7] // 当前状态

      // Filter valid transaction status
      if (status !== '支付成功' && status !== '已到账' && status !== '对方已收钱' && status !== '朋友已收钱' && status !== '已存入零钱' && status !== '已转账') continue

      // Determine Type
      let type: '支出' | '收入'
      if (direction === '支出') type = '支出'
      else if (direction === '收入') type = '收入'
      else continue // Skip neutral or other types

      // Parse Amount (remove ¥ and commas)
      const amount = parseFloat(amountStr.replace(/[¥,]/g, ''))
      if (isNaN(amount)) continue

      // Parse Date
      const dateObj = new Date(dateStr)
      if (isNaN(dateObj.getTime())) continue
      const formattedDate = dateObj.toISOString().split('T')[0]

      // Construct Remark - 包含交易类型信息
      const remark = `${counterparty} - ${product}`.substring(0, 50) // Limit length

      // Smart Category Mapping - 传入交易类型、备注用于判断
      const category = smartCategoryMapping(type, counterparty, product, remark, transactionType)

      records.push({
          type,
          category,
          amount,
          date: formattedDate,
          remark
      })
  }

  return records
}

// 解析支付宝账单
const parseAlipayBill = (rows: any[][]): { records: RecordData[], accountName: string } => {
  // 支付宝CSV格式:前4行是元数据,第5行是表头
  // 第一行通常包含账户信息，如"姓名,xxx"
  // 表头:交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额(元),收/支,交易状态,服务费(元),成功退款(元),备注,资金状态

  if (rows.length < 6) {
    throw new Error('支付宝账单文件格式不正确')
  }

  // 尝试从元数据中提取账户姓名（通常在前几行）
  let accountName = ''
  for (let i = 0; i < 4; i++) {
    const row = rows[i]
    if (row && row.length >= 2) {
      const firstCell = String(row[0] || '').trim()
      if (firstCell === '姓名' || firstCell.includes('姓名')) {
        accountName = String(row[1] || '').trim()
        break
      }
    }
  }

  // 第5行(索引4)是表头
  const headerRow = rows[4]
  if (!headerRow || String(headerRow[0]).trim() !== '交易号') {
    throw new Error('无法识别支付宝账单格式,未找到正确的表头')
  }

  const records: RecordData[] = []
  
  // 从第6行(索引5)开始是数据
  for (let i = 5; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 11) continue // Skip empty rows

      const paymentTimeRaw = row[3] // 付款时间(保留原始类型)
      const counterparty = String(row[7] || '').trim() // 交易对方
      const product = String(row[8] || '').trim() // 商品名称
      const amountStr = String(row[9] || '').trim() // 金额(元)
      const direction = String(row[10] || '').trim() // 收/支
      const status = String(row[11] || '').trim() // 交易状态
      const remark = String(row[14] || '').trim() // 备注

      // Filter valid transaction status
      if (status !== '交易成功') continue

      // Determine Type
      let type: '支出' | '收入'
      if (direction === '支出') type = '支出'
      else if (direction === '收入') type = '收入'
      else continue // Skip "不计收支" or other types

      // Parse Amount
      const amount = parseFloat(amountStr)
      if (isNaN(amount) || amount === 0) continue

      // Parse Date
      // XLSX可能将日期转换为Excel序列号,需要特殊处理
      let dateObj: Date
      if (typeof paymentTimeRaw === 'number') {
        // Excel日期序列号转换为JavaScript Date
        // Excel起始日期是1900-01-01,但实际是1899-12-30(Excel的bug)
        dateObj = new Date((paymentTimeRaw - 25569) * 86400 * 1000)
      } else {
        dateObj = new Date(paymentTimeRaw)
      }

      if (isNaN(dateObj.getTime())) continue
      const formattedDate = dateObj.toISOString().split('T')[0]

      // Construct Remark
      const finalRemark = remark || `${counterparty} - ${product}`.substring(0, 50)

      // Smart Category Mapping - 传入备注用于判断
      const category = smartCategoryMapping(type, counterparty, product, finalRemark)

      records.push({
          type,
          category,
          amount,
          date: formattedDate,
          remark: finalRemark
      })
  }

  return { records, accountName }
}

// 智能分类映射(微信和支付宝共用)
const smartCategoryMapping = (type: '支出' | '收入', counterparty: string, product: string, remark: string = '', transactionType: string = ''): string => {
  let category = type === '支出' ? '日用品' : '其他' // Default

  // 优先判断人情类交易(转账、红包等) - 不区分收支
  const relationshipKeywords = ['转账', '红包', '发红包', '微信红包', '赞赏码', '收款码', '赞赏']
  if (relationshipKeywords.some(keyword => 
    transactionType.includes(keyword) || 
    counterparty.includes(keyword) || 
    product.includes(keyword) || 
    remark.includes(keyword)
  )) {
    return type === '支出' ? '人情' : '其他'
  }

  if (type === '支出') {
    // 支出分类映射规则(优先级从高到低)
    const categoryRules = [
      // 生活费 - 根据备注判断
      { keywords: ['生活费'], category: '生活费' },

      // 宠物 - 根据备注判断
      { keywords: ['驱虫', '猫粮', '狗粮', '宠物医院', '宠物'], category: '宠物' },

      // 美妆护肤
      { keywords: ['素心微暖', '美妆', '护肤', '化妆品'], category: '美妆护肤' },

      // 服饰
      { keywords: ['唯品会', '快乐的鞋子', '衣服', '服饰', '鞋'], category: '服饰' },

      // 学习
      { keywords: ['得到', '知识', '课程', '培训', '书店'], category: '学习' },

      // 娱乐
      { keywords: ['电影', '游戏', 'KTV', '酒吧'], category: '娱乐' },

      // 饰品
      { keywords: ['喜乐', '崔小七', '饰品', '首饰', '珠宝'], category: '饰品' },

      // 人情 - 转账、红包等
      { keywords: ['转账', '红包', '发红包', '微信红包', '赞赏码', '收款码'], category: '人情' },

      // 交通
      { keywords: ['停车', '打车', '滴滴', '公交', '地铁', '加油', '出行', '中国铁路', '12306'], category: '交通' },

      // 保险 - 优先级高于医疗
      { keywords: ['保险', '平安', '太平洋保险', '人寿', '车险', '意外险', '重疾险', '医疗险', '寿险'], category: '保险' },

      // 医疗
      { keywords: ['医院', '药店', '诊所', '体检', '挂号'], category: '医疗' },

      // 饮食
      { keywords: ['美团', '饿了么', '外卖', '餐饮', '饭店', '食堂', '盒马', '麻辣', '拼多多平台商户'], category: '饮食' },

      // 日用品
      { keywords: ['京东', '快团团', '超市', '便利店', '淘宝', '拼多多'], category: '日用品' },

      // 通讯
      { keywords: ['话费', '流量', '宽带', '移动', '联通', '电信'], category: '通讯' },
    ]

    // 匹配规则 - 优先匹配备注，其次匹配交易对方和商品
    for (const rule of categoryRules) {
      if (rule.keywords.some(keyword => remark.includes(keyword) || counterparty.includes(keyword) || product.includes(keyword))) {
        category = rule.category
        break
      }
    }
  } else {
    // 收入分类映射规则
    const incomeRules = [
      { keywords: ['工资', '薪资', '薪酬', '公司'], category: '工资' },
      { keywords: ['投资', '理财', '股票', '基金', '分红'], category: '投资收入' },
      { keywords: ['稿费', '写作', '文章', '版税'], category: '稿费收入' },
      { keywords: ['红包', '现金奖励'], category: '其他' },
    ]

    for (const rule of incomeRules) {
      if (rule.keywords.some(keyword => remark.includes(keyword) || counterparty.includes(keyword) || product.includes(keyword))) {
        category = rule.category
        break
      }
    }
  }

  return category
}

// 京东分类映射
const mapJDCategory = (type: '支出' | '收入', jdCategory: string, merchant: string, description: string): string => {
  if (type === '支出') {
    // 京东分类 -> 系统分类映射
    const categoryMapping: Record<string, string> = {
      '数码电器': '电子产品',
      '食品酒饮': '饮食',
      '服饰内衣': '服饰',
      '美妆个护': '美妆护肤',
      '宠物生活': '宠物',
      '医疗保健': '医疗',
      '手机通讯': '电子产品',
      '电脑办公': '电子产品',
      '运动户外': '娱乐',
      '汽车用品': '交通',
      '清洁纸品': '日用品',
      '日用百货': '日用品',
      '生活服务': '日用品',
      '休闲娱乐': '娱乐',
      '鞋服箱包': '服饰',
    }

    // 优先使用京东分类
    if (jdCategory && categoryMapping[jdCategory]) {
      return categoryMapping[jdCategory]
    }

    // 如果是"其他网购"或"网购"，尝试从商户/商品描述智能匹配
    return smartCategoryMapping(type, merchant, description, '')
  } else {
    // 收入分类
    if (merchant.includes('佣金') || description.includes('佣金')) {
      return '其他'
    }
    return '其他'
  }
}

// 解析京东金额（处理退款情况）
const parseJDAmount = (amountStr: string): number => {
  // 格式示例:
  // "28.61" -> 28.61
  // "17.72(已全额退款)" -> 0 (跳过)
  // "28.37(已退款2.40)" -> 28.37 - 2.40 = 25.97

  if (amountStr.includes('已全额退款')) {
    return 0 // 全额退款的记录金额为0，会被过滤
  }

  const match = amountStr.match(/^([\d.]+)(?:\(已退款([\d.]+)\))?/)
  if (!match) {
    // 尝试提取第一个数字
    const simpleMatch = amountStr.match(/([\d.]+)/)
    return simpleMatch ? parseFloat(simpleMatch[1]) : NaN
  }

  const baseAmount = parseFloat(match[1])
  const refundAmount = match[2] ? parseFloat(match[2]) : 0

  return baseAmount - refundAmount
}

// 解析京东交易流水
const parseJDWalletBill = (rows: any[][]): RecordData[] => {
  // 表头: 交易时间,商户名称,交易说明,金额,收/付款方式,交易状态,收/支,交易分类,交易订单号,商家订单号,备注
  // 去掉BOM字符并查找表头
  const headerRowIndex = rows.findIndex(row => {
    const firstCell = String(row[0] || '').replace(/^\uFEFF/, '').trim()
    return firstCell.includes('交易时间')
  })

  if (headerRowIndex === -1) {
    throw new Error('无法识别京东账单格式，未找到"交易时间"列')
  }

  const records: RecordData[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 7) continue

    // 清理制表符和空白
    const dateStr = String(row[0] || '').replace(/\t/g, '').trim()
    const merchant = String(row[1] || '').trim()        // 商户名称
    const description = String(row[2] || '').replace(/\t/g, '').trim() // 交易说明
    const amountStr = String(row[3] || '').trim()       // 金额
    const direction = String(row[6] || '').trim()       // 收/支
    const jdCategory = String(row[7] || '').trim()      // 交易分类

    // 只处理"收入"和"支出"，跳过"不计收支"
    if (direction !== '支出' && direction !== '收入') continue

    // 解析金额（处理退款情况）
    const amount = parseJDAmount(amountStr)
    if (isNaN(amount) || amount <= 0) continue

    // 解析日期
    const dateObj = new Date(dateStr)
    if (isNaN(dateObj.getTime())) continue
    const formattedDate = dateObj.toISOString().split('T')[0]

    // 构建备注
    const remark = `${merchant} - ${description}`.substring(0, 50)

    // 映射分类
    const category = mapJDCategory(direction as '支出' | '收入', jdCategory, merchant, description)

    records.push({
      type: direction as '支出' | '收入',
      category,
      amount,
      date: formattedDate,
      remark
    })
  }

  return records
}

// 银行流水分类映射
const mapBankCategory = (type: '支出' | '收入', summary: string, counterName: string): string => {
  if (type === '支出') {
    // 保险类 - 优先判断
    if (counterName.includes('保险')) {
      return '保险'
    }

    // 网购类
    if (summary.includes('拼多多') || summary.includes('抖音') ||
        summary.includes('京东') || summary.includes('淘宝') ||
        summary.includes('天猫') || summary.includes('唯品会')) {
      return '日用品'
    }

    // 通讯类
    if (counterName.includes('移动') || counterName.includes('联通') ||
        counterName.includes('电信') || summary.includes('话费')) {
      return '通讯'
    }

    // 交通类
    if (counterName.includes('加油') || counterName.includes('石油') ||
        counterName.includes('石化') || summary.includes('ETC')) {
      return '交通'
    }

    // 水电燃气
    if (counterName.includes('电力') || counterName.includes('燃气') ||
        counterName.includes('水务') || counterName.includes('供暖')) {
      return '生活费'
    }

    return '日用品' // 默认
  } else {
    // 收入分类
    if (summary.includes('工资') || summary.includes('薪') ||
        counterName.includes('人力') || counterName.includes('薪酬')) {
      return '工资'
    }

    // 政府补贴/退税
    if (counterName.includes('预算') || counterName.includes('财政') ||
        counterName.includes('税务') || summary.includes('退税')) {
      return '其他'
    }

    // 投资收益
    if (counterName.includes('基金') || counterName.includes('证券') ||
        counterName.includes('理财') || summary.includes('利息')) {
      return '投资收入'
    }

    return '其他'
  }
}

// 解析银行流水（中信银行格式）
const parseBankBill = (rows: any[][]): RecordData[] => {
  // 表头: 交易日期,收入金额,支出金额,交易摘要,对方账号,对方户名
  // 去掉BOM字符并查找表头
  const headerRowIndex = rows.findIndex(row => {
    const firstCell = String(row[0] || '').replace(/^\uFEFF/, '').trim()
    return firstCell.includes('交易日期')
  })

  if (headerRowIndex === -1) {
    throw new Error('无法识别银行账单格式，未找到"交易日期"列')
  }

  const records: RecordData[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 4) continue

    const dateStr = String(row[0] || '').trim()           // 交易日期 20250112
    const incomeStr = String(row[1] || '').trim()         // 收入金额
    const expenseStr = String(row[2] || '').trim()        // 支出金额
    const summary = String(row[3] || '').trim()           // 交易摘要
    const counterName = String(row[5] || '').trim()       // 对方户名

    // 解析金额
    const income = parseFloat(incomeStr) || 0
    const expense = parseFloat(expenseStr) || 0

    if (income === 0 && expense === 0) continue

    // 可选：过滤转账记录（自己账户之间的资金转移）
    if (summary.includes('转账') || summary.includes('转出') ||
        summary.includes('转入') || summary.includes('兑出')) {
      continue
    }

    const type: '支出' | '收入' = income > 0 ? '收入' : '支出'
    const amount = income > 0 ? income : expense

    // 解析日期 20250112 -> 2025-01-12
    let formattedDate: string
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    } else {
      // 尝试其他日期格式
      const dateObj = new Date(dateStr)
      if (isNaN(dateObj.getTime())) continue
      formattedDate = dateObj.toISOString().split('T')[0]
    }

    // 构建备注
    const remark = `${summary} - ${counterName}`.substring(0, 50)

    // 映射分类
    const category = mapBankCategory(type, summary, counterName)

    records.push({
      type,
      category,
      amount,
      date: formattedDate,
      remark
    })
  }

  return records
}

// 解析信用卡账单 (通过 DeepSeek AI)
const parseCreditBill = async (file: File): Promise<RecordData[]> => {
  try {
    console.log('正在解析PDF文件...', file.name)
    const { parsePdfText } = await import('../utils/pdf')
    const text = await parsePdfText(file)
    
    console.log('---------------- PDF Content Start ----------------')
    console.log(text)
    console.log('---------------- PDF Content End ----------------')
    
    // 调用智能解析 API
    const response = await authFetch('/api/bill/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI解析服务失败 (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'AI解析返回错误')
    }

    const records: RecordData[] = []
    
    // 映射 AI 返回的数据
    // 接口返回: { transactions: [{ type, amount, date, remark, category }] }
    if (result.data && Array.isArray(result.data.transactions)) {
      for (const item of result.data.transactions) {
        
        // 再次确认类型
        const type = item.type === '收入' ? '收入' : '支出'
        const amount = Number(item.amount)
        const date = item.date
        const remark = item.remark || ''
        
        // 优先使用 AI 建议的分类,如果 AI 没返回或标为其他,再尝试本地映射(可选)
        // 这里我们优先信任 AI 的分类,如果 AI 没给,再 fallback
        let category = item.category
        if (!category || category === '其他') {
           category = smartCategoryMapping(type, '', remark)
        }

        records.push({
          type,
          category,
          amount,
          date,
          remark
        })
      }
    }

    if (records.length === 0) {
      throw new Error('未能从文本中提取到有效交易记录')
    }

    return records

  } catch (error: any) {
    console.error('信用卡PDF解析错误:', error)
    if (error.message.includes('解析成功')) {
      throw error
    }
    throw new Error(error.message || 'PDF解析失败,请确认文件格式正确')
  }
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isProcessing.value = true
  // 重置成员选择状态
  detectedMemberName.value = ''
  suggestedMemberId.value = null
  selectedMemberId.value = null

  try {
    let records: RecordData[] = []

    if (billType.value === 'credit') {
        // 信用卡账单处理
        records = await parseCreditBill(file)
        // 信用卡账单暂不支持自动检测姓名，需要手动选择
    } else if (billType.value === 'jd' || billType.value === 'bank') {
        // 京东和银行账单：直接读取CSV文本并解析
        const text = await file.text()
        const lines = text.split('\n').map(line => line.trim()).filter(line => line)
        const rows = lines.map(line => {
          // 简单CSV解析：处理引号内的逗号
          const result: string[] = []
          let current = ''
          let inQuotes = false
          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result
        })

        if (billType.value === 'jd') {
          records = parseJDWalletBill(rows)
        } else {
          records = parseBankBill(rows)
        }
    } else {
        // 现有的 Excel/CSV 处理（微信、支付宝）
        let workbook: any

        if (billType.value === 'alipay') {
          // 支付宝账单使用GBK编码,使用FileReader API读取
          try {
            const text = await convertGBKtoUTF8(file)
            // 将解码后的文本传给XLSX
            workbook = XLSX.read(text, { type: 'string' })
          } catch (err: any) {
            throw new Error(`GBK编码解析失败: ${err.message}`)
          }
        } else {
          // 微信账单使用默认编码
          const data = await file.arrayBuffer()
          workbook = XLSX.read(data, { type: 'array' })
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

        if (billType.value === 'wechat') {
          records = parseWechatBill(rows)
          // 尝试从微信账单中提取昵称并智能匹配成员
          const nickname = extractWechatNickname(rows)
          if (nickname) {
            detectedMemberName.value = nickname
            const matchedId = matchMember(nickname, true)
            if (matchedId) {
              suggestedMemberId.value = matchedId
              selectedMemberId.value = matchedId
            }
          }
        } else {
          // 支付宝账单
          const result = parseAlipayBill(rows)
          records = result.records
          // 尝试智能匹配成员
          if (result.accountName) {
            detectedMemberName.value = result.accountName
            const matchedId = matchMember(result.accountName, false)
            if (matchedId) {
              suggestedMemberId.value = matchedId
              selectedMemberId.value = matchedId
            }
          }
        }
    }

    if (records.length === 0) {
        throw new Error('未找到有效记录')
    }

    previewRecords.value = records

    // 如果没有自动识别到成员,使用上次选择的成员
    if (!selectedMemberId.value && lastSelectedMemberId.value) {
      const member = activeMembers.value.find(m => m.id === lastSelectedMemberId.value)
      if (member) {
        selectedMemberId.value = lastSelectedMemberId.value
      }
    }

    // 如果是信用卡账单，进行数据分类
    if (billType.value === 'credit') {
      classifyRecords(records)
    } else {
      // 微信和支付宝账单不需要分类，全部作为有效数据
      validRecords.value = records
      duplicateRecords.value = []
    }

    showPreview.value = true

  } catch (err: any) {
    emit('error', err.message || '解析文件失败')
    console.error(err)
  } finally {
    isProcessing.value = false
    // Reset input
    if (fileInput.value) fileInput.value.value = ''
  }
}

const confirmImport = async () => {
    // 如果未选择成员且未显示过确认对话框,显示确认对话框
    if (selectedMemberId.value === null && !showMemberConfirm.value) {
      showMemberConfirm.value = true
      return
    }

    // 重置确认状态
    showMemberConfirm.value = false

    isProcessing.value = true
    try {
        // 只导入有效数据（validRecords），不导入重复数据
        const dataToImport = billType.value === 'credit' ? validRecords.value : previewRecords.value

        const response = await authFetch('/api/records/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                records: dataToImport,
                memberId: selectedMemberId.value
            })
        })

        const result = await response.json()

        if (response.ok) {
            // 保存成员选择到localStorage
            if (selectedMemberId.value !== null) {
              localStorage.setItem('lastSelectedMemberId', String(selectedMemberId.value))
            }

            emit('success', `成功导入 ${result.count} 条记录`)
            emit('records-added')
            showPreview.value = false
            previewRecords.value = []
            validRecords.value = []
            duplicateRecords.value = []
            // 重置成员选择
            selectedMemberId.value = null
            detectedMemberName.value = ''
            suggestedMemberId.value = null
        } else {
            throw new Error(result.error || '导入失败')
        }
    } catch (err: any) {
        emit('error', err.message || '导入请求失败')
    } finally {
        isProcessing.value = false
    }
}

const cancelMemberConfirm = () => {
  showMemberConfirm.value = false
}
</script>

<template>
  <div class="w-full">

    <!-- 账单类型选择 -->
    <div class="mb-6">
      <label class="block text-sm font-semibold text-gray-700 mb-3">选择账单类型</label>
      <div class="grid grid-cols-5 gap-2">
        <button
          @click="billType = 'wechat'"
          :class="[
            'p-3 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-1.5',
            billType === 'wechat'
              ? 'b-emerald-500 bg-emerald-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-emerald-300 hover:bg-emerald-50/50'
          ]"
        >
          <Smartphone
            :size="24"
            :class="billType === 'wechat' ? 'text-emerald-600' : 'text-gray-400'"
          />
          <span
            :class="[
              'text-xs font-semibold',
              billType === 'wechat' ? 'text-emerald-700' : 'text-gray-600'
            ]"
          >
            微信
          </span>
        </button>

        <button
          @click="billType = 'alipay'"
          :class="[
            'p-3 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-1.5',
            billType === 'alipay'
              ? 'b-blue-500 bg-blue-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-blue-300 hover:bg-blue-50/50'
          ]"
        >
          <FileText
            :size="24"
            :class="billType === 'alipay' ? 'text-blue-600' : 'text-gray-400'"
          />
          <span
            :class="[
              'text-xs font-semibold',
              billType === 'alipay' ? 'text-blue-700' : 'text-gray-600'
            ]"
          >
            支付宝
          </span>
        </button>

        <button
          @click="billType = 'jd'"
          :class="[
            'p-3 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-1.5',
            billType === 'jd'
              ? 'b-red-500 bg-red-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-red-300 hover:bg-red-50/50'
          ]"
        >
          <ShoppingBag
            :size="24"
            :class="billType === 'jd' ? 'text-red-600' : 'text-gray-400'"
          />
          <span
            :class="[
              'text-xs font-semibold',
              billType === 'jd' ? 'text-red-700' : 'text-gray-600'
            ]"
          >
            京东
          </span>
        </button>

        <button
          @click="billType = 'bank'"
          :class="[
            'p-3 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-1.5',
            billType === 'bank'
              ? 'b-amber-500 bg-amber-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-amber-300 hover:bg-amber-50/50'
          ]"
        >
          <Building2
            :size="24"
            :class="billType === 'bank' ? 'text-amber-600' : 'text-gray-400'"
          />
          <span
            :class="[
              'text-xs font-semibold',
              billType === 'bank' ? 'text-amber-700' : 'text-gray-600'
            ]"
          >
            银行
          </span>
        </button>

        <button
          @click="billType = 'credit'"
          :class="[
            'p-3 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-1.5',
            billType === 'credit'
              ? 'b-purple-500 bg-purple-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-purple-300 hover:bg-purple-50/50'
          ]"
        >
          <CreditCard
            :size="24"
            :class="billType === 'credit' ? 'text-purple-600' : 'text-gray-400'"
          />
          <span
            :class="[
              'text-xs font-semibold',
              billType === 'credit' ? 'text-purple-700' : 'text-gray-600'
            ]"
          >
            信用卡
          </span>
        </button>
      </div>
    </div>

    <!-- 上传按钮 -->
    <button
      @click="triggerFileInput"
      class="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      :disabled="isProcessing"
    >
      <Loader2 v-if="isProcessing" :size="20" class="animate-spin" />
      <Upload v-else :size="20" />
      <span>{{ isProcessing ? '处理中...' : `选择${
        billType === 'wechat' ? '微信' :
        billType === 'alipay' ? '支付宝' :
        billType === 'jd' ? '京东' :
        billType === 'bank' ? '银行' : '信用卡'
      }账单` }}</span>
    </button>
    <input
      ref="fileInput"
      type="file"
      :accept="billType === 'credit' ? '.pdf' : '.xlsx,.xls,.csv'"
      class="hidden"
      @change="handleFileChange"
    >

    <!-- 导入说明 -->
    <div class="mt-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 b-solid b-1px b-blue-100">
      <p class="text-sm text-gray-700 mb-2 font-semibold flex items-center gap-2">
        <FileText :size="16" class="text-blue-600" />
        导入说明
      </p>
      <ul class="text-xs text-gray-600 space-y-1.5 ml-6">
        <li v-if="billType === 'wechat'" class="flex items-start gap-2">
          <span class="text-green-500 mt-0.5">•</span>
          <span>支持微信支付账单导出文件(Excel 格式: .xlsx, .xls, .csv)</span>
        </li>
        <li v-if="billType === 'alipay'" class="flex items-start gap-2">
          <span class="text-blue-500 mt-0.5">•</span>
          <span>支持支付宝账单导出文件(CSV 格式,需使用 GBK 编码)</span>
        </li>
        <li v-if="billType === 'jd'" class="flex items-start gap-2">
          <span class="text-red-500 mt-0.5">•</span>
          <span>支持京东交易流水导出文件(CSV 格式),自动过滤退款和不计收支</span>
        </li>
        <li v-if="billType === 'bank'" class="flex items-start gap-2">
          <span class="text-amber-500 mt-0.5">•</span>
          <span>支持中信银行等银行流水(CSV 格式),自动过滤转账类记录</span>
        </li>
        <li v-if="billType === 'credit'" class="flex items-start gap-2">
          <span class="text-purple-500 mt-0.5">•</span>
          <span>支持招商银行等信用卡PDF账单,自动识别消费、退款</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-emerald-500 mt-0.5">•</span>
          <span>系统会自动识别交易类型并智能匹配分类</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="text-emerald-500 mt-0.5">•</span>
          <span>导入前可预览并调整分类,确保数据准确</span>
        </li>
      </ul>
    </div>

    <!-- Preview Modal -->
    <Modal :show="showPreview" title="导入预览" size="lg" @close="showPreview = false">
      <!-- 成员选择区域 -->
      <div v-if="activeMembers.length > 0" class="mb-4 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg b-solid b-2px b-amber-400">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Users :size="18" class="text-amber-600" />
            <span class="text-sm font-bold text-amber-900">⚠️ 请选择账单所属成员</span>
            <span v-if="detectedMemberName" class="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              检测到: {{ detectedMemberName }}
            </span>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            @click="selectedMemberId = null"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all b-solid b-2px',
              selectedMemberId === null
                ? 'bg-gray-700 text-white b-gray-700'
                : 'bg-white text-gray-600 b-gray-300 hover:b-gray-400'
            ]"
          >
            家庭共同
          </button>
          <button
            v-for="member in activeMembers"
            :key="member.id"
            @click="selectedMemberId = member.id || null"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all b-solid b-2px flex items-center gap-1.5',
              selectedMemberId === member.id
                ? 'text-white'
                : 'bg-white hover:opacity-80'
            ]"
            :style="{
              backgroundColor: selectedMemberId === member.id ? member.color : 'white',
              borderColor: member.color,
              color: selectedMemberId === member.id ? 'white' : member.color
            }"
          >
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
              :style="{ backgroundColor: member.color }"
            >
              {{ member.name.charAt(0) }}
            </span>
            {{ member.name }}
            <span v-if="suggestedMemberId === member.id" class="text-xs opacity-75">(推荐)</span>
          </button>
        </div>
      </div>

      <!-- 信用卡账单：分类显示 -->
      <template v-if="billType === 'credit'">
        <!-- 统计信息 -->
        <div class="mb-4 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg b-solid b-1px b-emerald-200">
          <p class="text-sm font-semibold text-emerald-800">
            共找到 {{ previewRecords.length }} 条记录，其中需导入 {{ validRecords.length }} 条，重复数据 {{ duplicateRecords.length }} 条
          </p>
        </div>

        <!-- 1. 需导入的数据 -->
        <div class="mb-6">
          <div class="mb-3 px-4 py-2 bg-blue-50 rounded-lg b-solid b-1px b-blue-200">
            <h3 class="text-sm font-bold text-blue-800">1. 需导入的数据 ({{ validRecords.length }} 条)</h3>
          </div>
          <div class="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">日期</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">类型</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">分类</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">金额</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">备注</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(record, idx) in validRecords" :key="'valid-' + idx" class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-gray-700">{{ record.date }}</td>
                  <td class="px-4 py-3">
                    <span
                      :class="record.type === '收入' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'"
                    >
                      {{ record.type }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <CustomSelect
                      v-model="record.category"
                      :options="CATEGORIES"
                    />
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                    {{ record.amount.toFixed(2) }}
                  </td>
                  <td class="px-4 py-3 text-gray-600 truncate max-w-xs" :title="record.remark">
                    {{ record.remark }}
                  </td>
                </tr>
                <tr v-if="validRecords.length === 0">
                  <td colspan="5" class="px-4 py-6 text-center text-gray-400">暂无需导入的数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. 重复数据 -->
        <div v-if="duplicateRecords.length > 0">
          <div class="mb-3 px-4 py-2 bg-orange-50 rounded-lg b-solid b-1px b-orange-200">
            <h3 class="text-sm font-bold text-orange-800">2. 与支付宝/微信重复数据 ({{ duplicateRecords.length }} 条)</h3>
            <p class="text-xs text-orange-600 mt-1">以下数据不会被导入</p>
          </div>
          <div class="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">日期</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">类型</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">分类</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">金额</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">备注</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="(record, idx) in duplicateRecords" :key="'dup-' + idx" class="hover:bg-gray-50 transition-colors opacity-60">
                  <td class="px-4 py-3 text-gray-700">{{ record.date }}</td>
                  <td class="px-4 py-3">
                    <span
                      :class="record.type === '收入' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'"
                    >
                      {{ record.type }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-600">
                    {{ record.category }}
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                    {{ record.amount.toFixed(2) }}
                  </td>
                  <td class="px-4 py-3 text-gray-600 truncate max-w-xs" :title="record.remark">
                    {{ record.remark }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- 微信/支付宝账单：原有显示方式 -->
      <template v-else>
        <div class="mb-4 px-4 py-3 bg-emerald-50 rounded-lg b-solid b-1px b-emerald-200">
          <p class="text-sm font-semibold text-emerald-800">
            共找到 {{ previewRecords.length }} 条有效记录
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">日期</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">类型</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">分类</th>
                <th class="px-4 py-3 text-right font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">金额</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 b-b-solid b-b-1px b-b-gray-200">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="(record, idx) in previewRecords" :key="idx" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-gray-700">{{ record.date }}</td>
                <td class="px-4 py-3">
                  <span
                    :class="record.type === '收入' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'"
                  >
                    {{ record.type }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <CustomSelect
                    v-model="record.category"
                    :options="CATEGORIES"
                  />
                </td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                  {{ record.amount.toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-gray-600 truncate max-w-xs" :title="record.remark">
                  {{ record.remark }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showPreview = false"
            class="px-5 py-2.5 rounded-xl b-solid b-1px b-gray-300 text-gray-700 hover:bg-gray-50 transition-all font-medium"
          >
            取消
          </button>
          <button
            @click="confirmImport"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-200 hover:shadow-xl hover:translate-y-[-1px] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isProcessing"
          >
            <Loader2 v-if="isProcessing" :size="18" class="animate-spin" />
            <span v-if="billType === 'credit'">确认导入 ({{ validRecords.length }} 条)</span>
            <span v-else>确认导入</span>
          </button>
        </div>
      </template>
    </Modal>

    <!-- 成员确认对话框 -->
    <Modal :show="showMemberConfirm" title="确认成员信息" size="sm" @close="cancelMemberConfirm">
      <div class="px-4 py-6">
        <div class="flex items-center gap-3 mb-4 p-4 bg-amber-50 rounded-lg b-solid b-1px b-amber-200">
          <AlertCircle :size="24" class="text-amber-600 flex-shrink-0" />
          <p class="text-sm text-amber-900">
            您未选择账单所属成员,这些账单将被记录为<strong>"家庭共同"</strong>账单。
          </p>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          建议为每笔账单指定所属成员,以便更准确地统计个人消费情况。
        </p>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="cancelMemberConfirm"
            class="px-5 py-2.5 rounded-xl b-solid b-1px b-gray-300 text-gray-700 hover:bg-gray-50 transition-all font-medium"
          >
            返回选择
          </button>
          <button
            @click="confirmImport"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg hover:shadow-xl transition-all"
          >
            确认导入为家庭共同
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

