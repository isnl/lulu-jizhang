<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus, Trash2, Edit2, Tag } from 'lucide-vue-next'
import { authFetch } from '../utils/auth'
import type { CategoryKeyword } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'

const props = defineProps<{
    onClose?: () => void
}>()

const emit = defineEmits<{
    (e: 'success', msg: string): void
    (e: 'error', msg: string): void
}>()

const keywordsList = ref<CategoryKeyword[]>([])
const loading = ref(false)
const showAddForm = ref(false)

// Edit state
const editingId = ref<number | null>(null)

// Form state
const initialFormState = {
    category: '',
    type: '支出' as '支出' | '收入',
    keywordsInput: ''
}
const formData = ref({ ...initialFormState })

const availableCategories = computed(() => {
    return formData.value.type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
})

const loadKeywords = async () => {
    loading.value = true
    try {
        const response = await authFetch('/api/category-keywords')
        if (!response.ok) throw new Error('网络请求失败')
        const result = await response.json()
        if (result.success) {
            keywordsList.value = result.data
        } else {
            throw new Error(result.error || '获取数据失败')
        }
    } catch (error: any) {
        emit('error', error.message || '获取分类关键字失败')
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadKeywords()
})

const parseKeywords = (input: string) => {
    return input.split(/[,，;\s]+/).filter(k => k.trim() !== '')
}

const handleAdd = () => {
    showAddForm.value = true
    editingId.value = null
    formData.value = { ...initialFormState }
}

const handleEdit = (item: CategoryKeyword) => {
    showAddForm.value = true
    editingId.value = item.id
    formData.value = {
        category: item.category,
        type: item.type,
        keywordsInput: item.keywords.join(', ')
    }
}

const handleCancel = () => {
    showAddForm.value = false
    editingId.value = null
}

const handleSave = async () => {
    if (!formData.value.category) {
        emit('error', '请选择分类')
        return
    }

    const keywords = parseKeywords(formData.value.keywordsInput)
    if (keywords.length === 0) {
        emit('error', '请输入至少一个关键字')
        return
    }

    loading.value = true
    try {
        const url = editingId.value
            ? `/api/category-keywords/${editingId.value}`
            : '/api/category-keywords'
        const method = editingId.value ? 'PUT' : 'POST'

        const response = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: formData.value.category,
                type: formData.value.type,
                keywords
            })
        })

        if (!response.ok) throw new Error('网络请求失败')
        const result = await response.json()

        if (result.success) {
            emit('success', editingId.value ? '修改成功' : '添加成功')
            showAddForm.value = false
            loadKeywords()
        } else {
            throw new Error(result.error || '操作失败')
        }
    } catch (error: any) {
        emit('error', error.message || '保存失败')
    } finally {
        loading.value = false
    }
}

const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此分类的所有关联关键字吗？')) return

    loading.value = true
    try {
        const response = await authFetch(`/api/category-keywords/${id}`, {
            method: 'DELETE'
        })
        if (!response.ok) throw new Error('网络请求失败')
        const result = await response.json()

        if (result.success) {
            emit('success', '删除成功')
            loadKeywords()
        } else {
            throw new Error(result.error || '删除失败')
        }
    } catch (error: any) {
        emit('error', error.message || '删除失败')
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="px-4 py-4 max-h-[70vh] overflow-y-auto">
        <div v-if="loading && keywordsList.length === 0" class="flex justify-center p-8">
            <Loader2 class="w-8 h-8 animate-spin text-emerald-500" />
        </div>

        <div v-else>
            <!-- Header actions -->
            <div class="flex justify-between items-center mb-6">
                <p class="text-sm text-gray-500">配置账单导入和智能识别时的分类匹配规则</p>
                <button v-if="!showAddForm" @click="handleAdd"
                    class="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm">
                    <Plus class="w-4 h-4" />
                    添加规则
                </button>
            </div>

            <!-- Form -->
            <div v-if="showAddForm" class="bg-gray-50 p-4 rounded-xl mb-6 border b-solid b-gray-200">
                <h3 class="font-medium text-gray-700 mb-4">{{ editingId ? '编辑规则' : '添加规则' }}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">交易类型</label>
                        <select v-model="formData.type" class="w-full px-3 py-2 border b-solid b-gray-300 rounded-lg focus:outline-none focus:ring-2 bg-white">
                            <option value="支出">支出</option>
                            <option value="收入">收入</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">系统分类</label>
                        <select v-model="formData.category" class="w-full px-3 py-2 border b-solid b-gray-300 rounded-lg focus:outline-none focus:ring-2 bg-white">
                            <option value="">请选择分类</option>
                            <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">匹配关键字集</label>
                    <textarea v-model="formData.keywordsInput" rows="3"
                        class="w-full px-3 py-2 border b-solid b-gray-300 rounded-lg focus:outline-none focus:ring-2 resize-none"
                        placeholder="使用逗号或空格分隔多个关键字，如：美团 饿了么 外卖"></textarea>
                </div>
                <div class="flex justify-end gap-3 mt-4">
                    <button @click="handleCancel" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                        取消
                    </button>
                    <button @click="handleSave" :disabled="loading"
                        class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50">
                        {{ loading ? '保存中...' : '保存' }}
                    </button>
                </div>
            </div>

            <!-- List -->
            <div class="space-y-4">
                <div v-for="item in keywordsList" :key="item.id"
                    class="bg-white p-4 rounded-xl border b-solid b-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">{{ item.type }}</span>
                            <span class="font-bold text-gray-800">{{ item.category }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button @click="handleEdit(item)"
                                class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                                <Edit2 class="w-4 h-4" />
                            </button>
                            <button @click="handleDelete(item.id)"
                                class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <span v-for="keyword in item.keywords" :key="keyword"
                            class="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-sm">
                            <Tag class="w-3 h-3" />
                            {{ keyword }}
                        </span>
                    </div>
                </div>
                
                <div v-if="keywordsList.length === 0 && !showAddForm" class="text-center py-8 text-gray-500">
                    暂未配置分类规则
                </div>
            </div>
        </div>
    </div>
</template>
