import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchActivePlan } from '@/services/program'
import { fetchSessions } from '@/services/workout'
import type { ActivePlan } from '@/services/types'
import { nextSession, scheduleStatus, type SessionRecord } from '@shared/progression/engine'
import { planWeekOf, toISODate } from '@shared/dates'
import { toDraft } from '@/services/program'
import { useCatalogStore } from './catalog'
import { useAuthStore } from './auth'
import type { PerformedSet } from '@/services/types'
import type { ContinuityInput } from '@shared/progression/continuity'

type SessionRow = Awaited<ReturnType<typeof fetchSessions>>[number]

/** Programme actif + historique des séances, partagés entre tableau de bord, programme et progression. */
export const usePlanStore = defineStore('plan', () => {
  const active = ref<ActivePlan | null>(null)
  const sessions = ref<SessionRow[]>([])
  const loaded = ref(false)

  async function load() {
    const [a, s] = await Promise.all([fetchActivePlan(), fetchSessions()])
    active.value = a
    sessions.value = s
    loaded.value = true
  }

  const sessionRecords = computed<SessionRecord[]>(() => sessions.value
    .filter((s) => s.plan_id === active.value?.plan.id)
    .map((s) => ({
      id: s.id, status: s.status, started_at: s.started_at, completed_at: s.completed_at,
      week_number: s.planned_sessions?.week_number ?? null, day_of_week: s.planned_sessions?.day_of_week ?? null,
      perceived_difficulty: s.perceived_difficulty,
    })))

  const schedule = computed(() => {
    if (!active.value) return []
    return scheduleStatus(active.value.plan.start_date, active.value.sessions, sessionRecords.value, toISODate(new Date()))
  })

  const next = computed(() => {
    const n = nextSession(schedule.value)
    if (!n || !active.value) return null
    const planned = active.value.sessions.find((s) => s.week_number === n.slot.week_number && s.day_of_week === n.slot.day_of_week)!
    return { ...n, planned }
  })

  const currentWeek = computed(() => {
    if (!active.value) return 1
    return Math.min(Math.max(planWeekOf(active.value.plan.start_date, toISODate(new Date())), 1), active.value.plan.weeks)
  })

  const completed = computed(() => sessions.value.filter((s) => s.status === 'completed'))
  const inProgress = computed(() => sessions.value.find((s) => s.status === 'in_progress') ?? null)

  /** Données nécessaires aux propositions de continuité (catalogue chargé au préalable). */
  function continuityInput(sets: PerformedSet[], ownedEquipment: string[]): ContinuityInput | null {
    const catalog = useCatalogStore()
    const auth = useAuthStore()
    if (!active.value || !catalog.exercises.length) return null
    return {
      draft: toDraft(active.value, catalog.byId), currentWeek: currentWeek.value,
      exercises: catalog.infos.map((e) => ({ ...e, id: e.id! })), ownedEquipment,
      avoidedSlugs: (auth.profile?.avoided_exercise_ids ?? []).map((id) => catalog.byId.get(id)?.slug).filter(Boolean) as string[],
      sessions: sessions.value.map((s) => ({ id: s.id, status: s.status, started_at: s.started_at, completed_at: s.completed_at })),
      sets: sets.map((s) => ({ ...s, load_kg: s.load_kg == null ? null : Number(s.load_kg) })),
    }
  }

  return { active, sessions, loaded, load, schedule, next, currentWeek, completed, inProgress, sessionRecords, continuityInput }
})
