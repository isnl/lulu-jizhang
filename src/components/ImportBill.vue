<script setup lang="ts">
import { ref } from 'vue'
import { Upload, FileText, CreditCard, Smartphone, Loader2 } from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { convertGBKtoUTF8 } from '../utils/gbk-converter'
import type { RecordData } from '../types'
import Modal from './ui/Modal.vue'
import CustomSelect from './ui/CustomSelect.vue'

const props = defineProps<{
  onImportSuccess?: () => void
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

// 导入分类常量
import { CATEGORIES } from '../types'

const triggerFileInput = () => {
  fileInput.value?.click()
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

      // Smart Category Mapping
      const category = smartCategoryMapping(type, counterparty, product)
      
      // Construct Remark
      const remark = `${counterparty} - ${product}`.substring(0, 50) // Limit length

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
const parseAlipayBill = (rows: any[][]): RecordData[] => {
  // 支付宝CSV格式:前4行是元数据,第5行是表头
  // 表头:交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额(元),收/支,交易状态,服务费(元),成功退款(元),备注,资金状态
  
  if (rows.length < 6) {
    throw new Error('支付宝账单文件格式不正确')
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

// 智能分类映射(微信和支付宝共用)
const smartCategoryMapping = (type: '支出' | '收入', counterparty: string, product: string): string => {
  let category = type === '支出' ? '日用品' : '其他' // Default
  
  if (type === '支出') {
    // 支出分类映射规则(优先级从高到低)
    const categoryRules = [
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
      
      // 宠物
      { keywords: ['宠物', '猫粮', '狗粮', '宠物医院'], category: '宠物' },
    ]
    
    // 匹配规则
    for (const rule of categoryRules) {
      if (rule.keywords.some(keyword => counterparty.includes(keyword) || product.includes(keyword))) {
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
      if (rule.keywords.some(keyword => counterparty.includes(keyword) || product.includes(keyword))) {
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
  try {
    let records: RecordData[] = []
    
    if (billType.value === 'credit') {
        // 信用卡账单处理
        records = await parseCreditBill(file)
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
        } else {
          records = parseAlipayBill(rows)
        }
    }

    if (records.length === 0) {
        throw new Error('未找到有效记录')
    }

    previewRecords.value = records
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
        const response = await fetch('/api/records/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(previewRecords.value)
        })

        const result = await response.json()
        
        if (response.ok) {
            emit('success', `成功导入 ${result.count} 条记录`)
            emit('records-added')
            showPreview.value = false
            previewRecords.value = []
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
            确认导入
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

