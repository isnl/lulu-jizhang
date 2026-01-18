<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, Plus, Upload } from 'lucide-vue-next'
import MonthPicker from './ui/MonthPicker.vue'
import { apiConfig } from '../config/api'
import type { RecordData } from '../types'

const emit = defineEmits<{
  recordsLoaded: [records: RecordData[]]
  error: [message: string]
  loading: [isLoading: boolean]
  showRecordForm: []
  showImportForm: []
}>()

const startMonth = ref('')
const endMonth = ref('')

onMounted(() => {
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  startMonth.value = currentMonth
  endMonth.value = currentMonth
  loadRecords()
})

const loadRecords = async () => {
  if (!startMonth.value || !endMonth.value) {
    emit('error', '请选择开始和结束月份')
    return
  }

  if (startMonth.value > endMonth.value) {
    emit('error', '开始月份不能晚于结束月份')
    return
  }

  try {
    emit('loading', true)

    const url = `${apiConfig.endpoints.records}?startMonth=${startMonth.value}&endMonth=${endMonth.value}`
    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || '获取记录失败')
    }

    emit('recordsLoaded', result)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '获取记录时出错')
    emit('recordsLoaded', [])
  } finally {
    emit('loading', false)
  }
}
</script>

<template>
  <div class="w-full">
    <div class="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center">
      
      <!-- Left: Filter Form -->
      <form @submit.prevent="loadRecords" class="flex-1 rounded-lg  p-1 flex items-center gap-2 overflow-visible">

        <!-- Start Month -->
        <div class="flex items-center gap-1.5 pl-2 flex-shrink-0">
          <span class="text-xs font-medium text-gray-600">从</span>
          <div class="w-40">
            <MonthPicker v-model="startMonth" />
          </div>
        </div>

        <!-- Arrow / Separator -->
        <div class="text-gray-300 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
        </div>

        <!-- End Month -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="text-xs font-medium text-gray-600">到</span>
          <div class="w-40">
            <MonthPicker v-model="endMonth" />
          </div>
        </div>

        <!-- Divider -->
        <div class="w-px h-5 bg-gray-200 mx-1 flex-shrink-0"></div>

        <!-- Search Button -->
        <button
          type="submit"
          class="flex-shrink-0 px-4 py-1.5 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
          style="background: linear-gradient(to right, #3b82f6, #2563eb) !important; color: white !important;"
        >
          <Search :size="16" style="color: white !important;" />
          <span style="color: white !important;">查询</span>
        </button>
      </form>

      <!-- Right: Action Buttons -->
      <div class="flex gap-2 flex-shrink-0">
        <button
          @click="emit('showRecordForm')"
          type="button"
          class="px-3 py-1.5 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm"
          style="background: linear-gradient(to right, #10b981, #14b8a6) !important; color: white !important;"
        >
          <Plus :size="14" style="color: white !important;" />
          <span style="color: white !important;">记一笔</span>
        </button>

        <button
          @click="emit('showImportForm')"
          type="button"
          class="px-3 py-1.5 font-medium rounded-lg active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 text-sm"
          style="background: white !important; border: 2px solid #10b981 !important; color: #059669 !important;"
        >
          <Upload :size="14" style="color: #059669 !important;" />
          <span style="color: #059669 !important;">导入账单</span>
        </button>
      </div>
    </div>
  </div>
</template>
