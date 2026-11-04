<script setup lang="ts">
import { useId } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

const model = defineModel<number | null>({ required: true })
const props = withDefaults(defineProps<{ label: string; step?: number; min?: number; max?: number; unit?: string; placeholder?: string }>(),
  { step: 1, min: 0, max: 999 })

const round = (n: number) => Math.round(n * 100) / 100
const id = useId()
function bump(dir: 1 | -1) {
  const v = round((model.value ?? 0) + dir * props.step)
  model.value = Math.min(props.max, Math.max(props.min, v))
}
function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(',', '.')
  if (raw === '') return (model.value = null)
  const n = Number(raw)
  if (!Number.isNaN(n)) model.value = Math.min(props.max, Math.max(props.min, n))
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <label :for="id" class="text-sm font-medium text-muted">{{ label }}</label>
    <div class="flex items-center gap-1">
      <button type="button" class="grid size-14 place-items-center rounded-2xl bg-surface-2 active:scale-95" :aria-label="`Diminuer ${label}`" @click="bump(-1)">
        <Minus class="size-6" aria-hidden="true" />
      </button>
      <div class="relative">
        <input
          :id="id" :value="model ?? ''" inputmode="decimal" :placeholder="placeholder ?? '–'"
          class="tabular h-16 w-24 bg-transparent text-center font-display text-5xl font-semibold outline-none placeholder:text-line"
          @input="onInput" @focus="($event.target as HTMLInputElement).select()"
        />
        <span v-if="unit" class="absolute -bottom-1 left-0 right-0 text-center text-xs text-muted" aria-hidden="true">{{ unit }}</span>
      </div>
      <button type="button" class="grid size-14 place-items-center rounded-2xl bg-surface-2 active:scale-95" :aria-label="`Augmenter ${label}`" @click="bump(1)">
        <Plus class="size-6" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
