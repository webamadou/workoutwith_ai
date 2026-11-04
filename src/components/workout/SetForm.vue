<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ChevronDown, Play, Square, TriangleAlert } from 'lucide-vue-next'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { DIFFICULTY_LABELS } from '@/services/types'
import { formatClock } from '@/lib/format'

export interface SetDraft {
  reps: number | null
  duration_s: number | null
  load_kg: number | null
  difficulty: number | null
  note: string
  pain: boolean
  pain_note: string
  technique: { variant?: string; pause_bottom_s?: number | null; pause_top?: boolean }
}

const draft = defineModel<SetDraft>({ required: true })
const props = defineProps<{ setNumber: number; measurement: 'reps' | 'duration'; targetDuration?: number | null; loaded: boolean; saving: boolean; editing: boolean }>()
const emit = defineEmits<{ validate: [startedAt: number | null]; cancelEdit: [] }>()

const details = ref(draft.value.pain || Boolean(draft.value.note))
const startedAt = ref<number | null>(null)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined

function startSet() {
  startedAt.value = Date.now()
  now.value = Date.now()
  tick = setInterval(() => (now.value = Date.now()), 250)
}
function stopClock() { clearInterval(tick); tick = undefined }
onBeforeUnmount(stopClock)
watch(() => props.setNumber, () => { stopClock(); startedAt.value = null })

const elapsed = computed(() => (startedAt.value ? Math.floor((now.value - startedAt.value) / 1000) : 0))
const countdown = computed(() => (props.targetDuration ? props.targetDuration - elapsed.value : null))

// Exercice chronométré : à la fin du compte à rebours on remplit la durée.
watch(countdown, (c) => {
  if (props.measurement === 'duration' && c != null && c <= 0 && startedAt.value) {
    navigator.vibrate?.(300)
    draft.value.duration_s = props.targetDuration ?? elapsed.value
    stopClock()
  }
})

function validate() {
  if (props.measurement === 'duration' && startedAt.value && tick) draft.value.duration_s = elapsed.value
  stopClock()
  emit('validate', startedAt.value)
  startedAt.value = null
}

const canValidate = computed(() => (props.measurement === 'reps' ? draft.value.reps != null : draft.value.duration_s != null))
</script>

<template>
  <form class="rounded-3xl bg-surface p-5" @submit.prevent="validate">
    <div class="flex items-center justify-between">
      <h3 class="font-display text-2xl font-semibold">{{ editing ? 'Corriger la série' : 'Série' }} {{ setNumber }}</h3>
      <button v-if="editing" type="button" class="text-sm font-medium text-accent" @click="emit('cancelEdit')">Annuler</button>
      <p v-else-if="startedAt" class="tabular font-display text-2xl font-semibold text-accent" aria-live="off">
        {{ measurement === 'duration' && countdown != null ? formatClock(Math.max(0, countdown)) : formatClock(elapsed) }}
      </p>
    </div>

    <div class="mt-4 flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
      <NumberStepper v-if="measurement === 'reps'" v-model="draft.reps" label="Répétitions" :max="500" />
      <NumberStepper v-else v-model="draft.duration_s" label="Durée" unit="secondes" :step="5" :max="3600" />
      <NumberStepper v-if="loaded" v-model="draft.load_kg" label="Charge" unit="kg" :step="1" :max="500" placeholder="0" />
    </div>

    <fieldset class="mt-5">
      <legend class="mb-2 text-sm font-medium text-muted">Difficulté ressentie</legend>
      <div class="grid grid-cols-5 gap-1.5">
        <button v-for="d in 5" :key="d" type="button" :aria-pressed="draft.difficulty === d"
          class="flex h-14 flex-col items-center justify-center rounded-xl text-sm font-semibold transition"
          :class="draft.difficulty === d ? 'bg-slate-ink text-chalk dark:bg-chalk dark:text-slate-ink' : 'bg-surface-2'"
          @click="draft.difficulty = draft.difficulty === d ? null : d">
          <span class="tabular font-display text-xl leading-none">{{ d }}</span>
          <span class="mt-0.5 text-[10px] font-medium opacity-70">{{ DIFFICULTY_LABELS[d] }}</span>
        </button>
      </div>
    </fieldset>

    <button type="button" class="mt-4 flex w-full items-center justify-between py-2 text-sm font-medium" :aria-expanded="details" @click="details = !details">
      Remarque, douleur, technique
      <ChevronDown class="size-5 transition" :class="details && 'rotate-180'" aria-hidden="true" />
    </button>
    <div v-if="details" class="flex flex-col gap-3 pt-1">
      <label class="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2" :class="draft.pain ? 'bg-bad/10' : 'bg-surface-2'">
        <input v-model="draft.pain" type="checkbox" class="size-5 accent-[var(--app-bad)]" />
        <span class="flex items-center gap-2 font-medium"><TriangleAlert class="size-4" aria-hidden="true" />Douleur ou inconfort</span>
      </label>
      <template v-if="draft.pain">
        <input v-model="draft.pain_note" placeholder="Où et comment ? (ex. : tiraillement abdominal)" class="h-12 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent" />
        <p class="text-sm text-bad">Arrêtez l’exercice si la douleur persiste. Si elle est vive ou inhabituelle, consultez un professionnel de santé.</p>
      </template>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 text-sm">Variante
          <input v-model="draft.technique.variant" placeholder="ex. : poignées" class="h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent" /></label>
        <label class="flex flex-col gap-1 text-sm">Pause en bas (s)
          <input v-model.number="draft.technique.pause_bottom_s" type="number" min="0" max="30" class="h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent" /></label>
      </div>
      <label class="flex items-center gap-3 text-sm"><input v-model="draft.technique.pause_top" type="checkbox" class="size-5" />Pause en position haute</label>
      <textarea v-model="draft.note" rows="2" placeholder="Remarque sur la série" class="rounded-xl border border-line bg-surface p-3 outline-none focus:border-accent" />
    </div>

    <div class="mt-5 flex gap-3">
      <AppButton v-if="!startedAt && !editing" variant="secondary" size="lg" class="flex-1" @click="startSet">
        <Play class="size-5" aria-hidden="true" />Démarrer
      </AppButton>
      <AppButton v-else-if="measurement === 'duration' && tick" variant="secondary" size="lg" class="flex-1" @click="draft.duration_s = elapsed; stopClock()">
        <Square class="size-5" aria-hidden="true" />Stop
      </AppButton>
      <AppButton type="submit" size="lg" class="flex-[2]" :disabled="!canValidate" :loading="saving">
        <Check class="size-5" aria-hidden="true" />{{ editing ? 'Enregistrer' : 'Valider la série' }}
      </AppButton>
    </div>
  </form>
</template>
