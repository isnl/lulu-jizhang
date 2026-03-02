<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Search, Plus, Upload, Users } from 'lucide-vue-next'
import MonthPicker from './ui/MonthPicker.vue'
import YearPicker from './ui/YearPicker.vue'
import { apiConfig } from '../config/api'
import { authFetch } from '../utils/auth'
import type { RecordData, Member } from '../types'

type PeriodType = 'year' | 'month'

const props = defineProps<{
  members?: Member[]
}>()

const emit = defineEmits<{
  recordsLoaded: [records: RecordData[]]
  filterChanged: [filter: { startMonth: string, endMonth: string, memberId: string }]
  error: [message: string]
  loading: [isLoading: boolean]
  showRecordForm: []
  showImportForm: []
  showMemberManagement: []
}>()

const periodType = ref<PeriodType>('year')
const selectedYear = ref('')
const startMonth = ref('')
const endMonth = ref('')
const selectedMemberId = ref<string>('all') // 'all' | 'family' | 具体成员ID

const getDateRange = () => {
  if (periodType.value === 'year') {
    if (!/^\d{4}$/.test(selectedYear.value)) {
      return null
    }
    return {
      startMonth: `${selectedYear.value}-01`,
      endMonth: `${selectedYear.value}-12`
    }
  }

  return {
    startMonth: startMonth.value,
    endMonth: endMonth.value
  }
}

onMounted(() => {
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  startMonth.value = currentMonth
  endMonth.value = currentMonth
  selectedYear.value = String(now.getFullYear() - 1)
  loadRecords()
})

watch(selectedMemberId, () => {
  loadRecords()
})

watch(periodType, () => {
  loadRecords()
})

watch(selectedYear, () => {
  if (periodType.value === 'year') {
    loadRecords()
  }
})

const loadRecords = async () => {
  const range = getDateRange()
  if (!range) {
    emit('error', '请选择正确的年份')
    return
  }

  if (!range.startMonth || !range.endMonth) {
    emit('error', periodType.value === 'year' ? '请选择年份' : '请选择开始和结束月份')
    return
  }

  if (periodType.value === 'month' && range.startMonth > range.endMonth) {
    emit('error', '开始月份不能晚于结束月份')
    return
  }

  try {
    emit('loading', true)

    let url = `${apiConfig.endpoints.records}?startMonth=${range.startMonth}&endMonth=${range.endMonth}`
    if (selectedMemberId.value !== 'all') {
      url += `&memberId=${selectedMemberId.value}`
    }

    const response = await authFetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || '获取记录失败')
    }

    emit('recordsLoaded', result)
    emit('filterChanged', {
      startMonth: range.startMonth,
      endMonth: range.endMonth,
      memberId: String(selectedMemberId.value)
    })
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '获取记录时出错')
    emit('recordsLoaded', [])
  } finally {
    emit('loading', false)
  }
}

// 暴露方法供父组件调用
defineExpose({
  loadRecords
})
</script>

<template>
  <div class="w-full">
    <div class="flex items-center gap-3 flex-wrap">
      <form @submit.prevent="loadRecords" class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1 rounded-lg p-1 bg-gray-100">
          <button
            type="button"
            @click="periodType = 'year'"
            class="h-8 px-3 rounded-md text-sm font-medium transition-all"
            :class="periodType === 'year' ? 'bg-white shadow text-emerald-700' : 'text-gray-600 hover:text-gray-800'"
          >
            按年份
          </button>
          <button
            type="button"
            @click="periodType = 'month'"
            class="h-8 px-3 rounded-md text-sm font-medium transition-all"
            :class="periodType === 'month' ? 'bg-white shadow text-emerald-700' : 'text-gray-600 hover:text-gray-800'"
          >
            按月份
          </button>
        </div>

        <template v-if="periodType === 'year'">
          <span class="text-sm font-medium text-gray-600">年份</span>
          <div class="w-[136px] min-w-[136px]">
            <YearPicker v-model="selectedYear" />
          </div>
        </template>

        <template v-else>
          <span class="text-sm font-medium text-gray-600">从</span>
          <div class="w-[136px] min-w-[136px]">
            <MonthPicker v-model="startMonth" />
          </div>
          <span class="text-gray-400">→</span>
          <div class="w-[136px] min-w-[136px]">
            <MonthPicker v-model="endMonth" />
          </div>
        </template>

        <button
          type="submit"
          class="h-9 px-4 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700"
        >
          <Search :size="15" />
          查询
        </button>
      </form>

      <div class="w-px h-6 bg-gray-300"></div>

      <div v-if="props.members && props.members.length > 0" class="flex items-center gap-1.5 flex-wrap">
        <span class="text-sm font-medium text-gray-500">成员:</span>
        <button
          @click="selectedMemberId = 'all'"
          type="button"
          :class="[
            'h-8 px-3 rounded-md text-sm font-medium transition-all',
            selectedMemberId === 'all'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          全部
        </button>
        <button
          @click="selectedMemberId = 'family'"
          type="button"
          :class="[
            'h-8 px-3 rounded-md text-sm font-medium transition-all',
            selectedMemberId === 'family'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          家庭
        </button>
        <button
          v-for="member in props.members.filter(m => m.isActive)"
          :key="member.id"
          @click="selectedMemberId = String(member.id)"
          type="button"
          :class="[
            'h-8 px-3 rounded-md text-sm font-medium transition-all',
            selectedMemberId === String(member.id)
              ? 'text-white'
              : 'hover:opacity-80'
          ]"
          :style="{
            backgroundColor: selectedMemberId === String(member.id) ? (member.color || '#64748b') : '#f3f4f6',
            color: selectedMemberId === String(member.id) ? 'white' : (member.color || '#475569')
          }"
        >
          {{ member.name }}
        </button>
      </div>

      <div class="w-px h-6 bg-gray-300"></div>

      <div class="flex gap-2">
        <button
          @click="emit('showMemberManagement')"
          type="button"
          class="h-9 px-3 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm bg-white border border-violet-500 text-violet-700 hover:bg-violet-50"
        >
          <Users :size="14" />
          成员
        </button>

        <button
          @click="emit('showRecordForm')"
          type="button"
          class="h-9 px-3 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
        >
          <Plus :size="14" />
          记一笔
        </button>

        <button
          @click="emit('showImportForm')"
          type="button"
          class="h-9 px-3 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm bg-white border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
        >
          <Upload :size="14" />
          导入
        </button>
      </div>
    </div>
  </div>
</template>
