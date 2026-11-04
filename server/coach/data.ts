// Chargement des données de l'utilisateur connecté (client Supabase à son nom : RLS appliquée).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/database.types'
import type { PlanDraft } from '../../shared/program/types'
import type { ExerciseInfo } from '../../shared/program/types'
import type { SessionRecord, SetRecord } from '../../shared/progression/engine'
import { planWeekOf, toISODate } from '../../shared/dates'

export type DB = SupabaseClient<Database>
type Tables = Database['public']['Tables']
type Row<K extends keyof Tables> = Tables[K]['Row']

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export interface UserData {
  userId: string
  profile: Row<'profiles'>
  equipment: Row<'user_equipment'>[]
  measurements: Row<'body_measurements'>[]
  exercises: Row<'exercises'>[]
  exById: Map<string, Row<'exercises'>>
  exBySlug: Map<string, Row<'exercises'>>
  infos: ExerciseInfo[]
  plan: (Row<'workout_plans'> & { version_number: number; version_created_at: string }) | null
  draft: PlanDraft | null
  plannedSessions: (Row<'planned_sessions'> & { planned_exercises: Row<'planned_exercises'>[] })[]
  sessions: (Row<'workout_sessions'> & { planned_sessions: { week_number: number; day_of_week: number } | null })[]
  sets: Row<'performed_sets'>[]
  recommendations: Pick<Row<'coach_recommendations'>, 'title' | 'status' | 'source' | 'kind' | 'created_at' | 'decided_at'>[]
  lastCoachChangeAt: string | null
  currentWeek: number
  today: string
}

export async function loadUserData(db: DB, userId: string, setsSinceDays = 180): Promise<UserData> {
  const since = new Date(Date.now() - setsSinceDays * 86_400_000).toISOString()
  const [profile, equipment, measurements, exercises, plan, sessions, sets, recommendations] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single().then(must),
    db.from('user_equipment').select('*').then(must),
    db.from('body_measurements').select('*').order('measured_on').then(must),
    db.from('exercises').select('*').then(must),
    db.from('workout_plans').select('*').eq('status', 'active').maybeSingle().then(must),
    db.from('workout_sessions').select('*, planned_sessions(week_number, day_of_week)').order('started_at', { ascending: false, nullsFirst: false }).limit(200).then(must),
    db.from('performed_sets').select('*').gte('completed_at', since).order('completed_at').then(must),
    db.from('coach_recommendations').select('title, status, source, kind, created_at, decided_at').order('created_at', { ascending: false }).limit(8).then(must),
  ])
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const exBySlug = new Map(exercises.map((e) => [e.slug, e]))
  let plannedSessions: UserData['plannedSessions'] = []
  let planOut: UserData['plan'] = null
  let lastCoachChangeAt: string | null = null
  if (plan?.current_version_id) {
    const [version, ps, versions] = await Promise.all([
      db.from('workout_plan_versions').select('*').eq('id', plan.current_version_id).single().then(must),
      db.from('planned_sessions').select('*, planned_exercises(*)').eq('plan_version_id', plan.current_version_id).order('week_number').order('day_of_week').then(must),
      db.from('workout_plan_versions').select('created_at, source').eq('plan_id', plan.id).eq('source', 'coach').order('created_at', { ascending: false }).limit(1).then(must),
    ])
    plannedSessions = ps
    for (const s of plannedSessions) s.planned_exercises.sort((a, b) => a.position - b.position)
    planOut = { ...plan, version_number: version.version_number, version_created_at: version.created_at }
    lastCoachChangeAt = versions[0]?.created_at ?? null
  }
  const today = toISODate(new Date())
  const draft: PlanDraft | null = planOut ? {
    name: planOut.name, goal: planOut.goal ?? '', weeks: planOut.weeks,
    sessions: plannedSessions.map((s) => ({
      week_number: s.week_number, day_of_week: s.day_of_week, title: s.title, focus: s.focus ?? '',
      exercises: s.planned_exercises.map((e) => ({
        exercise_slug: exById.get(e.exercise_id)?.slug ?? e.exercise_id, sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max,
        duration_s: e.duration_s, rest_s: e.rest_s, load_kg: e.load_kg == null ? null : Number(e.load_kg), notes: e.notes,
      })),
    })),
  } : null
  return {
    userId, profile, equipment, measurements, exercises, exById, exBySlug,
    infos: exercises.map((e) => ({ ...e, measurement: e.measurement as 'reps' | 'duration' })),
    plan: planOut, draft, plannedSessions, sessions, sets, recommendations, lastCoachChangeAt, today,
    currentWeek: planOut ? Math.min(Math.max(planWeekOf(planOut.start_date, today), 1), planOut.weeks) : 1,
  }
}

export const toSetRecords = (sets: Row<'performed_sets'>[]): SetRecord[] =>
  sets.map((s) => ({ ...s, load_kg: s.load_kg == null ? null : Number(s.load_kg), technique: s.technique as Record<string, unknown> }))

export const toSessionRecords = (d: UserData): SessionRecord[] =>
  d.sessions.filter((s) => s.plan_id === d.plan?.id).map((s) => ({
    id: s.id, status: s.status, started_at: s.started_at, completed_at: s.completed_at,
    week_number: s.planned_sessions?.week_number ?? null, day_of_week: s.planned_sessions?.day_of_week ?? null,
  }))
