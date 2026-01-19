<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Users, Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-vue-next'
import type { Member } from '../types'
import Modal from './ui/Modal.vue'

const emit = defineEmits<{
  (e: 'error', msg: string): void
  (e: 'success', msg: string): void
  (e: 'members-changed'): void
}>()

const members = ref<Member[]>([])
const isLoading = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingMember = ref<Member | null>(null)

// 表单数据
const formData = ref({
  name: '',
  wechatNickname: '',
  color: '#3b82f6'
})

// 预设颜色
const presetColors = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

// 加载成员列表
const loadMembers = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/members')
    const result = await response.json()
    if (result.success) {
      members.value = result.data
    } else {
      throw new Error(result.error || '获取成员列表失败')
    }
  } catch (err: any) {
    emit('error', err.message || '获取成员列表失败')
  } finally {
    isLoading.value = false
  }
}

// 打开添加弹窗
const openAddModal = () => {
  formData.value = {
    name: '',
    wechatNickname: '',
    color: presetColors.find(c => !members.value.some(m => m.color === c)) || presetColors[0]
  }
  showAddModal.value = true
}

// 打开编辑弹窗
const openEditModal = (member: Member) => {
  editingMember.value = member
  formData.value = {
    name: member.name,
    wechatNickname: member.wechatNickname || '',
    color: member.color || '#3b82f6'
  }
  showEditModal.value = true
}

// 添加成员
const addMember = async () => {
  if (!formData.value.name.trim()) {
    emit('error', '请输入成员姓名')
    return
  }

  isLoading.value = true
  try {
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.value.name.trim(),
        wechatNickname: formData.value.wechatNickname.trim(),
        color: formData.value.color
      })
    })
    const result = await response.json()
    if (result.success) {
      emit('success', '成员添加成功')
      showAddModal.value = false
      await loadMembers()
      emit('members-changed')
    } else {
      throw new Error(result.error || '添加成员失败')
    }
  } catch (err: any) {
    emit('error', err.message || '添加成员失败')
  } finally {
    isLoading.value = false
  }
}

