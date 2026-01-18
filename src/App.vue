<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import RecordForm from './components/RecordForm.vue'
import ImportBill from './components/ImportBill.vue'
import RecordFilter from './components/RecordFilter.vue'
import RecordTable from './components/RecordTable.vue'
import type { RecordData } from './types'

const records = ref<RecordData[]>([])
const loading = ref(false)
const message = ref({ text: '', type: '' })
const sidebarOpen = ref(false)
const isLargeScreen = ref(false)

const checkScreenSize = () => {
  isLargeScreen.value = window.innerWidth >= 1024
  if (isLargeScreen.value) {
    sidebarOpen.value = false
  }
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})

const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = { text: '', type: '' }
  }, 3000)
}

const handleRecordAdded = () => {
  showMessage('记录添加成功', 'success')
}

const handleRecordsLoaded = (data: RecordData[]) => {
  records.value = data
}

const handleError = (error: string) => {
  showMessage(error, 'error')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
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
          <div class="text-xl">
            <span v-if="message.type === 'success'">✓</span>
            <span v-else-if="message.type === 'error'">✕</span>
            <span v-else>ℹ</span>
          </div>
          <p class="font-semibold">{{ message.text }}</p>
        </div>
      </div>
    </Transition>

    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-40">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              💰 AI记账小程序
            </h1>
            <p class="mt-1 text-sm text-gray-600">智能管理您的每一笔收支</p>
          </div>
          
          <!-- Toggle Sidebar Button -->
          <button
            @click="sidebarOpen = !sidebarOpen"
            class="lg:hidden px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            <span>{{ sidebarOpen ? '✕' : '☰' }}</span>
            <span>{{ sidebarOpen ? '关闭' : '操作' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Search Bar - Fixed at top -->
    <div class="sticky top-[88px] z-30 bg-white/95 backdrop-blur-md shadow-md border-b border-gray-200">
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <RecordFilter 
          @records-loaded="handleRecordsLoaded"
          @error="handleError"
          @loading="loading = $event"
        />
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex relative">
      <!-- Sidebar - Collapsible on mobile -->
      <Transition name="slide-sidebar">
        <aside
          v-show="sidebarOpen || isLargeScreen"
          class="fixed lg:sticky top-[180px] left-0 h-[calc(100vh-180px)] w-80 bg-white/95 backdrop-blur-md shadow-xl lg:shadow-none border-r border-gray-200 overflow-y-auto z-30 lg:z-10"
        >
          <div class="p-6 space-y-6">
            <!-- Close button for mobile -->
            <button
              @click="sidebarOpen = false"
              class="lg:hidden absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            
            <RecordForm 
              @record-added="handleRecordAdded"
              @error="handleError"
            />
            
            <ImportBill 
              @records-added="handleRecordAdded"
              @error="handleError"
              @success="(msg) => showMessage(msg, 'success')"
            />
          </div>
        </aside>
      </Transition>

      <!-- Overlay for mobile -->
      <Transition name="fade">
        <div
          v-if="sidebarOpen && !isLargeScreen"
          @click="sidebarOpen = false"
          class="fixed inset-0 bg-black/30 z-20 lg:hidden"
        ></div>
      </Transition>

      <!-- Main Table Area - Full Width -->
      <main class="flex-1 px-4 sm:px-6 lg:px-8 py-8 lg:ml-0">
        <RecordTable 
          :records="records"
          :loading="loading"
        />
      </main>
    </div>

    <!-- Footer -->
    <footer class="mt-8 py-6 text-center text-gray-500 text-sm border-t border-gray-200 bg-white/50">
      <p>© 2024 AI记账小程序 | Powered by Cloudflare Pages & D1</p>
    </footer>
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

.slide-sidebar-enter-active,
.slide-sidebar-leave-active {
  transition: transform 0.3s ease-out;
}

.slide-sidebar-enter-from,
.slide-sidebar-leave-to {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
