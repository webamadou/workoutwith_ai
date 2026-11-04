<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import ExerciseDemo from '@/components/exercise/ExerciseDemo.vue'
import ExerciseGuide from '@/components/exercise/ExerciseGuide.vue'
import { demoFor } from '@shared/exercises/demos'
import { fetchEquipment } from '@/services/profile'
import TrendChart from '@/components/progress/TrendChart.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import { usePlanStore } from '@/stores/plan'
import { fetchSets } from '@/services/workout'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type PerformedSet } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatKg, formatShort, formatTarget } from '@/lib/format'
import { LIMITATION_LABELS } from '@/lib/profileOptions'
import { comparePerformances, exerciseHistory, suggestNext } from '@shared/progression/engine'

const route = useRoute()
const catalog = useCatalogStore()
const auth = useAuthStore()
const plan = usePlanStore()
const toast = useToast()
const sets = shallowRef<PerformedSet[]>([])

const ex = computed(() => catalog.bySlug.get(route.params.slug as string))
const demo = computed(() => (ex.value ? demoFor(ex.value.slug) : undefined))
const owned = shallowRef<string[]>([])

watch(() => route.params.slug, async () => {
  try {
    await Promise.all([catalog.load(), plan.loaded ? null : plan.load()])
    owned.value = (await fetchEquipment()).map((e) => e.equipment_key)
    if (ex.value) sets.value = await fetchSets({ exerciseId: ex.value.id })
  } catch (e) { toast.error(e) }
}, { immediate: true })

const history = computed(() => {
  if (!ex.value) return []
  const completed = new Set(plan.completed.map((s) => s.id))
  return exerciseHistory(sets.value.filter((s) => completed.has(s.workout_session_id)) as never, ex.value.id)
})
const isDuration = computed(() => ex.value?.measurement === 'duration')
const cautions = computed(() => (ex.value?.caution_tags ?? []).filter((t) => auth.profile?.limitation_tags.includes(t)))

/** Prochaine occurrence dans le programme, pour la suggestion déterministe. */
const nextTarget = computed(() => {
  const n = plan.schedule.find((s) => ['today', 'upcoming', 'in_progress'].includes(s.status)
    && plan.active?.sessions.find((p) => p.week_number === s.slot.week_number && p.day_of_week === s.slot.day_of_week)
      ?.planned_exercises.some((e) => e.exercise_id === ex.value?.id))
  if (!n) return null
  const p = plan.active!.sessions.find((x) => x.week_number === n.slot.week_number && x.day_of_week === n.slot.day_of_week)!
  return { when: n, target: p.planned_exercises.find((e) => e.exercise_id === ex.value!.id)! }
})
const suggestion = computed(() => nextTarget.value ? suggestNext(history.value, nextTarget.value.target) : null)

const chart = computed(() => ({
  labels: history.value.map((h) => formatShort(h.date)),
  series: [
    { label: isDuration.value ? 'Durée totale (s)' : 'Répétitions totales', data: history.value.map((h) => isDuration.value ? h.total_duration_s : h.total_reps) },
    ...(history.value.some((h) => h.max_load_kg != null) ? [{ label: 'Charge max (kg)', data: history.value.map((h) => h.max_load_kg) }] : []),
  ],
}))
</script>

<template>
  <div v-if="ex">
    <PageHeader :title="ex.name" :subtitle="MUSCLE_LABELS[ex.primary_muscle]" back="/exercices" />

    <ExerciseDemo :media="ex.exercise_media" :slug="ex.slug" />
    <ExerciseGuide v-if="demo" :demo="demo" :owned="owned" />

    <div v-if="cautions.length" role="note" class="mt-4 flex gap-3 rounded-2xl bg-energy/15 p-4 text-sm">
      <TriangleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>Vigilance ({{ cautions.map((c) => LIMITATION_LABELS[c]).join(', ') }}) : réduisez l’amplitude ou remplacez l’exercice à la moindre douleur, et consultez un professionnel de santé si elle persiste.</p>
    </div>

    <p class="mt-5 leading-relaxed">{{ ex.description }}</p>

    <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-surface p-3"><dt class="text-muted">Muscles secondaires</dt><dd class="mt-0.5 font-medium">{{ ex.secondary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ') || '—' }}</dd></div>
      <div class="rounded-xl bg-surface p-3"><dt class="text-muted">Matériel</dt><dd class="mt-0.5 font-medium">{{ ex.equipment.map((k) => EQUIPMENT_LABELS[k]).join(', ') || 'Poids du corps' }}</dd></div>
      <div class="rounded-xl bg-surface p-3"><dt class="text-muted">Difficulté</dt><dd class="mt-0.5 font-medium">{{ ['', 'Accessible', 'Intermédiaire', 'Exigeante'][ex.difficulty] }}</dd></div>
      <div class="rounded-xl bg-surface p-3"><dt class="text-muted">Repos conseillé</dt><dd class="mt-0.5 font-medium">{{ ex.default_rest_s }} s</dd></div>
    </dl>

    <section class="mt-6" aria-labelledby="howto">
      <h2 id="howto" class="font-display text-2xl font-semibold">Exécution</h2>
      <ol class="mt-3 flex flex-col gap-3">
        <li v-for="(step, i) in ex.instructions" :key="i" class="flex gap-3">
          <span class="tabular grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{{ i + 1 }}</span>
          <span class="pt-0.5">{{ step }}</span>
        </li>
      </ol>
    </section>

    <section class="mt-6 rounded-2xl border border-line p-5" aria-labelledby="safety">
      <h2 id="safety" class="font-semibold">Sécurité</h2>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li v-for="(t, i) in ex.safety_tips" :key="i">{{ t }}</li>
      </ul>
    </section>

    <section class="mt-6" aria-labelledby="hist">
      <h2 id="hist" class="font-display text-2xl font-semibold">Historique</h2>
      <div v-if="suggestion && nextTarget" class="mt-3 rounded-2xl bg-accent-soft p-4 text-sm">
        <p class="font-semibold text-accent">Prochaine fois : {{ formatTarget(nextTarget.target) }}<template v-if="nextTarget.target.load_kg != null"> à {{ formatKg(nextTarget.target.load_kg) }}</template></p>
        <p class="mt-1">{{ suggestion.message }}</p>
      </div>
      <template v-if="history.length">
        <div class="mt-4 rounded-2xl bg-surface p-4">
          <TrendChart :labels="chart.labels" :series="chart.series" :summary="`Évolution de ${ex.name} sur ${history.length} séances`" />
        </div>
        <ul class="mt-4 divide-y divide-line rounded-2xl bg-surface px-4">
          <li v-for="(h, i) in [...history].reverse()" :key="h.session_id" class="flex items-center justify-between gap-3 py-3">
            <div>
              <p class="font-medium">{{ formatShort(h.date) }}</p>
              <p class="text-xs text-muted">{{ comparePerformances([...history].reverse()[i + 1], h).explanation }}</p>
            </div>
            <div class="text-right">
              <p class="tabular font-display text-xl font-semibold">{{ h.reps_by_set.join(' · ') }}{{ isDuration ? ' s' : '' }}</p>
              <p class="text-xs text-muted">{{ h.max_load_kg != null ? formatKg(h.max_load_kg) : 'poids du corps' }}<template v-if="h.pain"> · douleur signalée</template></p>
            </div>
          </li>
        </ul>
      </template>
      <p v-else class="mt-3 text-sm text-muted">Aucune série enregistrée pour cet exercice.</p>
    </section>
  </div>
  <p v-else-if="catalog.exercises.length" class="text-muted">Exercice introuvable.</p>
</template>
