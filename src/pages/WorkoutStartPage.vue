<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Play, TriangleAlert } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import { usePlanStore } from '@/stores/plan'
import { fetchInProgressSession, fetchSets, startSession } from '@/services/workout'
import type { PerformedSet, PlannedExercise, PlannedSession } from '@/services/types'
import { exerciseHistory, suggestNext } from '@shared/progression/engine'
import { useToast } from '@/composables/useToast'
import { formatDay, formatTarget, formatKg } from '@/lib/format'

const router = useRouter()
const catalog = useCatalogStore()
const auth = useAuthStore()
const plan = usePlanStore()
const toast = useToast()
const starting = ref(false)
const chosen = ref<{ planned: PlannedSession; date: string } | null>(null)
const history = ref<PerformedSet[]>([])

onMounted(async () => {
  try {
    const running = await fetchInProgressSession()
    if (running) return router.replace(`/seance/${running.id}`)
    const [, , sets] = await Promise.all([plan.load(), catalog.load(), fetchSets({ since: new Date(Date.now() - 180 * 86_400_000).toISOString() })])
    const done = new Set(plan.completed.map((x) => x.id))
    history.value = sets.filter((x) => done.has(x.workout_session_id))
    if (plan.next) chosen.value = { planned: plan.next.planned, date: plan.next.date }
  } catch (e) { toast.error(e) }
})

/** Séances proposées : manquées de la semaine en cours et à venir de la semaine. */
const others = computed(() => plan.schedule
  .filter((s) => (s.status === 'missed' || s.status === 'upcoming' || s.status === 'today') && Math.abs(s.slot.week_number - plan.currentWeek) <= 1)
  .slice(0, 6)
  .map((s) => ({ ...s, planned: plan.active!.sessions.find((p) => p.week_number === s.slot.week_number && p.day_of_week === s.slot.day_of_week)! })))

const cautionCount = computed(() => chosen.value?.planned.planned_exercises
  .filter((e) => catalog.byId.get(e.exercise_id)?.caution_tags.some((t) => auth.profile?.limitation_tags.includes(t))).length ?? 0)

/** Dernière performance et objectif adapté par le moteur déterministe. */
function guidance(e: PlannedExercise) {
  const hist = exerciseHistory(history.value as never, e.exercise_id)
  const last = hist.at(-1)
  if (!last) return null
  const unit = catalog.byId.get(e.exercise_id)?.measurement === 'duration' ? ' s' : ''
  return { last: `${last.reps_by_set.join(' · ')}${unit}${last.max_load_kg != null ? ` à ${formatKg(last.max_load_kg)}` : ''}`, advice: suggestNext(hist, { ...e, load_kg: e.load_kg == null ? null : Number(e.load_kg) }).message }
}

async function start() {
  if (!chosen.value || !plan.active) return
  starting.value = true
  try {
    const s = await startSession(chosen.value.planned, plan.active.plan.id, chosen.value.date)
    await router.push(`/seance/${s.id}`)
  } catch (e) {
    toast.error(e)
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Séance" />
    <template v-if="chosen">
      <section class="rounded-3xl bg-surface p-5">
        <p class="text-sm text-muted">Semaine {{ chosen.planned.week_number }} · {{ formatDay(chosen.date) }}</p>
        <h2 class="font-display text-4xl font-semibold">{{ chosen.planned.title }}</h2>
        <ol class="mt-4 divide-y divide-line">
          <li v-for="e in chosen.planned.planned_exercises" :key="e.id" class="py-3">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-medium">{{ catalog.byId.get(e.exercise_id)?.name }}</span>
              <span class="tabular shrink-0 text-sm text-muted">{{ formatTarget(e) }}<template v-if="e.load_kg != null"> · {{ formatKg(e.load_kg) }}</template></span>
            </div>
            <p v-if="guidance(e)" class="mt-1 text-xs text-muted"><span class="font-semibold text-accent">Dernière fois : {{ guidance(e)!.last }}.</span> {{ guidance(e)!.advice }}</p>
          </li>
        </ol>
        <p v-if="cautionCount" class="mt-3 flex gap-2 rounded-xl bg-energy/15 p-3 text-sm">
          <TriangleAlert class="size-5 shrink-0" aria-hidden="true" />
          {{ cautionCount }} exercice(s) concernent une zone sensible déclarée : arrêtez-vous en cas de douleur.
        </p>
        <AppButton size="lg" block class="mt-5" :loading="starting" @click="start"><Play class="size-5" aria-hidden="true" />Démarrer la séance</AppButton>
      </section>

      <section v-if="others.length > 1" class="mt-6">
        <h2 class="mb-2 font-semibold">Choisir une autre séance</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="o in others" :key="o.planned.id">
            <button type="button" class="flex w-full items-center justify-between rounded-2xl p-4 text-left"
              :class="o.planned.id === chosen.planned.id ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface'"
              :aria-pressed="o.planned.id === chosen.planned.id" @click="chosen = { planned: o.planned, date: o.date }">
              <span><span class="block font-medium">{{ o.planned.title }}</span><span class="text-sm text-muted">Semaine {{ o.slot.week_number }} · {{ formatDay(o.date) }}</span></span>
              <span v-if="o.status === 'missed'" class="text-xs font-semibold text-bad">Manquée</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
    <EmptyState v-else-if="plan.loaded" title="Aucune séance à venir" text="Votre programme est terminé ou absent. Le coach peut vous aider à préparer la suite." />
  </div>
</template>
