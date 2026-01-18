<script setup lang="ts">
import { ref, computed } from 'vue'
import { PlusCircle, DollarSign, Calendar as CalendarIcon, FileText } from 'lucide-vue-next'
import CustomSelect from './ui/CustomSelect.vue'
import { apiConfig } from '../config/api'
import { RECORD_TYPES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'

const emit = defineEmits<{
  recordAdded: []
  error: [message: string]
}>()

const formData = ref({
  type: '支出' as '支出' | '收入',
  category: '生活费',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  remark: ''
})

// 根据类型动态显示分类
const availableCategories = computed(() => {
  return formData.value.type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
})

// 当类型改变时,重置分类为第一个选项
const handleTypeChange = (newType: string) => {
  formData.value.type = newType as '支出' | '收入'
  const categories = formData.value.type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  formData.value.category = categories[0]
}

const loading = ref(false)

const handleSubmit = async () => {
  // Validation
  if (!formData.value.type || !formData.value.category || !formData.value.amount || !formData.value.date) {
    emit('error', '请填写所有必填字段')
    return
  }

  const amount = parseFloat(formData.value.amount)
  if (isNaN(amount) || amount <= 0) {
    emit('error', '金额必须大于0')
    return
  }

  try {
    loading.value = true

    const response = await fetch(apiConfig.endpoints.records, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...formData.value,
        amount
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || '添加记录失败')
    }

    // Reset form
    formData.value = {
      type: '支出',
      category: '生活费',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      remark: ''
    }

    emit('recordAdded')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '添加记录时出错')
  } finally {
    loading.value = false
  }
}
</script>

<template>

  <div class="w-full">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block mb-2 font-semibold text-gray-700 text-sm">类型</label>
        <CustomSelect
          :model-value="formData.type"
          :options="RECORD_TYPES"
          @update:model-value="handleTypeChange"
        />
      </div>

      <div>
        <label class="block mb-2 font-semibold text-gray-700 text-sm">分类</label>
        <CustomSelect
          v-model="formData.category"
          :options="availableCategories"
        />
      </div>

      <div>
        <label class="block mb-2 font-semibold text-gray-700 text-sm flex items-center gap-2">
          <DollarSign :size="16" class="text-emerald-600" />
          金额
        </label>
        <input
          v-model="formData.amount"
          type="number"
          step="0.01"
          min="0"
          class="w-full px-4 py-2.5 bg-white b-solid b-2px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
          placeholder="请输入金额"
          required
        />
      </div>

      <div>
        <label class="block mb-2 font-semibold text-gray-700 text-sm flex items-center gap-2">
          <CalendarIcon :size="16" class="text-emerald-600" />
          日期
        </label>
        <input
          v-model="formData.date"
          type="date"
          class="w-full px-4 py-2.5 bg-white b-solid b-2px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
          required
        />
      </div>

      <div>
        <label class="block mb-2 font-semibold text-gray-700 text-sm flex items-center gap-2">
          <FileText :size="16" class="text-emerald-600" />
          备注
        </label>
        <textarea
          v-model="formData.remark"
          class="w-full px-4 py-2.5 bg-white b-solid b-2px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all resize-none"
          rows="3"
          placeholder="添加备注信息(可选)"
        />
      </div>

      <button
        type="submit"
        class="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        :disabled="loading"
      >
        <PlusCircle :size="18" v-if="!loading" />
        <span v-if="loading">添加中...</span>
        <span v-else>添加记录</span>
      </button>
    </form>
  </div>
</template>

