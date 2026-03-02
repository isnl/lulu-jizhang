<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue'
import {
  BarChart3,
  CalendarDays,
  RefreshCw,
  PieChart,
  Layers3,
  ListOrdered,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  Hash,
  DollarSign,
  Calendar
} from 'lucide-vue-next'
import type { Member } from '../types'
import { EXPENSE_CATEGORIES } from '../types'
import YearPicker from './ui/YearPicker.vue'
import { authFetch } from '../utils/auth'

interface ExpenseRecord {
  id: number
  amount: number
  date: string
  category: string
  memberId: number | null
  remark?: string
}

interface RemarkInsightItem {
  remark: string
  count: number
  total: number
  average: number
  maxSingle: number
  minSingle: number
  latestDate: string
  earliestDate: string
  topCategory: string
  topMember: string
  categories: Array<{ name: string; total: number }>
  members: Array<{ name: string; total: number }>
  monthlySpan: number
}

const props = defineProps<{
  members?: Member[]
  dataVersion?: number
}>()

const loading = ref(false)
const fetchError = ref('')
const selectedYear = ref(String(new Date().getFullYear() - 1))
const selectedScope = ref('all') // all | family | memberId
const yearlyRecords = ref<ExpenseRecord[]>([])

const categoryPalette = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
]

const formatCurrency = (value: number) => value.toFixed(2)

const getMemberName = (memberId: number | null) => {
  if (memberId === null) return '家庭'
  const member = props.members?.find(item => item.id === memberId)
  return member?.name || '未知成员'
}

const loadYearlyExpenseData = async () => {
  if (!/^\d{4}$/.test(selectedYear.value)) {
    fetchError.value = '年份格式错误'
    yearlyRecords.value = []
    return
  }

  try {
    loading.value = true
    fetchError.value = ''
    const startDate = `${selectedYear.value}-01-01`
    const endDate = `${selectedYear.value}-12-31`
    const response = await authFetch(`/api/records/list?startDate=${startDate}&endDate=${endDate}&type=支出&memberId=all`)
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '获取年度支出数据失败')
    }

    yearlyRecords.value = (result.data || []).map((item: any) => ({
      id: item.id,
      amount: Number(item.amount) || 0,
      date: item.date,
      category: item.category,
      memberId: item.memberId ?? null,
      remark: item.remark || ''
    }))
  } catch (error) {
    fetchError.value = error instanceof Error ? error.message : '加载失败'
    yearlyRecords.value = []
  } finally {
    loading.value = false
  }
}

watch(
  [selectedYear, () => props.dataVersion],
  () => {
    loadYearlyExpenseData()
  },
  { immediate: true }
)

const scopedRecords = computed(() => {
  if (selectedScope.value === 'all') {
    return yearlyRecords.value
  }
  if (selectedScope.value === 'family') {
    return yearlyRecords.value.filter(item => item.memberId === null)
  }

  const memberId = Number(selectedScope.value)
  if (Number.isNaN(memberId)) {
    return yearlyRecords.value
  }
  return yearlyRecords.value.filter(item => item.memberId === memberId)
})

const totalExpense = computed(() => scopedRecords.value.reduce((sum, item) => sum + item.amount, 0))

const monthlyTotals = computed(() => {
  const map = new Map<string, number>()
  for (let month = 1; month <= 12; month++) {
    const key = `${selectedYear.value}-${String(month).padStart(2, '0')}`
    map.set(key, 0)
  }

  scopedRecords.value.forEach((record) => {
    const key = record.date.slice(0, 7)
    map.set(key, (map.get(key) || 0) + record.amount)
  })

  return Array.from(map.entries()).map(([key, value], index) => ({
    key,
    label: `${index + 1}月`,
    total: value
  }))
})

const maxMonthlyTotal = computed(() => {
  return monthlyTotals.value.reduce((max, item) => Math.max(max, item.total), 0)
})

const monthlyAverage = computed(() => {
  return totalExpense.value / 12
})

