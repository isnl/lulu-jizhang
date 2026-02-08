<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Search, Plus, Upload, Users } from 'lucide-vue-next'
import MonthPicker from './ui/MonthPicker.vue'
import { apiConfig } from '../config/api'
import { authFetch } from '../utils/auth'
import type { RecordData, Member } from '../types'

const props = defineProps<{
  members?: Member[]
}>()

const emit = defineEmits<{
  recordsLoaded: [records: RecordData[]]
  error: [message: string]
  loading: [isLoading: boolean]
  showRecordForm: []
  showImportForm: []
  showMemberManagement: []
}>()

const startMonth = ref('')
const endMonth = ref('')
const selectedMemberId = ref<string>('all')  // 'all' | 'family' | 具体成员ID

onMounted(() => {
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  startMonth.value = currentMonth
  endMonth.value = currentMonth
  loadRecords()
})

// 成员变化时重新加载数据
watch(selectedMemberId, () => {
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

    let url = `${apiConfig.endpoints.records}?startMonth=${startMonth.value}&endMonth=${endMonth.value}`
    if (selectedMemberId.value !== 'all') {
      url += `&memberId=${selectedMemberId.value}`
    }

    const response = await authFetch(url)
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

// 暴露方法供父组件调用
defineExpose({
  loadRecords
})
</script>

<template>
  <div class="w-full">
    <!-- 单行紧凑布局 -->
    <div class="flex items-center gap-3 flex-wrap">
      <!-- 日期筛选 -->
      <form @submit.prevent="loadRecords" class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-gray-600">从</span>
        <div class="w-32">
          <MonthPicker v-model="startMonth" />
        </div>
        <span class="text-gray-400">→</span>
        <div class="w-32">
          <MonthPicker v-model="endMonth" />
        </div>
        <button
          type="submit"
          class="ml-1 px-3 py-1 font-medium rounded-md active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1 text-xs"
          style="background: linear-gradient(to right, #3b82f6, #2563eb) !important; color: white !important;"
        >
          <Search :size="14" style="color: white !important;" />
          <span style="color: white !important;">查询</span>
        </button>
      </form>

      <!-- 分隔线 -->
      <div class="w-px h-5 bg-gray-300"></div>

      <!-- 成员筛选 -->
      <div v-if="props.members && props.members.length > 0" class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-gray-500">成员:</span>
        <button
          @click="selectedMemberId = 'all'"
          :class="[
            'px-2 py-0.5 rounded text-xs font-medium transition-all',
            selectedMemberId === 'all'
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          全部
        </button>
        <button
          @click="selectedMemberId = 'family'"
          :class="[
            'px-2 py-0.5 rounded text-xs font-medium transition-all',
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
          :class="[
            'px-2 py-0.5 rounded text-xs font-medium transition-all',
            selectedMemberId === String(member.id)
              ? 'text-white'
              : 'hover:opacity-80'
          ]"
          :style="{
            backgroundColor: selectedMemberId === String(member.id) ? member.color : '#f3f4f6',
            color: selectedMemberId === String(member.id) ? 'white' : member.color
          }"
        >
          {{ member.name }}
        </button>
      </div>

      <!-- 分隔线 -->
      <div class="w-px h-5 bg-gray-300"></div>

      <!-- 操作按钮 -->
      <div class="flex gap-1.5">
        <button
          @click="emit('showMemberManagement')"
          type="button"
          class="px-2 py-1 font-medium rounded active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1 text-xs"
          style="background: white !important; border: 1px solid #8b5cf6 !important; color: #7c3aed !important;"
        >
          <Users :size="12" style="color: #7c3aed !important;" />
          <span style="color: #7c3aed !important;">成员</span>
        </button>

        <button
          @click="emit('showRecordForm')"
          type="button"
          class="px-2 py-1 font-medium rounded active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1 text-xs"
          style="background: linear-gradient(to right, #10b981, #14b8a6) !important; color: white !important;"
        >
          <Plus :size="12" style="color: white !important;" />
          <span style="color: white !important;">记一笔</span>
        </button>

        <button
          @click="emit('showImportForm')"
          type="button"
          class="px-2 py-1 font-medium rounded active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-1 text-xs"
          style="background: white !important; border: 1px solid #10b981 !important; color: #059669 !important;"
        >
          <Upload :size="12" style="color: #059669 !important;" />
          <span style="color: #059669 !important;">导入</span>
        </button>
      </div>
    </div>
  </div>
</template>
