<script setup lang="ts">
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="sheet-overlay fixed inset-0 z-50 bg-black/50" />
      <DialogContent
        class="sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 pb-safe shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <DialogTitle class="font-display text-2xl font-semibold">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="mt-1 text-sm text-muted">{{ description }}</DialogDescription>
        <div class="mt-4"><slot /></div>
        <div class="h-4" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.sheet[data-state='open'] { animation: sheet-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sheet-overlay[data-state='open'] { animation: fade-in 0.2s ease; }
@keyframes sheet-in { from { transform: translateY(24px); opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
</style>