const peakMonth = computed(() => {
  if (monthlyTotals.value.length === 0) return null
  return monthlyTotals.value.reduce((prev, curr) => curr.total > prev.total ? curr : prev)
})

const topSingleExpense = computed(() => {
  if (scopedRecords.value.length === 0) return null
  return [...scopedRecords.value].sort((a, b) => b.amount - a.amount)[0]
})

const categoryTotals = computed(() => {
  const map = new Map<string, number>()
  EXPENSE_CATEGORIES.forEach((category) => map.set(category, 0))
  scopedRecords.value.forEach((record) => {
    map.set(record.category, (map.get(record.category) || 0) + record.amount)
  })
  return Array.from(map.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: totalExpense.value > 0 ? (total / totalExpense.value) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total)
})

const topCategory = computed(() => categoryTotals.value[0] || null)

const categoryDonutStyle = computed(() => {
  const slices = categoryTotals.value.filter(item => item.total > 0).slice(0, 8)
  if (slices.length === 0) {
    return { background: 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)' }
  }

  let start = 0
  const parts = slices.map((item, index) => {
    const angle = (item.percentage / 100) * 360
    const end = start + angle
    const color = categoryPalette[index % categoryPalette.length]
    const text = `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`
    start = end
    return text
  })

  if (start < 360) {
    parts.push(`#e5e7eb ${start.toFixed(2)}deg 360deg`)
  }

  return {
    background: `conic-gradient(${parts.join(', ')})`
  }
})

// ==================== 备注洞察 ====================
const remarkSearchKeyword = ref('')
const remarkSortBy = ref<'count' | 'total' | 'average' | 'latest'>('count')
const remarkVisibleCount = ref(20)
const expandedRemarks = reactive(new Set<string>())

const toggleRemarkExpand = (remark: string) => {
  if (expandedRemarks.has(remark)) {
    expandedRemarks.delete(remark)
  } else {
    expandedRemarks.add(remark)
  }
}

