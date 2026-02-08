<script setup lang="ts">
import { computed, ref } from 'vue'
import { TrendingDown, TrendingUp, BarChart3, Inbox, Loader2, Wallet } from 'lucide-vue-next'
import type { RecordData } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'

const props = defineProps<{
  records: RecordData[]
  loading: boolean
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
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs"
                    :class="{
                      'font-semibold text-gray-900': getCellValue(record, category),
                      'text-gray-300': !getCellValue(record, category)
                    }"
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
                    class="px-3 py-2 text-right b-r-solid b-r-1px b-r-gray-200 whitespace-nowrap text-xs"
                    :class="{
                      'font-semibold text-gray-900': getCellValue(record, category),
                      'text-gray-300': !getCellValue(record, category)
                    }"
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

