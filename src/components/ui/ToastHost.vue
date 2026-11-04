<script setup lang="ts">
import { useToast } from '@/composables/useToast'
const { toasts } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-safe" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts" :key="t.id" role="status"
        class="pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
        :class="{
          'bg-slate-ink text-chalk dark:bg-chalk dark:text-slate-ink': t.tone === 'info',
          'bg-good text-white': t.tone === 'success',
          'bg-bad text-white': t.tone === 'error',
        }"
      >{{ t.message }}</div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