const remarkInsights = computed<RemarkInsightItem[]>(() => {
  const map = new Map<string, {
    count: number
    total: number
    maxSingle: number
    minSingle: number
    latestDate: string
    earliestDate: string
    categoryMap: Map<string, number>
    memberMap: Map<string, number>
    months: Set<string>
  }>()

  scopedRecords.value.forEach((record) => {
    const remark = (record.remark || '').trim()
    if (!remark) return

    const current = map.get(remark) || {
      count: 0,
      total: 0,
      maxSingle: 0,
      minSingle: Infinity,
      latestDate: record.date,
      earliestDate: record.date,
      categoryMap: new Map<string, number>(),
      memberMap: new Map<string, number>(),
      months: new Set<string>()
    }

    current.count += 1
    current.total += record.amount
    current.maxSingle = Math.max(current.maxSingle, record.amount)
    current.minSingle = Math.min(current.minSingle, record.amount)
    if (record.date > current.latestDate) current.latestDate = record.date
    if (record.date < current.earliestDate) current.earliestDate = record.date
    current.months.add(record.date.slice(0, 7))
    current.categoryMap.set(record.category, (current.categoryMap.get(record.category) || 0) + record.amount)
    const memberName = getMemberName(record.memberId)
    current.memberMap.set(memberName, (current.memberMap.get(memberName) || 0) + record.amount)

    map.set(remark, current)
  })

  return Array.from(map.entries()).map(([remark, value]) => ({
    remark,
    count: value.count,
    total: value.total,
    average: value.total / value.count,
    maxSingle: value.maxSingle,
    minSingle: value.minSingle === Infinity ? 0 : value.minSingle,
    latestDate: value.latestDate,
    earliestDate: value.earliestDate,
    topCategory: Array.from(value.categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
    topMember: Array.from(value.memberMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
    categories: Array.from(value.categoryMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    members: Array.from(value.memberMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    monthlySpan: value.months.size
  }))
})

// 高频备注 Top 10 (按次数)
const topFrequentRemarks = computed(() => {
  return [...remarkInsights.value]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 10)
})

const maxFrequentCount = computed(() => {
  if (topFrequentRemarks.value.length === 0) return 1
  return topFrequentRemarks.value[0].count
})

const filteredRemarkInsights = computed(() => {
  const keyword = remarkSearchKeyword.value.trim().toLowerCase()
  let result = remarkInsights.value

  if (keyword) {
    result = result.filter(item => item.remark.toLowerCase().includes(keyword))
  }

  if (remarkSortBy.value === 'total') {
    result = [...result].sort((a, b) => b.total - a.total)
  } else if (remarkSortBy.value === 'average') {
    result = [...result].sort((a, b) => b.average - a.average)
  } else if (remarkSortBy.value === 'latest') {
    result = [...result].sort((a, b) => b.latestDate.localeCompare(a.latestDate))
  } else {
    result = [...result].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return b.total - a.total
    })
  }

  return result
})

const visibleRemarkInsights = computed(() => {
  return filteredRemarkInsights.value.slice(0, remarkVisibleCount.value)
})

const resetRemarkFilters = () => {
  remarkSearchKeyword.value = ''
  remarkSortBy.value = 'count'
  remarkVisibleCount.value = 20
  expandedRemarks.clear()
}

const loadMoreRemarks = () => {
  remarkVisibleCount.value += 20
}

watch([remarkSearchKeyword, remarkSortBy], () => {
  remarkVisibleCount.value = 20
})

const truncateRemark = (text: string, maxLen = 40) => {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

const isLongRemark = (text: string, maxLen = 40) => text.length > maxLen

const scopeOptions = computed(() => {
  const options: Array<{ value: string, label: string }> = [
    { value: 'all', label: '全体支出（家庭+成员）' },
    { value: 'family', label: '仅家庭共同支出' }
  ]
  ;(props.members || [])
    .filter(member => member.isActive)
    .forEach((member) => {
      if (member.id === undefined) return
      options.push({
        value: String(member.id),
        label: `仅 ${member.name}`
      })
    })
  return options
})
</script>

<template>
  <section class="space-y-4">
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <BarChart3 :size="18" class="text-red-600" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-800">年度支出多维可视化</h2>
            <p class="text-sm text-gray-500">聚焦家庭/成员维度，仅统计支出数据</p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="w-[120px]">
            <YearPicker v-model="selectedYear" />
          </div>
          <select
            v-model="selectedScope"
            class="h-9 px-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
          >
            <option v-for="option in scopeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <button
            type="button"
            @click="loadYearlyExpenseData"
            class="h-9 px-3 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw :size="14" />
            刷新
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center text-gray-500">
      正在加载年度支出数据...
    </div>

    <div v-else-if="fetchError" class="bg-red-50 text-red-700 rounded-2xl border border-red-200 p-6">
      {{ fetchError }}
    </div>

    <div v-else-if="yearlyRecords.length === 0" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center text-gray-500">
      当前年份没有支出数据
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="text-sm text-gray-500 flex items-center gap-1.5"><CalendarDays :size="14" /> 年度总支出</div>
          <div class="mt-2 text-2xl font-bold text-red-600">{{ formatCurrency(totalExpense) }}</div>
          <p class="mt-1 text-xs text-gray-400">统计口径：{{ selectedYear }} 年 {{ scopeOptions.find(i => i.value === selectedScope)?.label }}</p>
        </article>

        <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="text-sm text-gray-500 flex items-center gap-1.5"><BarChart3 :size="14" /> 月均支出</div>
          <div class="mt-2 text-2xl font-bold text-orange-600">{{ formatCurrency(monthlyAverage) }}</div>
          <p class="mt-1 text-xs text-gray-400">按 12 个月均摊</p>
        </article>

        <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="text-sm text-gray-500 flex items-center gap-1.5"><Layers3 :size="14" /> 峰值月份</div>
          <div class="mt-2 text-2xl font-bold text-rose-600">{{ peakMonth?.label || '-' }}</div>
          <p class="mt-1 text-xs text-gray-400">峰值金额 {{ formatCurrency(peakMonth?.total || 0) }}</p>
        </article>

        <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="text-sm text-gray-500 flex items-center gap-1.5"><ListOrdered :size="14" /> 最大单笔</div>
          <div class="mt-2 text-2xl font-bold text-red-700">{{ formatCurrency(topSingleExpense?.amount || 0) }}</div>
          <p class="mt-1 text-xs text-gray-400">
            {{ topSingleExpense ? `${topSingleExpense.date} · ${getMemberName(topSingleExpense.memberId)} · ${topSingleExpense.category}` : '-' }}
          </p>
        </article>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <article class="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h3 class="text-base font-semibold text-gray-800 mb-4">月度支出趋势</h3>
          <div class="grid grid-cols-12 gap-2 items-end h-[260px]">
            <div
              v-for="item in monthlyTotals"
              :key="item.key"
              class="flex flex-col items-center gap-1"
            >
              <div class="text-[11px] text-gray-500">{{ item.total > 0 ? formatCurrency(item.total) : '' }}</div>
              <div
                class="w-full rounded-t-md bg-gradient-to-t from-red-500 to-orange-300 transition-all"
                :style="{ height: `${maxMonthlyTotal > 0 ? Math.max((item.total / maxMonthlyTotal) * 180, item.total > 0 ? 10 : 2) : 2}px` }"
              ></div>
              <div class="text-xs text-gray-500">{{ item.label }}</div>
            </div>
          </div>
        </article>

        <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h3 class="text-base font-semibold text-gray-800 mb-4 flex items-center gap-1.5"><PieChart :size="16" class="text-red-500" /> 分类占比</h3>
          <div class="flex justify-center mb-4">
            <div class="relative w-36 h-36 rounded-full" :style="categoryDonutStyle">
              <div class="absolute inset-5 rounded-full bg-white flex items-center justify-center text-sm font-semibold text-gray-700">
                {{ topCategory?.category || '无数据' }}
              </div>
            </div>
          </div>
          <div class="space-y-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-1">
            <div v-for="(item, idx) in categoryTotals.slice(0, 10)" :key="item.category">
              <div class="flex justify-between text-xs text-gray-600 mb-1">
                <span>{{ item.category }}</span>
                <span>{{ formatCurrency(item.total) }} / {{ item.percentage.toFixed(1) }}%</span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: `${Math.max(item.percentage, item.total > 0 ? 2 : 0)}%`,
                    backgroundColor: categoryPalette[idx % categoryPalette.length]
                  }"
                ></div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- ========== 备注洞察 ========== -->
      <article class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <h3 class="text-base font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
          <MessageSquareText :size="16" class="text-orange-500" />
          备注洞察
        </h3>

        <!-- 高频备注 Top 10 -->
        <div class="rounded-xl border border-gray-200 p-3 mb-4">
          <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Hash :size="14" class="text-orange-500" />
            高频备注 Top 10
          </h4>
          <div v-if="topFrequentRemarks.length === 0" class="text-sm text-gray-400 py-4 text-center">暂无数据</div>
          <div v-else class="space-y-2">
            <div v-for="(item, idx) in topFrequentRemarks" :key="`freq-${idx}`" class="flex items-center gap-2">
              <span class="text-xs text-gray-400 w-5 text-right shrink-0">{{ idx + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-sm text-gray-700 truncate" :title="item.remark">{{ truncateRemark(item.remark, 20) }}</span>
                  <span class="text-xs text-orange-600 font-medium shrink-0">{{ item.count }}次</span>
                </div>
                <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all"
                    :style="{ width: `${(item.count / maxFrequentCount) * 100}%` }"
                  ></div>
                </div>
              </div>
              <span class="text-xs text-gray-500 shrink-0">{{ formatCurrency(item.total) }}</span>
            </div>
          </div>
        </div>

        <!-- 搜索和筛选 -->
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="relative flex-1 min-w-[200px]">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              v-model="remarkSearchKeyword"
              type="text"
              placeholder="搜索备注内容..."
              class="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
            />
          </div>
          <select
            v-model="remarkSortBy"
            class="h-9 px-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          >
            <option value="count">按次数排序</option>
            <option value="total">按总金额排序</option>
            <option value="average">按均额排序</option>
            <option value="latest">按最近日期排序</option>
          </select>
          <button
            type="button"
            @click="resetRemarkFilters"
            class="h-9 px-3 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <RotateCcw :size="13" />
            重置
          </button>
        </div>

        <div class="text-xs text-gray-400 mb-3">
          显示 {{ visibleRemarkInsights.length }} / {{ filteredRemarkInsights.length }} 条
        </div>

        <!-- 空状态 -->
        <div v-if="filteredRemarkInsights.length === 0" class="text-sm text-gray-400 py-8 text-center">
          当前条件下暂无备注洞察数据
        </div>

        <!-- 备注卡片列表 -->
        <div v-else class="space-y-2">
          <div
            v-for="(item, idx) in visibleRemarkInsights"
            :key="`${item.remark}-${idx}`"
            class="rounded-xl border border-gray-200 hover:border-orange-200 transition-colors overflow-hidden"
          >
            <!-- 主内容行 -->
            <div class="px-3 py-2.5 flex items-start gap-3">
              <!-- 序号 -->
              <span class="text-xs text-gray-400 mt-0.5 shrink-0 w-6 text-right">{{ idx + 1 }}</span>

              <!-- 备注内容+详情 -->
              <div class="flex-1 min-w-0">
                <!-- 备注文本 -->
                <div class="mb-1.5">
                  <template v-if="isLongRemark(item.remark) && !expandedRemarks.has(item.remark)">
                    <span class="text-sm text-gray-800 leading-relaxed">{{ truncateRemark(item.remark) }}</span>
                    <button
                      type="button"
                      @click="toggleRemarkExpand(item.remark)"
                      class="inline-flex items-center gap-0.5 ml-1 text-xs text-orange-500 hover:text-orange-700"
                    >
                      展开 <ChevronDown :size="12" />
                    </button>
                  </template>
                  <template v-else-if="isLongRemark(item.remark) && expandedRemarks.has(item.remark)">
                    <span class="text-sm text-gray-800 leading-relaxed break-all whitespace-pre-wrap">{{ item.remark }}</span>
                    <button
                      type="button"
                      @click="toggleRemarkExpand(item.remark)"
                      class="inline-flex items-center gap-0.5 ml-1 text-xs text-orange-500 hover:text-orange-700"
                    >
                      收起 <ChevronUp :size="12" />
                    </button>
                  </template>
                  <template v-else>
                    <span class="text-sm text-gray-800 leading-relaxed">{{ item.remark }}</span>
                  </template>
                </div>

                <!-- 标签行 -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700">
                    <Hash :size="10" /> {{ item.count }}次
                  </span>
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700">
                    <DollarSign :size="10" /> 总{{ formatCurrency(item.total) }}
                  </span>
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                    均{{ formatCurrency(item.average) }}
                  </span>
                  <span v-if="item.count > 1" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700">
                    {{ formatCurrency(item.minSingle) }}~{{ formatCurrency(item.maxSingle) }}
                  </span>
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                    {{ item.topCategory }}
                  </span>
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-violet-50 text-violet-600">
                    {{ item.topMember }}
                  </span>
                  <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-50 text-gray-500">
                    <Calendar :size="10" /> {{ item.latestDate }}
                  </span>
                  <span v-if="item.monthlySpan > 1" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-cyan-50 text-cyan-700">
                    跨{{ item.monthlySpan }}月
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="visibleRemarkInsights.length < filteredRemarkInsights.length" class="mt-3 flex justify-center">
          <button
            type="button"
            @click="loadMoreRemarks"
            class="h-9 px-4 text-sm rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
          >
            加载更多（+20）
          </button>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #f97316 #f3f4f6;
}

.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(to right, #fb7185, #f97316);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to right, #f43f5e, #ea580c);
}
</style>
