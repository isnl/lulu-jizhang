<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Wallet, CheckCircle, XCircle, Info, LogOut, Key } from 'lucide-vue-next'
import LoginPage from './components/LoginPage.vue'
import RecordForm from './components/RecordForm.vue'
import ImportBill from './components/ImportBill.vue'
import RecordFilter from './components/RecordFilter.vue'
import RecordTable from './components/RecordTable.vue'
import MemberManagement from './components/MemberManagement.vue'
import ApiTokenManagement from './components/ApiTokenManagement.vue'
import Modal from './components/ui/Modal.vue'
import type { RecordData, Member } from './types'
import { isAuthenticated, checkAuth, logout, currentUser, authFetch } from './utils/auth'

const records = ref<RecordData[]>([])
const members = ref<Member[]>([])
const loading = ref(false)
const authChecking = ref(true)
const message = ref({ text: '', type: '' })
const showRecordModal = ref(false)
const showImportModal = ref(false)
const showMemberModal = ref(false)
const showApiTokenModal = ref(false)

// 组件引用
const recordFilterRef = ref<InstanceType<typeof RecordFilter> | null>(null)

// 加载成员列表
const loadMembers = async () => {
  try {
    const response = await authFetch('/api/members')
    const result = await response.json()
    if (result.success) {
      members.value = result.data
    }
  } catch (error) {
    console.error('加载成员列表失败:', error)
  }
}

// 成员变化时重新加载
const handleMembersChanged = () => {
  loadMembers()
}

// 检查认证状态
onMounted(async () => {
  authChecking.value = true
  await checkAuth()
  authChecking.value = false

  if (isAuthenticated.value) {
    loadMembers()
  }

  // 监听需要重新登录的事件
  window.addEventListener('auth:required', () => {
    showMessage('登录已过期，请重新登录', 'error')
  })
})

const handleLoginSuccess = () => {
  loadMembers()
}

const handleLogout = () => {
  logout()
  records.value = []
  members.value = []
}

const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = { text: '', type: '' }
  }, 3000)
}

const handleRecordAdded = () => {
  showMessage('记录添加成功', 'success')
  recordFilterRef.value?.loadRecords()
}

const handleRecordsLoaded = (data: RecordData[]) => {
  records.value = data
}

const handleError = (error: string) => {
  showMessage(error, 'error')
}

const handleSuccess = (msg: string) => {
  showMessage(msg, 'success')
}
</script>

<template>
  <!-- Loading -->
  <div v-if="authChecking" class="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
    <div class="text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-lg mb-4 animate-pulse">
        <Wallet :size="32" class="text-white" />
      </div>
      <p class="text-gray-600">加载中...</p>
    </div>
  </div>

  <!-- Login Page -->
  <LoginPage v-else-if="!isAuthenticated" @login-success="handleLoginSuccess" />

  <!-- Main App -->
  <div v-else class="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
    <!-- Message Toast -->
    <Transition name="slide-fade">
      <div
        v-if="message.text"
        class="fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-sm"
        :class="{
          'bg-emerald-500/90 text-white': message.type === 'success',
          'bg-red-500/90 text-white': message.type === 'error',
          'bg-blue-500/90 text-white': message.type === 'info'
        }"
      >
        <div class="flex items-center gap-3">
          <CheckCircle v-if="message.type === 'success'" :size="20" />
          <XCircle v-else-if="message.type === 'error'" :size="20" />
          <Info v-else :size="20" />
          <p class="font-semibold">{{ message.text }}</p>
        </div>
      </div>
    </Transition>

    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-40">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Wallet :size="32" class="text-emerald-600" />
            <div>
              <h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                AI记账小程序
              </h1>
              <p class="mt-1 text-sm text-gray-600">智能管理您的每一笔收支</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="showApiTokenModal = true"
              class="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="API Token 管理"
            >
              <Key :size="18" />
              <span class="hidden sm:inline">API Token</span>
            </button>
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
              <span class="text-sm text-gray-600">{{ currentUser?.username }}</span>
            </div>
            <button
              @click="handleLogout"
              class="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="退出登录"
            >
              <LogOut :size="18" />
              <span class="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Filter Bar - Fixed at top -->
    <div class="sticky top-[88px] z-30 bg-white/95 backdrop-blur-md shadow-md b-b-solid b-b-1px b-b-gray-200">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <RecordFilter
          ref="recordFilterRef"
          :members="members"
          @records-loaded="handleRecordsLoaded"
          @error="handleError"
          @loading="loading = $event"
          @show-record-form="showRecordModal = true"
          @show-import-form="showImportModal = true"
          @show-member-management="showMemberModal = true"
        />
      </div>
    </div>

    <!-- Main Content -->
    <main class="px-4 sm:px-6 lg:px-8 py-8">
      <RecordTable
        :records="records"
        :loading="loading"
      />
    </main>

    <!-- Footer -->
    <footer class="mt-8 py-6 text-center text-gray-500 text-sm b-t-solid b-t-1px b-t-gray-200 bg-white/50">
      <p>© 2024 AI记账小程序 | Powered by Cloudflare Pages & D1</p>
    </footer>

    <!-- Modals -->
    <Modal
      :show="showRecordModal"
      title="添加记录"
      @close="showRecordModal = false"
    >
      <RecordForm
        @record-added="() => { handleRecordAdded(); showRecordModal = false }"
        @error="handleError"
      />
    </Modal>

    <Modal
      :show="showImportModal"
      title="账单导入"
      size="lg"
      @close="showImportModal = false"
    >
      <ImportBill
        :members="members"
        @records-added="() => { handleRecordAdded(); showImportModal = false }"
        @error="handleError"
        @success="handleSuccess"
      />
    </Modal>

    <Modal
      :show="showMemberModal"
      title="家庭成员管理"
      size="lg"
      @close="showMemberModal = false"
    >
      <MemberManagement
        @members-changed="handleMembersChanged"
        @error="handleError"
        @success="handleSuccess"
      />
    </Modal>

    <Modal
      :show="showApiTokenModal"
      title="API Token 管理"
      size="lg"
      @close="showApiTokenModal = false"
    >
      <ApiTokenManagement
        @error="handleError"
        @success="handleSuccess"
      />
    </Modal>
  </div>
</template>

<style>
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