// 更新成员
const updateMember = async () => {
  if (!editingMember.value) return
  if (!formData.value.name.trim()) {
    emit('error', '请输入成员姓名')
    return
  }

  isLoading.value = true
  try {
    const response = await fetch(`/api/members/${editingMember.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.value.name.trim(),
        wechatNickname: formData.value.wechatNickname.trim(),
        color: formData.value.color
      })
    })
    const result = await response.json()
    if (result.success) {
      emit('success', '成员更新成功')
      showEditModal.value = false
      editingMember.value = null
      await loadMembers()
      emit('members-changed')
    } else {
      throw new Error(result.error || '更新成员失败')
    }
  } catch (err: any) {
    emit('error', err.message || '更新成员失败')
  } finally {
    isLoading.value = false
  }
}

// 删除成员（软删除）
const deleteMember = async (member: Member) => {
  if (!confirm(`确定要禁用成员"${member.name}"吗？禁用后该成员的历史记录仍会保留。`)) {
    return
  }

  isLoading.value = true
  try {
    const response = await fetch(`/api/members/${member.id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    if (result.success) {
      emit('success', '成员已禁用')
      await loadMembers()
      emit('members-changed')
    } else {
      throw new Error(result.error || '禁用成员失败')
    }
  } catch (err: any) {
    emit('error', err.message || '禁用成员失败')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadMembers()
})

// 暴露方法供父组件调用
defineExpose({
  loadMembers
})
</script>

<template>
  <div class="w-full">
    <!-- 标题和添加按钮 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2 text-gray-700">
        <Users :size="20" />
        <span class="font-semibold">家庭成员</span>
      </div>
      <button
        @click="openAddModal"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
      >
        <Plus :size="16" />
        <span>添加成员</span>
      </button>
    </div>

    <!-- 成员列表 -->
    <div v-if="isLoading && members.length === 0" class="flex justify-center py-8">
      <Loader2 :size="24" class="animate-spin text-gray-400" />
    </div>

    <div v-else-if="members.length === 0" class="text-center py-8 text-gray-400">
      <Users :size="48" class="mx-auto mb-2 opacity-50" />
      <p>暂无家庭成员</p>
      <p class="text-sm mt-1">点击上方按钮添加成员</p>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      <div
        v-for="member in members"
        :key="member.id"
        class="relative p-4 bg-white rounded-xl b-solid b-2px shadow-sm hover:shadow-md transition-all group"
        :style="{ borderColor: member.color }"
      >
        <!-- 成员头像/首字母 -->
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-2"
          :style="{ backgroundColor: member.color }"
        >
          {{ member.name.charAt(0) }}
        </div>

        <!-- 成员姓名 -->
        <div class="text-center font-semibold text-gray-800 truncate">
          {{ member.name }}
        </div>

        <!-- 微信昵称 -->
        <div v-if="member.wechatNickname" class="text-center text-xs text-gray-400 truncate mt-1">
          微信: {{ member.wechatNickname }}
        </div>

        <!-- 操作按钮 -->
        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            @click="openEditModal(member)"
            class="p-1.5 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
            title="编辑"
          >
            <Edit2 :size="14" />
          </button>
          <button
            @click="deleteMember(member)"
            class="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
            title="禁用"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 添加成员弹窗 -->
    <Modal :show="showAddModal" title="添加家庭成员" @close="showAddModal = false">
      <div class="space-y-4">
        <!-- 姓名 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            姓名 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            placeholder="用于匹配支付宝/信用卡账单"
            class="w-full px-3 py-2 b-solid b-1px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500"
          />
          <p class="text-xs text-gray-400 mt-1">请输入与支付宝/信用卡账单上一致的姓名</p>
        </div>

        <!-- 微信昵称 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            微信昵称
          </label>
          <input
            v-model="formData.wechatNickname"
            type="text"
            placeholder="用于匹配微信账单（可选）"
            class="w-full px-3 py-2 b-solid b-1px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500"
          />
          <p class="text-xs text-gray-400 mt-1">如需导入微信账单，请填写微信昵称</p>
        </div>

        <!-- 颜色选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            标识颜色
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="formData.color = color"
              class="w-8 h-8 rounded-full b-solid b-2px transition-all"
              :class="formData.color === color ? 'b-gray-800 scale-110' : 'b-transparent'"
              :style="{ backgroundColor: color }"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 rounded-lg b-solid b-1px b-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            @click="addMember"
            :disabled="isLoading"
            class="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="isLoading" :size="16" class="animate-spin" />
            <Save v-else :size="16" />
            <span>保存</span>
          </button>
        </div>
      </template>
    </Modal>

    <!-- 编辑成员弹窗 -->
    <Modal :show="showEditModal" title="编辑家庭成员" @close="showEditModal = false">
      <div class="space-y-4">
        <!-- 姓名 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            姓名 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            placeholder="用于匹配支付宝/信用卡账单"
            class="w-full px-3 py-2 b-solid b-1px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500"
          />
        </div>

        <!-- 微信昵称 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            微信昵称
          </label>
          <input
            v-model="formData.wechatNickname"
            type="text"
            placeholder="用于匹配微信账单（可选）"
            class="w-full px-3 py-2 b-solid b-1px b-gray-300 rounded-lg focus:outline-none focus:b-emerald-500"
          />
        </div>

        <!-- 颜色选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            标识颜色
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="formData.color = color"
              class="w-8 h-8 rounded-full b-solid b-2px transition-all"
              :class="formData.color === color ? 'b-gray-800 scale-110' : 'b-transparent'"
              :style="{ backgroundColor: color }"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showEditModal = false"
            class="px-4 py-2 rounded-lg b-solid b-1px b-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            @click="updateMember"
            :disabled="isLoading"
            class="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 v-if="isLoading" :size="16" class="animate-spin" />
            <Save v-else :size="16" />
            <span>保存</span>
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>
