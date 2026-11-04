<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
defineProps<{ title: string; subtitle?: string; back?: string }>()
</script>

<template>
  <header class="mb-5 flex items-end justify-between gap-3">
    <div class="flex min-w-0 items-center gap-2">
      <RouterLink v-if="back" :to="back" class="-ml-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2" aria-label="Retour">
        <ArrowLeft class="size-6" aria-hidden="true" />
      </RouterLink>
      <div class="min-w-0">
        <h1 class="truncate font-display text-4xl font-semibold leading-none tracking-tight">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1.5 text-sm text-muted">{{ subtitle }}</p>
      </div>
    </div>
    <slot />
  </header>
</template>
