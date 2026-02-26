<script setup lang="ts">
import { computed, ref } from 'vue'
import { TrendingDown, TrendingUp, BarChart3, Inbox, Loader2, Wallet, FileText } from 'lucide-vue-next'
import type { RecordData, Member } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'
import Modal from './ui/Modal.vue'
import { authFetch } from '../utils/auth'

const props = defineProps<{
  records: RecordData[]
  loading: boolean
  currentFilter?: { startMonth: string, endMonth: string, memberId: string }
  members?: Member[]
}>()

const emit = defineEmits<{
  recordDeleted: []
  recordUpdated: []
}>()

// Tab切换状态
const activeTab = ref<'expense' | 'income'>('expense')

const isDaily = computed(() => {
  return props.records.length > 0 && (props.records[0] as any).type === 'daily'
})

const isMonthly = computed(() => {
  return props.records.length > 0 && (props.records[0] as any).type === 'monthly'
})

const expenseHeaders = computed(() => {
  if (isDaily.value) {
    return ['日期', ...EXPENSE_CATEGORIES, '支出小计']
  } else if (isMonthly.value) {
    return ['月份', ...EXPENSE_CATEGORIES, '支出小计']
  }
  return ['日期', ...EXPENSE_CATEGORIES, '支出小计']
})

const incomeHeaders = computed(() => {
  if (isDaily.value) {
    return ['日期', ...INCOME_CATEGORIES, '收入小计']
  } else if (isMonthly.value) {
    return ['月份', ...INCOME_CATEGORIES, '收入小计']
  }
  return ['日期', ...INCOME_CATEGORIES, '收入小计']
})

const expenseTotals = computed(() => {
  if (props.records.length === 0) return {}

  const result: Record<string, number> = {}
  EXPENSE_CATEGORIES.forEach(cat => {
    result[cat] = 0
  })
  result['支出小计'] = 0

  props.records.forEach((record: any) => {
    EXPENSE_CATEGORIES.forEach(cat => {
      result[cat] += record[cat] || 0
    })
    // 计算支出小计
    let subtotal = 0
    EXPENSE_CATEGORIES.forEach(cat => {
      subtotal += record[cat] || 0
    })
    result['支出小计'] += subtotal
  })

  return result
})

const incomeTotals = computed(() => {
  if (props.records.length === 0) return {}

  const result: Record<string, number> = {}
  INCOME_CATEGORIES.forEach(cat => {
    result[cat] = 0
  })
  result['收入小计'] = 0

  props.records.forEach((record: any) => {
    INCOME_CATEGORIES.forEach(cat => {
      result[cat] += record[cat] || 0
    })
    // 计算收入小计
    let subtotal = 0
    INCOME_CATEGORIES.forEach(cat => {
      subtotal += record[cat] || 0
    })
    result['收入小计'] += subtotal
  })

  return result
})

const formatDate = (dateStr: string) => {
  if (isDaily.value) {
    const date = new Date(dateStr)
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  } else {
    const [year, month] = dateStr.split('-')
    return `${year}年${parseInt(month)}月`
  }
}

const getCellValue = (record: any, category: string) => {
  const value = record[category] || 0
  return value > 0 ? value.toFixed(2) : ''
}

const getSubtotal = (record: any, type: 'expense' | 'income') => {
  let subtotal = 0
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  categories.forEach(cat => {
    subtotal += record[cat] || 0
  })
  return subtotal
}

// 明细状态
const showDetailsModal = ref(false)
const detailsLoading = ref(false)
const detailsData = ref<any[]>([])
const detailsTitle = ref('')

// 获取明细数据
const fetchDetails = async (record: any, category: string, type: '支出' | '收入') => {
  let startDate = ''
  let endDate = ''
  if (record.type === 'daily') {
    startDate = record.date
    endDate = record.date
  } else if (record.type === 'monthly') {
    startDate = `${record.date}-01`
    const nextMonth = new Date(startDate)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(0) // 当月最后一天
    endDate = nextMonth.toISOString().split('T')[0]
  }

  const memberId = props.currentFilter?.memberId || 'all'

  try {
    detailsLoading.value = true
    showDetailsModal.value = true
    detailsTitle.value = `${record.date} ${category} ${type}明细`
    detailsData.value = []

    let url = `/api/records/list?startDate=${startDate}&endDate=${endDate}&type=${type}&category=${encodeURIComponent(category)}&memberId=${memberId}`
    const response = await authFetch(url)
    const result = await response.json()
    if (result.success) {
      detailsData.value = result.data.map((item: any) => ({ 
        ...item, 
        deleteLoading: false,
        isEditingCategory: false,
        editCategoryValue: item.category
      }))
    } else {
      console.error(result.error)
    }
  } catch (err) {
    console.error(err)
  } finally {
    detailsLoading.value = false
  }
}

