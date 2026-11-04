<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Play, Sparkles, TrendingDown, TrendingUp, Minus as Flat } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import RecommendationCard from '@/components/coach/RecommendationCard.vue'
import { fetchSets, resolveToVerify, skipSlot, startSession } from '@/services/workout'
import { fetchMeasurements } from '@/services/progress'
import { fetchRecommendations } from '@/services/coach'
import { fetchEquipment } from '@/services/profile'
import { refreshContinuity } from '@/services/continuity'
import { SLOT_DOT } from '@/lib/status'
import { daysBetween, toISODate } from '@shared/dates'
import type { Measurement, PerformedSet, Recommendation } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatDay, formatDuration, formatKg, formatShort, formatTarget } from '@/lib/format'
import { comparePerformances, exerciseHistory } from '@shared/progression/engine'
import { PHASE_LABELS, phaseOfWeek } from '@shared/program/template'

const auth = useAuthStore()
const catalog = useCatalogStore()
const plan = usePlanStore()
const router = useRouter()
const toast = useToast()

const sets = ref<PerformedSet[]>([])
const measurements = ref<Measurement[]>([])
const lastRec = ref<Recommendation | null>(null)
const pending = ref<Recommendation[]>([])
const loading = ref(true)
const busySlot = ref<string | null>(null)

onMounted(async () => {
  try {
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
    const [, , s, m, r] = await Promise.all([plan.load(), catalog.load(), fetchSets({ since }), fetchMeasurements(), fetchRecommendations({ limit: 1 })])
    sets.value = s
    measurements.value = m
    lastRec.value = r[0] ?? null
    // Continuité : propositions déterministes (douleur, baisse, matériel), sans appel à l'IA.
    const input = plan.continuityInput(s, (await fetchEquipment()).map((e) => e.equipment_key))
    if (input) await refreshContinuity(input).catch(() => 0)
    pending.value = await fetchRecommendations({ status: 'pending', limit: 3 })
  } catch (e) {
    toast.error(e)
  } finally {
    loading.value = false
  }
})

const firstName = computed(() => auth.profile?.display_name?.split(' ')[0] ?? '')
const next = computed(() => plan.next)
const total = computed(() => plan.schedule.length)
const done = computed(() => plan.schedule.filter((s) => s.status === 'done').length)
const missed = computed(() => plan.schedule.filter((s) => s.status === 'missed').length)
const lastSession = computed(() => plan.completed[0] ?? null)
const lastDuration = computed(() => {
  const s = lastSession.value
  const d = s?.started_at && s.completed_at ? (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000 : 0
  return d > 0 ? d : null // durée inconnue (ex. import d'un ancien suivi)
})

const latest = (key: 'weight_kg' | 'waist_cm') => {
  const list = measurements.value.filter((m) => m[key] != null)
  if (!list.length) return null
  const last = Number(list.at(-1)![key])
  return { value: last, delta: list.length > 1 ? Math.round((last - Number(list[0][key])) * 10) / 10 : null, date: list.at(-1)!.measured_on }
}
const weight = computed(() => latest('weight_kg'))
const waist = computed(() => latest('waist_cm'))

/** Exercices principaux : ceux les plus pratiqués récemment. */
const keyLifts = computed(() => {
  const counts = new Map<string, Set<string>>()
  for (const s of sets.value) counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? new Set()).add(s.workout_session_id))
  return [...counts.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 3).map(([id]) => {
    const hist = exerciseHistory(sets.value as never, id)
    const last = hist.at(-1)!
    return { exercise: catalog.byId.get(id), last, cmp: comparePerformances(hist.at(-2), last) }
  }).filter((k) => k.exercise)
})

const nextLabel = computed(() => {
  const n = next.value
  if (!n) return ''
  if (n.status === 'in_progress') return 'Séance en cours'
  if (n.status === 'today') return 'Aujourd’hui'
  return formatDay(n.date)
})

