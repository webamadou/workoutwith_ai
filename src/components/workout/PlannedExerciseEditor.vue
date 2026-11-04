<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { useAuthStore } from '@/stores/auth'
import { createVersion, toDraft } from '@/services/program'
import { fetchEquipment } from '@/services/profile'
import type { PlannedExercise, PlannedSession } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { applyAdjustments, checkAdjustments, describeAdjustment, type Adjustment } from '@shared/program/adjustments'

const props = defineProps<{ session: PlannedSession; exercise: PlannedExercise }>()
const emit = defineEmits<{ close: [] }>()

const catalog = useCatalogStore()
const plan = usePlanStore()
const auth = useAuthStore()
const toast = useToast()
const open = ref(true)
const saving = ref(false)
watch(open, (v) => !v && setTimeout(() => emit('close'), 200))

const ex = computed(() => catalog.byId.get(props.exercise.exercise_id)!)
const f = reactive({
  sets: props.exercise.sets,
  reps_min: props.exercise.reps_min,
  reps_max: props.exercise.reps_max,
  duration_s: props.exercise.duration_s,
  rest_s: props.exercise.rest_s,
  load_kg: props.exercise.load_kg == null ? null : Number(props.exercise.load_kg),
  replace: '' as string,
  scope: 'following' as 'this' | 'following',
})

const alternatives = computed(() => catalog.exercises
  .filter((e) => e.id !== ex.value.id && e.primary_muscle === ex.value.primary_muscle)
  .map((e) => ({ value: e.slug, label: e.name })))

function buildAdjustments(): Adjustment[] {
  const scope = {
    exercise_slug: ex.value.slug,
    from_week: props.session.week_number,
    to_week: f.scope === 'this' ? props.session.week_number : null,
    day_of_week: props.session.day_of_week,
  }
  const list: Adjustment[] = [{
    type: 'update_targets', ...scope, sets: f.sets, rest_s: f.rest_s, load_kg: f.load_kg ?? undefined,
    ...(ex.value.measurement === 'duration' ? { duration_s: f.duration_s } : { reps_min: f.reps_min, reps_max: f.reps_max }),
  }]
  if (f.replace) list.push({ type: 'replace_exercise', ...scope, new_exercise_slug: f.replace })
  return list
}

async function save() {
  if (!plan.active) return
  saving.value = true
  try {
    const adjustments = buildAdjustments()
    const current = toDraft(plan.active, catalog.byId)
    const owned = (await fetchEquipment()).map((e) => e.equipment_key)
    const avoided = (auth.profile?.avoided_exercise_ids ?? []).map((id) => catalog.byId.get(id)?.slug).filter(Boolean) as string[]
    const check = checkAdjustments(current, adjustments, catalog.infos, { currentWeek: plan.currentWeek, ownedEquipment: owned, avoidedSlugs: avoided })
    const blocking = check.violations.filter((v) => v.includes('passées') || v.includes('inconnu'))
    if (blocking.length) throw new Error(blocking[0])
    // Pour vos propres modifications, les garde-fous sont des avertissements.
    if (check.violations.length && !confirm(`Attention :\n${check.violations.join('\n')}\n\nEnregistrer quand même ?`)) return
    const names = new Map(catalog.exercises.map((e) => [e.slug, e.name]))
    const next = applyAdjustments(current, adjustments, catalog.infos)
    await createVersion(plan.active.plan.id, next, catalog.bySlug, 'user', adjustments.map((a) => describeAdjustment(a, names)).join(' ; '))
    await plan.load()
    toast.success('Programme mis à jour (nouvelle version).')
    open.value = false
  } catch (e) {
    toast.error(e)
  } finally {
    saving.value = false
  }
}

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-3 text-center tabular outline-none focus:border-accent'
</script>

<template>
  <BottomSheet v-model:open="open" :title="ex.name" :description="`Semaine ${session.week_number} · ${session.title}`">
    <form class="flex flex-col gap-5" @submit.prevent="save">
      <div class="grid grid-cols-3 gap-3">
        <label class="flex flex-col gap-1 text-sm font-medium">Séries<input v-model.number="f.sets" type="number" min="1" max="10" required :class="input" /></label>
        <template v-if="ex.measurement === 'duration'">
          <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Durée (s)<input v-model.number="f.duration_s" type="number" min="5" max="600" required :class="input" /></label>
        </template>
        <template v-else>
          <label class="flex flex-col gap-1 text-sm font-medium">Rép. min<input v-model.number="f.reps_min" type="number" min="1" max="100" required :class="input" /></label>
          <label class="flex flex-col gap-1 text-sm font-medium">Rép. max<input v-model.number="f.reps_max" type="number" :min="f.reps_min ?? 1" max="100" required :class="input" /></label>
        </template>
        <label class="flex flex-col gap-1 text-sm font-medium">Repos (s)<input v-model.number="f.rest_s" type="number" min="0" max="600" step="5" required :class="input" /></label>
        <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Charge conseillée (kg)<input v-model.number="f.load_kg" type="number" min="0" max="500" step="0.5" placeholder="libre" :class="input" /></label>
      </div>

      <div v-if="alternatives.length">
        <p class="mb-2 text-sm font-medium">Remplacer par <span class="text-muted">— facultatif</span></p>
        <ChipGroup v-model="f.replace" label="Exercice de remplacement" :options="[{ value: '', label: 'Garder' }, ...alternatives]" />
      </div>

      <div>
        <p class="mb-2 text-sm font-medium">Appliquer à</p>
        <ChipGroup v-model="f.scope" label="Portée" :options="[
          { value: 'this', label: 'Cette semaine' },
          { value: 'following', label: 'Cette semaine et les suivantes' },
        ]" />
      </div>

      <AppButton type="submit" size="lg" block :loading="saving">Enregistrer</AppButton>
    </form>
  </BottomSheet>
</template>
