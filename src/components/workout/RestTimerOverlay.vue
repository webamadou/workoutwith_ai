<script setup lang="ts">
import { computed } from 'vue'
import { formatClock } from '@/lib/format'

const props = defineProps<{ remaining: number; progress: number; nextLabel: string }>()
const emit = defineEmits<{ add: [seconds: number]; skip: [] }>()
const R = 120
const C = 2 * Math.PI * R
const dash = computed(() => C * (1 - props.progress))
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col items-center justify-between bg-energy px-6 pb-safe text-slate-ink" style="padding-top: max(2rem, env(safe-area-inset-top))" role="timer" aria-live="off">
    <p class="text-lg font-semibold">Récupération</p>
    <div class="relative grid place-items-center">
      <svg viewBox="0 0 280 280" class="w-[min(78vw,22rem)] -rotate-90" aria-hidden="true">
        <circle cx="140" cy="140" :r="R" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="16" />
        <circle cx="140" cy="140" :r="R" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round"
          :stroke-dasharray="C" :stroke-dashoffset="dash" style="transition: stroke-dashoffset 0.25s linear" />
      </svg>
      <p class="tabular absolute font-display text-8xl font-bold leading-none" :aria-label="`${remaining} secondes restantes`">{{ formatClock(remaining) }}</p>
    </div>
    <div class="w-full max-w-sm">
      <p class="mb-4 text-center font-medium">Ensuite : {{ nextLabel }}</p>
      <div class="grid grid-cols-3 gap-3">
        <button type="button" class="h-14 rounded-2xl bg-slate-ink/10 text-lg font-semibold" @click="emit('add', -15)">−15 s</button>
        <button type="button" class="h-14 rounded-2xl bg-slate-ink/10 text-lg font-semibold" @click="emit('add', 15)">+15 s</button>
        <button type="button" class="h-14 rounded-2xl bg-slate-ink text-lg font-semibold text-energy" @click="emit('skip')">Passer</button>
      </div>
      <div class="h-6" />
    </div>
  </div>
</template>
