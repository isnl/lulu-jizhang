<script setup lang="ts">
import { ref, computed } from 'vue'
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

// 当类型改变时，重置分类为第一个选项
const handleTypeChange = () => {
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
  <div class="card">
    <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
      <span class="text-3xl">📝</span>
      添加记录
    </h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="form-group">
        <label class="label">类型</label>
        <select v-model="formData.type" @change="handleTypeChange" class="input-base">
          <option v-for="type in RECORD_TYPES" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="label">分类</label>
        <select v-model="formData.category" class="input-base">
          <option v-for="category in availableCategories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="label">金额</label>
        <input
          v-model="formData.amount"
          type="number"
          step="0.01"
          min="0"
          class="input-base"
          placeholder="请输入金额"
          required
        />
      </div>

      <div class="form-group">
        <label class="label">日期</label>
        <input
          v-model="formData.date"
          type="date"
          class="input-base"
          required
        />
      </div>

      <div class="form-group">
        <label class="label">备注</label>
        <textarea
          v-model="formData.remark"
          class="input-base resize-none"
          rows="3"
          placeholder="添加备注信息（可选）"
        />
      </div>

      <button
        type="submit"
        class="btn-primary w-full"
        :disabled="loading"
      >
        <span v-if="loading">添加中...</span>
        <span v-else>✓ 添加记录</span>
      </button>
    </form>
  </div>
</template>