const today = toISODate(new Date())
const toVerify = computed(() => plan.schedule.filter((s) => s.status === 'to_verify'))
const recentMissed = computed(() => plan.schedule.filter((s) => s.status === 'missed' && daysBetween(s.date, today) <= 14))
const plannedOf = (w: number, d: number) => plan.active!.sessions.find((p) => p.week_number === w && p.day_of_week === d)!

async function verify(slot: (typeof plan.schedule)[number], doneIt: boolean) {
  busySlot.value = slot.session_id!
  try { await resolveToVerify(slot.session_id!, doneIt, slot.date); await plan.load() } catch (e) { toast.error(e) } finally { busySlot.value = null }
}

async function catchUp(slot: (typeof plan.schedule)[number]) {
  if (plan.inProgress) return router.push(`/seance/${plan.inProgress.id}`)
  try {
    const s = await startSession(plannedOf(slot.slot.week_number, slot.slot.day_of_week), plan.active!.plan.id, slot.date)
    await router.push(`/seance/${s.id}`)
  } catch (e) { toast.error(e) }
}

async function skip(slot: (typeof plan.schedule)[number]) {
  busySlot.value = `${slot.slot.week_number}-${slot.slot.day_of_week}`
  try { await skipSlot(plannedOf(slot.slot.week_number, slot.slot.day_of_week), plan.active!.plan.id, slot.date); await plan.load() } catch (e) { toast.error(e) } finally { busySlot.value = null }
}

function start() {
  if (next.value?.session_id) router.push(`/seance/${next.value.session_id}`)
  else router.push('/seance')
}
</script>

