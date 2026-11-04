<script setup lang="ts">
defineProps<{ title: string; text?: string }>()
</script>

<template>
  <div class="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
    <p class="font-semibold">{{ title }}</p>
    <p v-if="text" class="mx-auto mt-1 max-w-sm text-sm text-muted">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4 flex justify-center"><slot /></div>
  </div>
</template>
