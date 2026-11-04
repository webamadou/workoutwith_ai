<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T[] | T | null>({ required: true })
const props = defineProps<{ options: { value: T; label: string; hint?: string }[]; multiple?: boolean; label: string }>()

const selected = (v: T) => (props.multiple ? (model.value as T[]).includes(v) : model.value === v)
function toggle(v: T) {
  if (!props.multiple) return (model.value = v)
  const cur = model.value as T[]
  model.value = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
}
</script>

<template>
  <div role="group" :aria-label="label" class="flex flex-wrap gap-2">
    <button
      v-for="o in options" :key="o.value" type="button" :aria-pressed="selected(o.value)"
      class="min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-medium transition"
      :class="selected(o.value) ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface hover:border-muted'"
      @click="toggle(o.value)"
    >
      {{ o.label }}
      <span v-if="o.hint" class="block text-xs font-normal text-muted">{{ o.hint }}</span>
    </button>
  </div>
</template>