<template>
  <div>
    <header class="mb-6">
      <p class="text-muted">{{ formatDay(new Date().toISOString()) }}</p>
      <h1 class="font-display text-4xl font-semibold leading-tight">Bonjour {{ firstName }}</h1>
    </header>

    <div v-if="loading" class="space-y-4" aria-busy="true">
      <div class="h-56 animate-pulse rounded-3xl bg-surface-2" />
      <div class="grid grid-cols-2 gap-3"><div class="h-28 animate-pulse rounded-2xl bg-surface-2" /><div class="h-28 animate-pulse rounded-2xl bg-surface-2" /></div>
    </div>

    <template v-else-if="plan.active">
      <!-- Séance du jour -->
      <section class="relative overflow-hidden rounded-3xl bg-slate-ink p-6 text-chalk" aria-labelledby="next-title">
        <svg viewBox="0 0 200 200" class="pointer-events-none absolute -right-16 -top-16 w-56 opacity-90" aria-hidden="true">
          <circle cx="100" cy="100" r="96" fill="#2d4fd8" /><circle cx="100" cy="100" r="70" fill="none" stroke="#f4f5f2" stroke-opacity=".18" stroke-width="2" />
          <circle cx="100" cy="100" r="18" fill="#f5b800" /><circle cx="100" cy="100" r="8" fill="#1d262b" />
        </svg>
        <template v-if="next">
          <p class="relative text-sm font-medium text-chalk/70">{{ nextLabel }} · semaine {{ next.slot.week_number }}</p>
          <h2 id="next-title" class="relative mt-1 max-w-[70%] font-display text-5xl font-semibold leading-[0.95]">{{ next.planned.title }}</h2>
          <p class="relative mt-2 text-sm text-chalk/70">{{ next.planned.planned_exercises.length }} exercices · {{ next.planned.focus }}</p>
          <ul class="relative mt-4 flex flex-wrap gap-1.5">
            <li v-for="e in next.planned.planned_exercises.slice(0, 6)" :key="e.id" class="rounded-lg bg-white/10 px-2.5 py-1 text-xs">
              {{ catalog.byId.get(e.exercise_id)?.name }} <span class="text-chalk/60">{{ formatTarget(e) }}</span>
            </li>
          </ul>
          <AppButton variant="energy" size="lg" block class="relative mt-6" @click="start">
            <Play class="size-5" aria-hidden="true" />{{ next.status === 'in_progress' ? 'Reprendre ma séance' : 'Commencer ma séance' }}
          </AppButton>
        </template>
        <template v-else>
          <h2 id="next-title" class="relative font-display text-4xl font-semibold">Programme terminé</h2>
          <p class="relative mt-2 max-w-[70%] text-chalk/70">Bravo pour ces semaines de travail. Demandez au coach un bilan et la suite.</p>
          <AppButton variant="energy" class="relative mt-5" @click="router.push('/coach')">Faire le bilan</AppButton>
        </template>
      </section>

      <!-- Continuité : séances à vérifier, manquées, propositions en attente -->
      <section v-if="toVerify.length || recentMissed.length || pending.length" class="mt-4 flex flex-col gap-3" aria-label="À traiter">
        <div v-for="s in toVerify" :key="s.session_id" class="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <p class="text-sm text-muted">{{ formatDay(s.date) }} · ancien suivi</p>
          <p class="font-semibold">{{ s.slot.title }} : séance à vérifier</p>
          <p class="mt-0.5 text-sm text-muted">Sa réalisation n’est pas confirmée. Aucune performance n’a été inventée.</p>
          <div class="mt-3 flex gap-2">
            <AppButton size="sm" :loading="busySlot === s.session_id" @click="verify(s, true)">Elle a été faite</AppButton>
            <AppButton size="sm" variant="secondary" :disabled="busySlot === s.session_id" @click="verify(s, false)">Non réalisée</AppButton>
          </div>
        </div>
        <div v-for="s in recentMissed" :key="`${s.slot.week_number}-${s.slot.day_of_week}`" class="rounded-2xl border border-bad/30 bg-surface p-4">
          <p class="text-sm text-muted">{{ formatDay(s.date) }} · semaine {{ s.slot.week_number }}</p>
          <p class="font-semibold">{{ s.slot.title }} : séance manquée</p>
          <p class="mt-0.5 text-sm text-muted">Le programme continue normalement. Vous pouvez la rattraper ou la passer.</p>
          <div class="mt-3 flex gap-2">
            <AppButton size="sm" @click="catchUp(s)">La faire maintenant</AppButton>
            <AppButton size="sm" variant="secondary" :loading="busySlot === `${s.slot.week_number}-${s.slot.day_of_week}`" @click="skip(s)">Ne pas la faire</AppButton>
          </div>
        </div>
        <RecommendationCard v-for="(r, i) in pending" :key="r.id" :rec="r" @updated="(u) => (pending[i] = u)" />
      </section>

      <!-- Programme -->
      <section class="mt-4 rounded-2xl bg-surface p-5" aria-labelledby="plan-title">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="plan-title" class="font-semibold">{{ plan.active.plan.name }}</h2>
          <RouterLink to="/programme" class="shrink-0 text-sm font-medium text-accent">Voir</RouterLink>
        </div>
        <p class="mt-0.5 text-sm text-muted">Semaine {{ plan.currentWeek }} sur {{ plan.active.plan.weeks }} — {{ PHASE_LABELS[phaseOfWeek(plan.currentWeek, plan.active.plan.weeks)] }}</p>
        <div class="mt-4 flex gap-1" role="img" :aria-label="`${done} séances faites sur ${total}`">
          <span v-for="s in plan.schedule" :key="`${s.slot.week_number}-${s.slot.day_of_week}`" class="h-2.5 flex-1 rounded-full"
            :class="SLOT_DOT[s.status]" />
        </div>
        <div class="mt-4 flex gap-6">
          <p><span class="tabular font-display text-3xl font-semibold">{{ done }}</span><span class="text-muted">/{{ total }}</span><span class="block text-xs text-muted">séances faites</span></p>
          <p><span class="tabular font-display text-3xl font-semibold">{{ plan.completed.length }}</span><span class="block text-xs text-muted">au total</span></p>
          <p v-if="missed"><span class="tabular font-display text-3xl font-semibold text-bad">{{ missed }}</span><span class="block text-xs text-muted">{{ missed > 1 ? 'manquées' : 'manquée' }}</span></p>
        </div>
      </section>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <!-- Dernière séance -->
        <section class="rounded-2xl bg-surface p-5" aria-labelledby="last-title">
          <h2 id="last-title" class="font-semibold">Dernière séance</h2>
          <RouterLink v-if="lastSession" :to="`/seance/${lastSession.id}/bilan`" class="mt-2 block">
            <p class="font-display text-2xl font-semibold">{{ lastSession.title }}</p>
            <p class="text-sm text-muted">{{ formatDay(lastSession.completed_at!) }}<template v-if="lastDuration"> · {{ formatDuration(lastDuration) }}</template></p>
          </RouterLink>
          <p v-else class="mt-2 text-sm text-muted">Aucune séance terminée pour l’instant.</p>
        </section>

        <!-- Indicateurs corporels -->
        <section class="rounded-2xl bg-surface p-5" aria-labelledby="body-title">
          <div class="flex items-baseline justify-between">
            <h2 id="body-title" class="font-semibold">Indicateurs corporels</h2>
            <RouterLink to="/progression#mesures" class="text-sm font-medium text-accent">Ajouter</RouterLink>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p class="tabular font-display text-3xl font-semibold">{{ weight ? formatKg(weight.value) : '—' }}</p>
              <p class="text-xs text-muted">Poids<template v-if="weight?.delta != null"> · {{ weight.delta > 0 ? '+' : '' }}{{ weight.delta }} kg</template></p>
            </div>
            <div>
              <p class="tabular font-display text-3xl font-semibold">{{ waist ? `${waist.value} cm` : '—' }}</p>
              <p class="text-xs text-muted">Tour de taille<template v-if="waist?.delta != null"> · {{ waist.delta > 0 ? '+' : '' }}{{ waist.delta }} cm</template></p>
            </div>
          </div>
        </section>
      </div>

      <!-- Exercices importants -->
      <section v-if="keyLifts.length" class="mt-4 rounded-2xl bg-surface p-5" aria-labelledby="lifts-title">
        <h2 id="lifts-title" class="font-semibold">Exercices principaux</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="k in keyLifts" :key="k.exercise!.id">
            <RouterLink :to="`/exercices/${k.exercise!.slug}`" class="flex items-center gap-3 py-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-full"
                :class="{ 'bg-good/15 text-good': k.cmp.trend === 'progression', 'bg-bad/15 text-bad': k.cmp.trend === 'regression', 'bg-surface-2 text-muted': k.cmp.trend === 'stable' || k.cmp.trend === 'first' }">
                <TrendingUp v-if="k.cmp.trend === 'progression'" class="size-5" aria-hidden="true" />
                <TrendingDown v-else-if="k.cmp.trend === 'regression'" class="size-5" aria-hidden="true" />
                <Flat v-else class="size-5" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ k.exercise!.name }}</span>
                <span class="block text-sm text-muted">{{ k.cmp.explanation }}</span>
              </span>
              <span class="tabular shrink-0 text-right font-display text-xl font-semibold">{{ k.last.reps_by_set.join(' · ') }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- Dernière recommandation -->
      <section class="mt-4 rounded-2xl border border-line p-5" aria-labelledby="rec-title">
        <div class="flex items-center gap-2">
          <Sparkles class="size-5 text-accent" aria-hidden="true" />
          <h2 id="rec-title" class="font-semibold">Dernier conseil du coach</h2>
        </div>
        <template v-if="lastRec">
          <p class="mt-2 font-medium">{{ lastRec.title }}</p>
          <p class="mt-1 line-clamp-3 text-sm text-muted">{{ lastRec.summary }}</p>
          <p class="mt-2 text-xs text-muted">{{ formatShort(lastRec.created_at) }}<template v-if="lastRec.status === 'pending'"> · en attente de votre décision</template></p>
          <RouterLink to="/coach" class="mt-3 inline-block text-sm font-medium text-accent">Ouvrir le coach</RouterLink>
        </template>
        <p v-else class="mt-2 text-sm text-muted">Terminez une séance pour obtenir une première analyse, ou posez une question au coach.</p>
      </section>
    </template>

    <EmptyState v-else title="Aucun programme actif" text="Créez un programme adapté à votre profil et à votre matériel.">
      <AppButton @click="router.push('/profil#programme')">Créer un programme</AppButton>
    </EmptyState>
  </div>
</template>
