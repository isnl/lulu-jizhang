<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Key, Plus, Trash2, Copy, Check, X, Clock, Loader2 } from 'lucide-vue-next'
import { authFetch } from '../utils/auth'
import Modal from './ui/Modal.vue'

const emit = defineEmits<{
    (e: 'error', message: string): void
    (e: 'success', message: string): void
}>()

interface ApiToken {
    id: number
    name: string
    tokenMasked: string
    token?: string  // 只在创建时有完整 token
    last_used_at: string | null
    is_active: number
    created_at: string
}

const tokens = ref<ApiToken[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const newTokenName = ref('')
const creating = ref(false)
const newlyCreatedToken = ref<string | null>(null)
const copied = ref(false)

const loadTokens = async () => {
    loading.value = true
    try {
        const response = await authFetch('/api/auth/tokens')
        const result = await response.json()
        if (result.success) {
            tokens.value = result.data
        } else {
            emit('error', result.error || '加载 Token 列表失败')
        }
    } catch (error) {
        emit('error', '网络错误')
    } finally {
        loading.value = false
    }
}

const createToken = async () => {
    if (!newTokenName.value.trim()) {
        emit('error', '请输入 Token 名称')
        return
    }

    creating.value = true
    try {
        const response = await authFetch('/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTokenName.value.trim() })
        })
        const result = await response.json()
        if (result.success) {
            newlyCreatedToken.value = result.data.token
            await loadTokens()
        } else {
            emit('error', result.error || '创建失败')
        }
    } catch (error) {
        emit('error', '网络错误')
    } finally {
        creating.value = false
    }
}

const deleteToken = async (id: number) => {
    if (!confirm('确定要删除这个 Token 吗？删除后使用该 Token 的设备将无法访问。')) {
        return
    }

    try {
        const response = await authFetch(`/api/auth/tokens/${id}`, {
            method: 'DELETE'
        })
        const result = await response.json()
        if (result.success) {
            emit('success', 'Token 已删除')
            await loadTokens()
        } else {
            emit('error', result.error || '删除失败')
        }
    } catch (error) {
        emit('error', '网络错误')
    }
}

const toggleToken = async (token: ApiToken) => {
    try {
        const response = await authFetch(`/api/auth/tokens/${token.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !token.is_active })
        })
        const result = await response.json()
        if (result.success) {
            emit('success', result.message)
            await loadTokens()
        } else {
            emit('error', result.error || '操作失败')
        }
    } catch (error) {
        emit('error', '网络错误')
    }
}

const copyToken = async () => {
    if (newlyCreatedToken.value) {
        await navigator.clipboard.writeText(newlyCreatedToken.value)
        copied.value = true
        setTimeout(() => {
            copied.value = false
        }, 2000)
    }
}

const closeCreateModal = () => {
    showCreateModal.value = false
    newTokenName.value = ''
    newlyCreatedToken.value = null
    copied.value = false
}

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '从未使用'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
}

onMounted(() => {
    loadTokens()
})
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-emerald-100 rounded-lg">
                    <Key :size="24" class="text-emerald-600" />
                </div>
                <div>
                    <h3 class="font-semibold text-gray-800">API Token 管理</h3>
                    <p class="text-sm text-gray-500">用于快捷指令等外部应用访问</p>
                </div>
            </div>
            <button
                @click="showCreateModal = true"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
                <Plus :size="18" />
                <span>创建 Token</span>
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
            <Loader2 :size="32" class="animate-spin text-emerald-500" />
        </div>

        <!-- Token List -->
        <div v-else-if="tokens.length > 0" class="space-y-3">
            <div
                v-for="token in tokens"
                :key="token.id"
                class="bg-gray-50 rounded-xl p-4 flex items-center justify-between"
                :class="{ 'opacity-50': !token.is_active }"
            >
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-gray-800">{{ token.name }}</span>
                        <span
                            v-if="!token.is_active"
                            class="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded"
                        >
                            已禁用
                        </span>
                    </div>
                    <div class="text-sm text-gray-500 mt-1 font-mono">
                        {{ token.tokenMasked }}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-gray-400 mt-2">
                        <Clock :size="12" />
                        <span>最后使用: {{ formatDate(token.last_used_at) }}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        @click="toggleToken(token)"
                        class="p-2 rounded-lg transition-colors"
                        :class="token.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'"
                        :title="token.is_active ? '禁用' : '启用'"
                    >
                        <X v-if="token.is_active" :size="18" />
                        <Check v-else :size="18" />
                    </button>
                    <button
                        @click="deleteToken(token.id)"
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                    >
                        <Trash2 :size="18" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12 text-gray-500">
            <Key :size="48" class="mx-auto mb-4 opacity-30" />
            <p>还没有创建任何 API Token</p>
            <p class="text-sm mt-1">创建 Token 后可用于快捷指令等外部应用</p>
        </div>

        <!-- Create Modal -->
        <Modal :show="showCreateModal" title="创建 API Token" @close="closeCreateModal">
            <div class="space-y-4">
                <!-- 显示新创建的 Token -->
                <template v-if="newlyCreatedToken">
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div class="flex items-center gap-2 text-emerald-700 mb-2">
                            <Check :size="20" />
                            <span class="font-medium">Token 创建成功</span>
                        </div>
                        <p class="text-sm text-emerald-600 mb-3">
                            请立即复制保存，关闭后将无法再次查看完整 Token
                        </p>
                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                :value="newlyCreatedToken"
                                readonly
                                class="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-lg font-mono text-sm"
                            />
                            <button
                                @click="copyToken"
                                class="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                                <Copy v-if="!copied" :size="16" />
                                <Check v-else :size="16" />
                                <span>{{ copied ? '已复制' : '复制' }}</span>
                            </button>
                        </div>
                    </div>
                    <button
                        @click="closeCreateModal"
                        class="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        关闭
                    </button>
                </template>

                <!-- 创建表单 -->
                <template v-else>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Token 名称
                        </label>
                        <input
                            v-model="newTokenName"
                            type="text"
                            placeholder="例如：iPhone 快捷指令"
                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            :disabled="creating"
                        />
                        <p class="text-xs text-gray-500 mt-2">
                            为 Token 起一个容易识别的名称，方便管理
                        </p>
                    </div>
                    <div class="flex gap-3">
                        <button
                            @click="closeCreateModal"
                            class="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            :disabled="creating"
                        >
                            取消
                        </button>
                        <button
                            @click="createToken"
                            :disabled="creating || !newTokenName.trim()"
                            class="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Loader2 v-if="creating" :size="18" class="animate-spin" />
                            <span>{{ creating ? '创建中...' : '创建' }}</span>
                        </button>
                    </div>
                </template>
            </div>
        </Modal>
    </div>
</template>
