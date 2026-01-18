<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  close: []
}>()

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl'
}

import { watch } from 'vue'

watch(() => props.show, (newVal) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = newVal ? 'hidden' : ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <!-- 背景遮罩 -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <!-- 模态框内容 -->
        <div
          class="relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col"
          :class="sizeClasses[size || 'md']"
          @wheel.stop
          @touchmove.stop
        >
          <!-- 头部 -->
          <div
            v-if="title || $slots.header"
            class="px-6 py-4 b-b-solid b-b-1px b-b-gray-200 flex items-center justify-between bg-gray-50 rounded-t-2xl flex-shrink-0"
          >
            <slot name="header">
              <h3 class="text-lg font-bold text-gray-800">{{ title }}</h3>
            </slot>
            <button
              @click="emit('close')"
              class="p-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X :size="20" class="text-gray-500" />
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-auto p-6">
            <slot></slot>
          </div>

          <!-- 底部 -->
          <div
            v-if="$slots.footer"
            class="px-6 py-4 b-t-solid b-t-1px b-t-gray-200 bg-gray-50 rounded-b-2xl flex-shrink-0"
          >
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
  opacity: 0;
}
</style>
