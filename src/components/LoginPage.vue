<script setup lang="ts">
import { ref } from 'vue'
import { Wallet, Lock, User, Loader2 } from 'lucide-vue-next'
import { login } from '../utils/auth'

const emit = defineEmits<{
    (e: 'login-success'): void
}>()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleSubmit = async () => {
    if (!username.value || !password.value) {
        error.value = '请输入用户名和密码'
        return
    }

    loading.value = true
    error.value = ''

    const result = await login(username.value, password.value)

    loading.value = false

    if (result.success) {
        emit('login-success')
    } else {
        error.value = result.error || '登录失败'
    }
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div class="w-full max-w-md">
            <!-- Logo -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-lg mb-4">
                    <Wallet :size="32" class="text-white" />
                </div>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    AI记账小程序
                </h1>
                <p class="mt-2 text-gray-600">智能管理您的每一笔收支</p>
            </div>

            <!-- Login Form -->
            <div class="bg-white rounded-2xl shadow-xl p-8">
                <h2 class="text-xl font-semibold text-gray-800 mb-6 text-center">登录账户</h2>

                <form @submit.prevent="handleSubmit" class="space-y-5">
                    <!-- Username -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User :size="18" class="text-gray-400" />
                            </div>
                            <input
                                v-model="username"
                                type="text"
                                placeholder="请输入用户名"
                                class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                :disabled="loading"
                            />
                        </div>
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock :size="18" class="text-gray-400" />
                            </div>
                            <input
                                v-model="password"
                                type="password"
                                placeholder="请输入密码"
                                class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                :disabled="loading"
                            />
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div v-if="error" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                        {{ error }}
                    </div>

                    <!-- Submit Button -->
                    <button
                        type="submit"
                        :disabled="loading"
                        class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Loader2 v-if="loading" :size="20" class="animate-spin" />
                        <span>{{ loading ? '登录中...' : '登 录' }}</span>
                    </button>
                </form>
            </div>

            <!-- Footer -->
            <p class="text-center text-gray-500 text-sm mt-6">
                © 2024 AI记账小程序 | Powered by Cloudflare
            </p>
        </div>
    </div>
</template>
