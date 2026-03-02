<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string // YYYY
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const centerYear = ref(new Date().getFullYear())

const parsedYear = computed(() => {
  const year = parseInt(props.modelValue, 10)
  return Number.isNaN(year) ? new Date().getFullYear() : year
})

watch(parsedYear, (value) => {
  centerYear.value = value
}, { immediate: true })

const years = computed(() => {
  const result: number[] = []
  for (let i = centerYear.value + 5; i >= centerYear.value - 6; i--) {
    result.push(i)
  }
  return result
})

const displayValue = computed(() => `${parsedYear.value}年`)

const selectYear = (year: number) => {
  emit('update:modelValue', String(year))
  isOpen.value = false
}

const prevRange = () => {
  centerYear.value -= 12
}

const nextRange = () => {
  centerYear.value += 12
}

const selectQuickYear = (type: 'last' | 'current') => {
  const year = new Date().getFullYear()
  const target = type === 'last' ? year - 1 : year
  centerYear.value = target
  selectYear(target)
}
</script>

<template>
  <div class="relative w-full">
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="w-full h-9 px-3 bg-white b-solid b-1px b-gray-300 rounded-lg flex items-center justify-between transition-all hover:b-emerald-400 focus:outline-none focus:b-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm"
    >
      <span class="text-gray-700">{{ displayValue }}</span>
      <ChevronDown :size="16" class="text-gray-400 transition-transform" :class="{ 'rotate-180': isOpen }" />
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-[100] mt-1 min-w-[240px] bg-white rounded-lg shadow-2xl b-solid b-1px b-gray-200 overflow-hidden left-0"
        @wheel.stop
        @touchmove.stop
      >
        <div class="p-2 bg-gray-50 b-b-solid b-b-1px b-b-gray-200">
          <div class="flex gap-1.5">
            <button
              type="button"
              @click="selectQuickYear('last')"
              class="flex-1 h-8 px-2 text-xs rounded transition-colors b-solid b-1px b-gray-200 bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              上一年
            </button>
            <button
              type="button"
              @click="selectQuickYear('current')"
              class="flex-1 h-8 px-2 text-xs rounded transition-colors b-solid b-1px b-gray-200 bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              本年
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between px-3 py-2 bg-white b-b-solid b-b-1px b-b-gray-200">
          <button
            type="button"
            @click="prevRange"
            class="p-1 rounded transition-colors hover:bg-gray-100"
          >
            <ChevronLeft :size="18" class="text-gray-600" />
          </button>
          <span class="text-sm font-semibold text-gray-800">{{ centerYear - 6 }} - {{ centerYear + 5 }}</span>
          <button
            type="button"
            @click="nextRange"
            class="p-1 rounded transition-colors hover:bg-gray-100"
          >
            <ChevronRight :size="18" class="text-gray-600" />
          </button>
        </div>

        <div class="p-3 grid grid-cols-3 gap-1.5">
          <button
            v-for="year in years"
            :key="year"
            type="button"
            @click="selectYear(year)"
            class="px-2 h-8 rounded-lg text-sm font-medium transition-all"
            :class="year === parsedYear
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'"
          >
            {{ year }}
          </button>
        </div>
      </div>
    </Transition>

    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-[99]"
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
