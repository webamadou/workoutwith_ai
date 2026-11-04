<script setup lang="ts">
import { Loader } from 'lucide-vue-next'

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'energy'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  block?: boolean
}>(), { variant: 'primary', size: 'md', type: 'button' })
</script>

<template>
  <button
    :type="type" :disabled="disabled || loading" :aria-busy="loading || undefined"
    class="inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      block && 'w-full',
      size === 'sm' && 'h-9 px-3 text-sm',
      size === 'md' && 'h-12 px-5 text-base',
      size === 'lg' && 'h-14 px-6 text-lg',
      variant === 'primary' && 'bg-accent text-accent-ink hover:brightness-110',
      variant === 'secondary' && 'bg-surface-2 text-ink hover:bg-line',
      variant === 'ghost' && 'text-ink hover:bg-surface-2',
      variant === 'danger' && 'bg-bad text-white hover:brightness-110',
      variant === 'energy' && 'bg-energy text-slate-ink hover:brightness-105',
    ]"
  >
    <Loader v-if="loading" class="size-5 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
