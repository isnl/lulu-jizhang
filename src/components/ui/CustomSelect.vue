<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  options: readonly string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const searchQuery = ref('')

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  return props.options.filter(option =>
    option.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const selectOption = (option: string) => {
  emit('update:modelValue', option)
  isOpen.value = false
  searchQuery.value = ''
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (!isOpen.value) {
    searchQuery.value = ''
  }
}
</script>

<template>
  <div class="relative w-full">
    <!-- 触发按钮 -->
    <button
      type="button"
      @click="toggleDropdown"
      class="w-full px-4 py-2.5 bg-white b-solid b-2px b-gray-300 rounded-lg flex items-center justify-between transition-all hover:b-emerald-400 focus:outline-none focus:b-emerald-500 focus:ring-2 focus:ring-emerald-200"
    >
      <span class="text-gray-700 truncate">{{ modelValue || placeholder || '请选择' }}</span>
      <ChevronDown 
        :size="20" 
        class="text-gray-400 transition-transform flex-shrink-0 ml-2"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-[9999] mt-2 w-full bg-white rounded-xl shadow-2xl b-solid b-1px b-gray-200 overflow-hidden max-h-80 flex flex-col"
        @wheel.stop
        @touchmove.stop
      >
        <!-- 搜索框 -->
        <div class="p-3 b-b-solid b-b-1px b-b-gray-200">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索..."
            class="w-full px-3 py-2 bg-gray-50 b-solid b-1px b-gray-200 rounded-lg text-sm focus:outline-none focus:b-emerald-500 focus:ring-2 focus:ring-emerald-200"
            @click.stop
          />
        </div>

        <!-- 选项列表 -->
        <div class="overflow-y-auto flex-1" @wheel.stop @touchmove.stop>
          <button
            v-for="option in filteredOptions"
            :key="option"
            type="button"
            @click="selectOption(option)"
            class="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-emerald-50 transition-colors"
            :class="modelValue === option ? 'bg-emerald-50 text-emerald-600' : 'text-gray-700'"
          >
            <span class="font-medium">{{ option }}</span>
            <Check
              v-if="modelValue === option"
              :size="18"
              class="text-emerald-600 flex-shrink-0"
            />
          </button>

          <!-- 无结果 -->
          <div
            v-if="filteredOptions.length === 0"
            class="px-4 py-8 text-center text-gray-400"
          >
            无匹配结果
          </div>
        </div>
      </div>
    </Transition>

    <!-- 点击外部关闭 -->
    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-[9998]"
    ></div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
