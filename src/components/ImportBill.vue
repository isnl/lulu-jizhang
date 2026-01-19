<script setup lang="ts">
import { ref, computed } from 'vue'
import { Upload, FileText, CreditCard, Smartphone, Loader2, Users } from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { convertGBKtoUTF8 } from '../utils/gbk-converter'
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
const billType = ref<'wechat' | 'alipay' | 'credit'>('wechat') // 账单类型

// 成员选择相关
const selectedMemberId = ref<number | null>(null)
const detectedMemberName = ref<string>('')  // 从账单中检测到的姓名/昵称
const suggestedMemberId = ref<number | null>(null)  // 智能推荐的成员ID

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

const triggerFileInput = () => {
  fileInput.value?.click()
}

// 判断是否为重复数据（支付宝/微信）
const isDuplicateRecord = (record: RecordData): boolean => {
  const remark = record.remark || ''
  return remark.includes('支付宝-') || remark.includes('财付通-')
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
      const counterparty = row[2] // 交易对方
      const product = row[3] // 商品
      const direction = row[4] // 收/支
      const amountStr = row[5] // 金额
      const status = row[7] // 当前状态

      // Filter valid transaction status
      if (status !== '支付成功' && status !== '已到账') continue

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

      // Construct Remark
      const remark = `${counterparty} - ${product}`.substring(0, 50) // Limit length

      // Smart Category Mapping - 传入备注用于判断
      const category = smartCategoryMapping(type, counterparty, product, remark)

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
const smartCategoryMapping = (type: '支出' | '收入', counterparty: string, product: string, remark: string = ''): string => {
  let category = type === '支出' ? '日用品' : '其他' // Default

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

      // 交通
      { keywords: ['停车', '打车', '滴滴', '公交', '地铁', '加油', '出行', '中国铁路', '12306'], category: '交通' },

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
    const response = await fetch('/api/bill/analyze', {
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
    } else {
        // 现有的 Excel/CSV 处理
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
          // 微信账单暂不支持自动检测昵称
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
    isProcessing.value = true
    try {
        // 只导入有效数据（validRecords），不导入重复数据
        const dataToImport = billType.value === 'credit' ? validRecords.value : previewRecords.value

        const response = await fetch('/api/records/batch', {
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
</script>

<template>
  <div class="w-full">

    <!-- 账单类型选择 -->
    <div class="mb-6">
      <label class="block text-sm font-semibold text-gray-700 mb-3">选择账单类型</label>
      <div class="grid grid-cols-3 gap-3">
        <button
          @click="billType = 'wechat'"
          :class="[
            'p-4 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-2',
            billType === 'wechat'
              ? 'b-emerald-500 bg-emerald-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-emerald-300 hover:bg-emerald-50/50'
          ]"
        >
          <Smartphone 
            :size="28" 
            :class="billType === 'wechat' ? 'text-emerald-600' : 'text-gray-400'"
          />
          <span 
            :class="[
              'text-sm font-semibold',
              billType === 'wechat' ? 'text-emerald-700' : 'text-gray-600'
            ]"
          >
            微信支付
          </span>
        </button>

        <button
          @click="billType = 'alipay'"
          :class="[
            'p-4 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-2',
            billType === 'alipay'
              ? 'b-blue-500 bg-blue-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-blue-300 hover:bg-blue-50/50'
          ]"
        >
          <FileText 
            :size="28" 
            :class="billType === 'alipay' ? 'text-blue-600' : 'text-gray-400'"
          />
          <span 
            :class="[
              'text-sm font-semibold',
              billType === 'alipay' ? 'text-blue-700' : 'text-gray-600'
            ]"
          >
            支付宝
          </span>
        </button>

        <button
          @click="billType = 'credit'"
          :class="[
            'p-4 rounded-xl b-solid b-2px transition-all flex flex-col items-center gap-2',
            billType === 'credit'
              ? 'b-purple-500 bg-purple-50 shadow-md'
              : 'b-gray-200 bg-white hover:b-purple-300 hover:bg-purple-50/50'
          ]"
        >
          <CreditCard 
            :size="28" 
            :class="billType === 'credit' ? 'text-purple-600' : 'text-gray-400'"
          />
          <span 
            :class="[
              'text-sm font-semibold',
              billType === 'credit' ? 'text-purple-700' : 'text-gray-600'
            ]"
          >
            信用卡PDF
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
      <span>{{ isProcessing ? '处理中...' : `选择${billType === 'wechat' ? '微信' : (billType === 'alipay' ? '支付宝' : '信用卡')}账单` }}</span>
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
      <div v-if="activeMembers.length > 0" class="mb-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg b-solid b-1px b-blue-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Users :size="18" class="text-blue-600" />
            <span class="text-sm font-semibold text-blue-800">选择家庭成员</span>
            <span v-if="detectedMemberName" class="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
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
  </div>
</template>