const getMemberName = (id: number | null) => {
  if (!id || !props.members) return '家庭'
  const member = props.members.find(m => m.id === id)
  return member ? member.name : '未知'
}

const deleteRecord = async (id: number) => {
  if (!confirm('确定要删除这条记录吗？删除后不可恢复。')) return

  const itemIndex = detailsData.value.findIndex(item => item.id === id)
  if (itemIndex > -1) {
    detailsData.value[itemIndex].deleteLoading = true
  }

  try {
    const response = await authFetch(`/api/records/${id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    
    if (result.success) {
      // 从列表中移除
      detailsData.value = detailsData.value.filter(item => item.id !== id)
      // 通知父级数据已变更，需要刷新主统计表
      emit('recordDeleted')
      
      // 如果明细为空了，可以关闭弹窗
      if (detailsData.value.length === 0) {
        showDetailsModal.value = false
      }
    } else {
      alert(result.error || '删除失败')
    }
  } catch (error) {
    console.error('删除请求出错:', error)
    alert('删除记录时发生错误')
  } finally {
    const idx = detailsData.value.findIndex(item => item.id === id)
    if (idx > -1) {
      detailsData.value[idx].deleteLoading = false
    }
  }
}

const updateCategory = async (item: any) => {
  if (item.editCategoryValue === item.category) {
    item.isEditingCategory = false
    return
  }

  try {
    const response = await authFetch(`/api/records/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ category: item.editCategoryValue })
    })
    const result = await response.json()

    if (result.success) {
      // 从当前分类明细列表中移除（因为分类已经变了，不属于当前分类了）
      detailsData.value = detailsData.value.filter(d => d.id !== item.id)
      
      // 通知父级数据已变更，需要刷新主统计表
      emit('recordUpdated')

      // 如果明细为空了，关闭弹窗
      if (detailsData.value.length === 0) {
        showDetailsModal.value = false
      }
    } else {
      alert(result.error || '更新失败')
      item.editCategoryValue = item.category // 恢复原值
    }
  } catch (error) {
    console.error('更新请求出错:', error)
    alert('更新分类时发生错误')
    item.editCategoryValue = item.category
  } finally {
    item.isEditingCategory = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <Loader2 :size="64" class="text-emerald-500 animate-spin" />
      <p class="mt-4 text-gray-600 font-medium">加载中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="records.length === 0" class="text-center py-16">
      <Inbox :size="64" class="mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500 text-lg">暂无数据</p>
      <p class="text-gray-400 text-sm mt-2">请添加记录或调整查询条件</p>
    </div>

    <!-- Data Content -->
    <div v-else>
      <!-- 家庭汇总统计卡片 -->
      <div class="px-4 py-3 bg-gradient-to-r from-slate-50 to-gray-50 b-b-solid b-b-1px b-b-gray-200">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <div class="p-1.5 bg-white rounded-lg shadow-sm">
              <Wallet :size="18" class="text-slate-600" />
            </div>
            <span class="text-sm font-semibold text-gray-700">家庭汇总</span>
          </div>
          <div class="flex items-center gap-6">
            <!-- 总收入 -->
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <TrendingUp :size="16" class="text-emerald-500" />
                <span class="text-xs text-gray-500">收入</span>
              </div>
              <span class="text-lg font-bold text-emerald-600">{{ incomeTotals['收入小计']?.toFixed(2) || '0.00' }}</span>
            </div>
            <!-- 总支出 -->
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <TrendingDown :size="16" class="text-red-500" />
                <span class="text-xs text-gray-500">支出</span>
              </div>
              <span class="text-lg font-bold text-red-600">{{ expenseTotals['支出小计']?.toFixed(2) || '0.00' }}</span>
            </div>
            <!-- 结余 -->
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <BarChart3 :size="16" class="text-blue-500" />
                <span class="text-xs text-gray-500">结余</span>
              </div>
              <span
                class="text-lg font-bold"
                :class="(incomeTotals['收入小计'] || 0) - (expenseTotals['支出小计'] || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'"
              >
                {{ ((incomeTotals['收入小计'] || 0) - (expenseTotals['支出小计'] || 0)).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab切换 -->
      <div class="flex b-b-solid b-b-1px b-b-gray-200">
        <button
          @click="activeTab = 'expense'"
          :class="[
            'flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all',
            activeTab === 'expense'
              ? 'text-red-600 bg-red-50 b-b-solid b-b-2px b-b-red-500'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          ]"
        >
          <TrendingDown :size="18" />
          支出明细
          <span class="px-1.5 py-0.5 rounded text-xs" :class="activeTab === 'expense' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">
            {{ expenseTotals['支出小计']?.toFixed(2) || '0.00' }}
          </span>
        </button>
        <button
          @click="activeTab = 'income'"
          :class="[
            'flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all',
            activeTab === 'income'
              ? 'text-emerald-600 bg-emerald-50 b-b-solid b-b-2px b-b-emerald-500'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          ]"
        >
          <TrendingUp :size="18" />
          收入明细
          <span class="px-1.5 py-0.5 rounded text-xs" :class="activeTab === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'">
            {{ incomeTotals['收入小计']?.toFixed(2) || '0.00' }}
          </span>
        </button>
      </div>

      <!-- 统计表内容区 -->
      <div class="p-4">
        <!-- 支出统计表 -->
        <div v-show="activeTab === 'expense'">
          <div class="overflow-x-auto rounded-lg b-solid b-1px b-gray-200 shadow-sm custom-scrollbar">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                  <th
                    v-for="header in expenseHeaders"
                    :key="header"
                    class="px-3 py-2 text-center font-semibold b-r-solid b-r-1px b-r-red-400 last:b-r-0 whitespace-nowrap text-xs"
                    :class="{
                      'sticky left-0 z-10 bg-gradient-to-r from-red-600 to-pink-600': header === '日期' || header === '月份',
                      'bg-gradient-to-r from-pink-600 to-rose-600': header === '支出小计'
                    }"
                  >
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(record, index) in records"
                  :key="index"
                  class="b-b-solid b-b-1px b-b-gray-200 hover:bg-red-50 transition-colors"
                  :class="{ 'bg-gray-50': index % 2 === 0 }"
                >
                  <td class="px-3 py-2 font-semibold text-gray-800 sticky left-0 z-10 bg-white b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs"
                      :class="{ 'bg-gray-50': index % 2 === 0 }">
                    {{ formatDate(record.date) }}
                  </td>
                  <td
                    v-for="category in EXPENSE_CATEGORIES"
                    :key="category"
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs transition-colors"
                    :class="{
                      'font-semibold text-gray-900 cursor-pointer hover:bg-red-100 hover:text-red-700': getCellValue(record, category),
                      'text-gray-300': !getCellValue(record, category)
                    }"
                    @click="getCellValue(record, category) ? fetchDetails(record, category, '支出') : null"
                    :title="getCellValue(record, category) ? '点击查看明细' : ''"
                  >
                    {{ getCellValue(record, category) }}
                  </td>
                  <td class="px-3 py-2 text-right font-bold bg-red-50 text-red-700 whitespace-nowrap text-xs">
                    {{ getSubtotal(record, 'expense').toFixed(2) }}
                  </td>
                </tr>

                <!-- Expense Totals Row -->
                <tr class="bg-gradient-to-r from-gray-100 to-gray-200 font-bold b-t-solid b-t-2px b-t-gray-400">
                  <td class="px-3 py-2 text-center sticky left-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200 b-r-solid b-r-1px b-r-gray-300 whitespace-nowrap text-xs">
                    总计
                  </td>
                  <td
                    v-for="category in EXPENSE_CATEGORIES"
                    :key="category"
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-300 text-gray-800 whitespace-nowrap text-xs"
                  >
                    {{ expenseTotals[category]?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-3 py-2 text-right text-sm bg-gradient-to-r from-red-100 to-pink-100 text-red-800 whitespace-nowrap">
                    {{ expenseTotals['支出小计']?.toFixed(2) || '0.00' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 收入统计表 -->
        <div v-show="activeTab === 'income'">
          <div class="overflow-x-auto rounded-lg b-solid b-1px b-gray-200 shadow-sm custom-scrollbar">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  <th
                    v-for="header in incomeHeaders"
                    :key="header"
                    class="px-3 py-2 text-center font-semibold b-r-solid b-r-1px b-r-emerald-400 last:b-r-0 whitespace-nowrap text-xs"
                    :class="{
                      'sticky left-0 z-10 bg-gradient-to-r from-emerald-600 to-teal-600': header === '日期' || header === '月份',
                      'bg-gradient-to-r from-teal-600 to-cyan-600': header === '收入小计'
                    }"
                  >
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(record, index) in records"
                  :key="index"
                  class="b-b-solid b-b-1px b-b-gray-200 hover:bg-emerald-50 transition-colors"
                  :class="{ 'bg-gray-50': index % 2 === 0 }"
                >
                  <td class="px-3 py-2 font-semibold text-gray-800 sticky left-0 z-10 bg-white b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs"
                      :class="{ 'bg-gray-50': index % 2 === 0 }">
                    {{ formatDate(record.date) }}
                  </td>
                  <td
                    v-for="category in INCOME_CATEGORIES"
                    :key="category"
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs transition-colors"
                    :class="{
                      'font-semibold text-gray-900 cursor-pointer hover:bg-emerald-100 hover:text-emerald-700': getCellValue(record, category),
                      'text-gray-300': !getCellValue(record, category)
                    }"
                    @click="getCellValue(record, category) ? fetchDetails(record, category, '收入') : null"
                    :title="getCellValue(record, category) ? '点击查看明细' : ''"
                  >
                    {{ getCellValue(record, category) }}
                  </td>
                  <td class="px-3 py-2 text-right font-bold bg-emerald-50 text-emerald-700 whitespace-nowrap text-xs">
                    {{ getSubtotal(record, 'income').toFixed(2) }}
                  </td>
                </tr>

                <!-- Income Totals Row -->
                <tr class="bg-gradient-to-r from-gray-100 to-gray-200 font-bold b-t-solid b-t-2px b-t-gray-400">
                  <td class="px-3 py-2 text-center sticky left-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200 b-r-solid b-r-1px b-r-gray-300 whitespace-nowrap text-xs">
                    总计
                  </td>
                  <td
                    v-for="category in INCOME_CATEGORIES"
                    :key="category"
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-300 text-gray-800 whitespace-nowrap text-xs"
                  >
                    {{ incomeTotals[category]?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-3 py-2 text-right text-sm bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 whitespace-nowrap">
                    {{ incomeTotals['收入小计']?.toFixed(2) || '0.00' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 明细弹窗 -->
    <Modal
      :show="showDetailsModal"
      :title="detailsTitle"
      size="lg"
      @close="showDetailsModal = false"
    >
      <div v-if="detailsLoading" class="flex flex-col items-center justify-center py-16">
        <Loader2 :size="48" class="text-emerald-500 animate-spin" />
        <p class="mt-4 text-gray-600 font-medium">加载明细中...</p>
      </div>
      <div v-else-if="detailsData.length === 0" class="text-center py-16">
        <FileText :size="64" class="mx-auto text-gray-300 mb-4" />
        <p class="text-gray-500 text-lg">暂无明细数据</p>
      </div>
      <div v-else class="max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-gray-600">
                <th class="px-4 py-2 text-left font-medium border-b border-gray-200">日期</th>
                <th class="px-4 py-2 text-left font-medium border-b border-gray-200">分类</th>
                <th class="px-4 py-2 text-left font-medium border-b border-gray-200">成员</th>
                <th class="px-4 py-2 text-left font-medium border-b border-gray-200">备注</th>
                <th class="px-4 py-2 text-right font-medium border-b border-gray-200">金额</th>
                <th class="px-4 py-2 text-center font-medium border-b border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in detailsData"
                :key="item.id || idx"
                class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                :class="{ 'bg-gray-50/50': idx % 2 === 0, 'opacity-50': item.deleteLoading }"
              >
                <td class="px-4 py-2 text-gray-800 whitespace-nowrap">{{ item.date }}</td>
                <td class="px-4 py-2 whitespace-nowrap">
                  <div v-if="item.isEditingCategory" class="flex items-center gap-1">
                    <select
                      v-model="item.editCategoryValue"
                      class="px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option v-for="cat in (item.type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)" :key="cat" :value="cat">
                        {{ cat }}
                      </option>
                    </select>
                    <button @click="updateCategory(item)" class="text-emerald-600 hover:text-emerald-800 p-0.5">确认</button>
                    <button @click="item.isEditingCategory = false; item.editCategoryValue = item.category" class="text-gray-400 hover:text-gray-600 p-0.5">取消</button>
                  </div>
                  <div v-else class="flex items-center gap-2 group">
                    <span class="text-sm font-medium text-gray-700">{{ item.category }}</span>
                    <button
                      @click="item.isEditingCategory = true"
                      class="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                    >
                      修改
                    </button>
                  </div>
                </td>
                <td class="px-4 py-2">
                  <span class="px-2 py-0.5 rounded text-xs border border-gray-200" :style="item.memberId ? 'background: #f3f4f6' : 'background: #e5e7eb; color: #4b5563'">
                    {{ getMemberName(item.memberId) }}
                  </span>
                </td>
                <td class="px-4 py-2 text-gray-600" :title="item.remark">{{ item.remark || '-' }}</td>
                <td class="px-4 py-2 text-right font-semibold whitespace-nowrap" :class="item.type === '支出' ? 'text-red-600' : 'text-emerald-600'">
                  {{ item.amount?.toFixed(2) }}
                </td>
                <td class="px-4 py-2 text-center whitespace-nowrap">
                  <button
                    @click="deleteRecord(item.id)"
                    :disabled="item.deleteLoading"
                    class="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {{ item.deleteLoading ? '删除中...' : '删除' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="flex justify-end mt-4 pt-4 border-t border-gray-200">
        <button
          @click="showDetailsModal = false"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          关闭
        </button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #10b981 #f3f4f6;
}

.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(to right, #10b981, #14b8a6);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to right, #059669, #0d9488);
}
</style>

