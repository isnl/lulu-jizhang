<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string // YYYY-MM format
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

// 解析传入的值
watch(() => props.modelValue, (val) => {
  if (val) {
    const [year, month] = val.split('-')
    currentYear.value = parseInt(year)
    currentMonth.value = parseInt(month)
  }
}, { immediate: true })

const displayValue = computed(() => {
  if (!props.modelValue) return '请选择月份'
  const [year, month] = props.modelValue.split('-')
  return `${year}年${parseInt(month)}月`
})

const months = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
]

const selectMonth = (month: number) => {
  currentMonth.value = month
  const value = `${currentYear.value}-${String(month).padStart(2, '0')}`
  emit('update:modelValue', value)
  isOpen.value = false
}

// 判断是否是当前月份
const isCurrentMonth = (month: number, year: number) => {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === month
}

// 判断是否是选中的月份
const isSelectedMonth = (month: number) => {
  if (!props.modelValue) return false
  const [year, monthStr] = props.modelValue.split('-')
  return parseInt(year) === currentYear.value && parseInt(monthStr) === month
}

const prevYear = () => {
  currentYear.value--
}

const nextYear = () => {
  currentYear.value++
}

const selectQuickDate = (type: 'current' | 'last' | 'next') => {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  
  if (type === 'last') {
    month--
    if (month === 0) {
      month = 12
      year--
    }
  } else if (type === 'next') {
    month++
    if (month === 13) {
      month = 1
      year++
    }
  }
  
  currentYear.value = year
  currentMonth.value = month
  const value = `${year}-${String(month).padStart(2, '0')}`
  emit('update:modelValue', value)
  isOpen.value = false
}
</script>

<template>
  <div class="relative w-full">
    <!-- 触发按钮 -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="w-full px-3 py-1.5 bg-white b-solid b-1px b-gray-300 rounded-lg flex items-center justify-between transition-all hover:b-emerald-400 focus:outline-none focus:b-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm"
    >
      <span class="text-gray-700 text-sm">{{ displayValue }}</span>
      <ChevronDown
        :size="16"
        class="text-gray-400 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-[100] mt-1 min-w-[280px] bg-white rounded-lg shadow-2xl b-solid b-1px b-gray-200 overflow-hidden left-0"
        @wheel.stop
        @touchmove.stop
      >
        <!-- 快捷选择 -->
        <div class="p-2 bg-gray-50 b-b-solid b-b-1px b-b-gray-200">
          <div class="flex gap-1.5">
            <button
              type="button"
              @click="selectQuickDate('last')"
              class="flex-1 px-2 py-1 text-xs rounded transition-colors b-solid b-1px b-gray-200"
              style="background: white !important; color: #374151 !important;"
              @mouseenter="$event.target.style.background = '#ecfdf5'; $event.target.style.color = '#059669'"
              @mouseleave="$event.target.style.background = 'white'; $event.target.style.color = '#374151'"
            >
              上个月
            </button>
            <button
              type="button"
              @click="selectQuickDate('current')"
              class="flex-1 px-2 py-1 text-xs rounded transition-colors b-solid b-1px b-gray-200"
              style="background: white !important; color: #374151 !important;"
              @mouseenter="$event.target.style.background = '#ecfdf5'; $event.target.style.color = '#059669'"
              @mouseleave="$event.target.style.background = 'white'; $event.target.style.color = '#374151'"
            >
              本月
            </button>
            <button
              type="button"
              @click="selectQuickDate('next')"
              class="flex-1 px-2 py-1 text-xs rounded transition-colors b-solid b-1px b-gray-200"
              style="background: white !important; color: #374151 !important;"
              @mouseenter="$event.target.style.background = '#ecfdf5'; $event.target.style.color = '#059669'"
              @mouseleave="$event.target.style.background = 'white'; $event.target.style.color = '#374151'"
            >
              下个月
            </button>
          </div>
        </div>

        <!-- 年份选择 -->
        <div class="flex items-center justify-between px-3 py-2 bg-white b-b-solid b-b-1px b-b-gray-200">
          <button
            type="button"
            @click="prevYear"
            class="p-1 rounded transition-colors"
            style="background: transparent !important;"
            @mouseenter="$event.target.style.background = '#f3f4f6'"
            @mouseleave="$event.target.style.background = 'transparent'"
          >
            <ChevronLeft :size="18" class="text-gray-600" />
          </button>
          <span class="text-base font-semibold text-gray-800">{{ currentYear }}年</span>
          <button
            type="button"
            @click="nextYear"
            class="p-1 rounded transition-colors"
            style="background: transparent !important;"
            @mouseenter="$event.target.style.background = '#f3f4f6'"
            @mouseleave="$event.target.style.background = 'transparent'"
          >
            <ChevronRight :size="18" class="text-gray-600" />
          </button>
        </div>

        <!-- 月份网格 -->
        <div class="p-3 grid grid-cols-3 gap-1.5">
          <button
            v-for="month in months"
            :key="month.value"
            type="button"
            @click="selectMonth(month.value)"
            class="relative px-3 py-2 rounded-lg text-sm font-medium transition-all"
            :style="isSelectedMonth(month.value)
              ? 'background: #10b981 !important; color: white !important;'
              : 'background: #f9fafb !important; color: #374151 !important;'"
            @mouseenter="!isSelectedMonth(month.value) && ($event.target.style.background = '#ecfdf5', $event.target.style.color = '#059669')"
            @mouseleave="!isSelectedMonth(month.value) && ($event.target.style.background = '#f9fafb', $event.target.style.color = '#374151')"
          >
            {{ month.label }}
            <!-- 当月标记点 -->
            <span
              v-if="isCurrentMonth(month.value, currentYear)"
              class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
              :style="isSelectedMonth(month.value) ? 'background: white !important;' : 'background: #10b981 !important;'"
            ></span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 点击外部关闭 -->
    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-[99]"
    ></div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
