<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiConfig } from '../config/api'
import type { RecordData } from '../types'

const emit = defineEmits<{
  recordsLoaded: [records: RecordData[]]
  error: [message: string]
  loading: [isLoading: boolean]
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
    <form @submit.prevent="loadRecords" class="flex flex-wrap items-end gap-4">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span class="text-lg">📅</span>
          开始月份
        </label>
        <input
          v-model="startMonth"
          type="month"
          class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
          required
        />
      </div>

      <div class="flex-1 min-w-[200px]">
        <label class="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span class="text-lg">📅</span>
          结束月份
        </label>
        <input
          v-model="endMonth"
          type="month"
          class="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
          required
        />
      </div>

      <button 
        type="submit" 
        class="px-8 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
      >
        <span class="text-lg">🔍</span>
        查询记录
      </button>
    </form>
  </div>
</template>
