<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, TrendingDown, TrendingUp, Minus as Flat, TriangleAlert } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import RecommendationCard from '@/components/coach/RecommendationCard.vue'
import { useCatalogStore } from '@/stores/catalog'
import { fetchSession, fetchSets } from '@/services/workout'
import { analyzeSession, fetchRecommendations, getAIStatus, CoachError } from '@/services/coach'
import type { PerformedSet, Recommendation, WorkoutSession } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatDay, formatDuration, formatKg } from '@/lib/format'
import { comparePerformances, exerciseHistory, summarizeExercise, summarizeSession } from '@shared/progression/engine'

const route = useRoute()
const catalog = useCatalogStore()
const toast = useToast()
const id = route.params.id as string

const session = ref<WorkoutSession | null>(null)
const sets = ref<PerformedSet[]>([])
const previous = ref<PerformedSet[]>([])
const recs = ref<Recommendation[]>([])
const aiEnabled = ref(false)
const analyzing = ref(false)
const aiError = ref('')

onMounted(async () => {
  try {
    await catalog.load()
    const r = await fetchSession(id)
    session.value = r.session
    sets.value = r.sets
    const ids = new Set(r.sets.map((s) => s.exercise_id))
    const before = r.session.started_at ?? r.session.created_at
    previous.value = (await fetchSets({ since: new Date(Date.parse(before) - 120 * 86_400_000).toISOString() }))
      .filter((s) => ids.has(s.exercise_id) && s.workout_session_id !== id && s.completed_at < before)
    recs.value = await fetchRecommendations({ sessionId: id })
    aiEnabled.value = (await getAIStatus().catch(() => null))?.enabled ?? false
  } catch (e) { toast.error(e) }
})

const summary = computed(() => summarizeSession(sets.value as never, session.value ?? undefined))
const perExercise = computed(() => {
  const groups = new Map<string, PerformedSet[]>()
  for (const s of sets.value) groups.set(s.exercise_id, [...(groups.get(s.exercise_id) ?? []), s])
  return [...groups.entries()].map(([exId, list]) => {
    const perf = summarizeExercise(list as never)
    const prev = exerciseHistory(previous.value as never, exId).at(-1)
    return { ex: catalog.byId.get(exId), perf, cmp: comparePerformances(prev, perf), list }
  })
})

async function analyze() {
  analyzing.value = true
  aiError.value = ''
  try {
    const r = await analyzeSession(id)
    recs.value = [r.recommendation, ...recs.value]
  } catch (e) {
    aiError.value = e instanceof CoachError ? e.message : 'Analyse indisponible pour le moment.'
  } finally {
    analyzing.value = false
  }
}
</script>

<template>
  <div v-if="session">
    <PageHeader title="Bilan" :subtitle="`${session.title} · ${formatDay(session.completed_at ?? session.started_at ?? session.created_at)}`" back="/" />

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Chiffres clés">
      <div class="rounded-2xl bg-surface p-4"><p class="text-xs text-muted">Durée</p><p class="tabular font-display text-3xl font-semibold">{{ formatDuration(summary.elapsed_s) }}</p></div>
      <div class="rounded-2xl bg-surface p-4"><p class="text-xs text-muted">Exercices</p><p class="tabular font-display text-3xl font-semibold">{{ summary.exercises }}</p></div>
      <div class="rounded-2xl bg-surface p-4"><p class="text-xs text-muted">Séries</p><p class="tabular font-display text-3xl font-semibold">{{ summary.sets }}</p></div>
      <div class="rounded-2xl bg-surface p-4"><p class="text-xs text-muted">Répétitions</p><p class="tabular font-display text-3xl font-semibold">{{ summary.reps }}</p></div>
    </section>
    <p class="mt-3 text-sm text-muted">
      Difficulté ressentie : <span class="font-semibold text-ink">{{ session.perceived_difficulty ? `${session.perceived_difficulty}/10` : 'non renseignée' }}</span>
      <template v-if="summary.tonnage_kg"> · volume soulevé {{ formatKg(summary.tonnage_kg) }}</template>
      <template v-if="summary.pain_reports"> · <span class="text-bad">{{ summary.pain_reports }} douleur(s) signalée(s)</span></template>
    </p>
    <blockquote v-if="session.comment" class="mt-3 rounded-2xl border-l-4 border-accent bg-surface p-4 text-sm">{{ session.comment }}</blockquote>

    <section class="mt-6" aria-labelledby="ex-title">
      <h2 id="ex-title" class="font-display text-2xl font-semibold">Exercices réalisés</h2>
      <ul class="mt-3 flex flex-col gap-3">
        <li v-for="p in perExercise" :key="p.ex?.id" class="rounded-2xl bg-surface p-4">
          <div class="flex items-start justify-between gap-3">
            <RouterLink :to="`/exercices/${p.ex?.slug}`" class="font-semibold">{{ p.ex?.name }}</RouterLink>
            <span class="flex shrink-0 items-center gap-1 text-sm font-medium"
              :class="{ 'text-good': p.cmp.trend === 'progression', 'text-bad': p.cmp.trend === 'regression', 'text-muted': p.cmp.trend === 'stable' || p.cmp.trend === 'first' }">
              <TrendingUp v-if="p.cmp.trend === 'progression'" class="size-4" aria-hidden="true" />
              <TrendingDown v-else-if="p.cmp.trend === 'regression'" class="size-4" aria-hidden="true" />
              <Flat v-else class="size-4" aria-hidden="true" />
              {{ { progression: 'En progrès', regression: 'En baisse', stable: 'Stable', first: 'Première fois' }[p.cmp.trend] }}
            </span>
          </div>
          <p class="tabular mt-1 font-display text-2xl font-semibold">
            {{ p.perf.reps_by_set.join(' · ') }}{{ p.ex?.measurement === 'duration' ? ' s' : ' rép.' }}
            <span v-if="p.perf.max_load_kg != null" class="text-base font-medium text-muted">à {{ formatKg(p.perf.max_load_kg) }}</span>
          </p>
          <p class="text-sm text-muted">{{ p.cmp.explanation }}<template v-if="p.perf.avg_difficulty"> Difficulté moyenne {{ p.perf.avg_difficulty }}/5.</template></p>
          <p v-for="s in p.list.filter((s) => s.pain || s.note)" :key="s.id" class="mt-1 flex gap-1.5 text-sm" :class="s.pain && 'text-bad'">
            <TriangleAlert v-if="s.pain" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />Série {{ s.set_number }} : {{ [s.pain_note, s.note].filter(Boolean).join(' — ') || 'douleur signalée' }}
          </p>
        </li>
      </ul>
    </section>

    <section class="mt-6" aria-labelledby="coach-title">
      <h2 id="coach-title" class="flex items-center gap-2 font-display text-2xl font-semibold"><Sparkles class="size-5 text-accent" aria-hidden="true" />Analyse du coach</h2>
      <div class="mt-3 flex flex-col gap-3">
        <RecommendationCard v-for="(r, i) in recs" :key="r.id" :rec="r" @updated="(u) => (recs[i] = u)" />
        <template v-if="!recs.length">
          <AppButton v-if="aiEnabled" size="lg" block :loading="analyzing" @click="analyze">Demander l’analyse du coach</AppButton>
          <p v-else class="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Le coach IA n’est pas configuré. Le bilan ci-dessus est calculé à partir de vos données, sans IA.</p>
        </template>
        <p v-if="aiError" role="alert" class="rounded-xl bg-bad/10 p-3 text-sm text-bad">{{ aiError }}</p>
      </div>
    </section>
  </div>
</template>
