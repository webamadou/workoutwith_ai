import { supabase, unwrap, unwrapMaybe } from '@/lib/supabase'
import type { Insert, PerformedSet, PlannedSession, WorkoutSession } from './types'

export type SetInput = Omit<Insert<'performed_sets'>, 'user_id' | 'id' | 'technique'> & {
  technique?: Record<string, unknown>
  workout_session_id: string; exercise_id: string; set_number: number
}

export async function fetchInProgressSession(): Promise<WorkoutSession | null> {
  return unwrapMaybe(await supabase.from('workout_sessions').select('*').eq('status', 'in_progress').maybeSingle())
}

export async function fetchSession(id: string) {
  const session = unwrap(await supabase.from('workout_sessions').select('*').eq('id', id).single())
  const sets = unwrap(await supabase.from('performed_sets').select('*').eq('workout_session_id', id).order('completed_at')) as PerformedSet[]
  let planned: PlannedSession | null = null
  if (session.planned_session_id) {
    planned = unwrapMaybe(await supabase.from('planned_sessions').select('*, planned_exercises(*)').eq('id', session.planned_session_id).maybeSingle()) as PlannedSession | null
    planned?.planned_exercises.sort((a, b) => a.position - b.position)
  }
  return { session, sets, planned }
}

export async function startSession(planned: PlannedSession, planId: string, scheduledFor: string): Promise<WorkoutSession> {
  return unwrap(await supabase.from('workout_sessions').insert({
    plan_id: planId, planned_session_id: planned.id, title: planned.title, status: 'in_progress',
    scheduled_for: scheduledFor, started_at: new Date().toISOString(),
  }).select().single())
}

export async function updateSession(id: string, patch: Partial<WorkoutSession>) {
  return unwrap(await supabase.from('workout_sessions').update(patch).eq('id', id).select().single())
}

/** Enregistrement idempotent d'une série (clé : séance + exercice + numéro). */
export async function saveSet(input: SetInput): Promise<PerformedSet> {
  return unwrap(await supabase.from('performed_sets')
    .upsert(input as never, { onConflict: 'workout_session_id,exercise_id,set_number' }).select().single()) as PerformedSet
}

export async function deleteSet(sessionId: string, exerciseId: string, setNumber: number) {
  unwrap(await supabase.from('performed_sets').delete()
    .match({ workout_session_id: sessionId, exercise_id: exerciseId, set_number: setNumber }))
}

export async function fetchSessions(limit = 200) {
  return unwrap(await supabase.from('workout_sessions')
    .select('*, planned_sessions(week_number, day_of_week)')
    .order('started_at', { ascending: false, nullsFirst: false }).limit(limit))
}

export async function fetchSets(opts: { since?: string; exerciseId?: string } = {}): Promise<PerformedSet[]> {
  let q = supabase.from('performed_sets').select('*').order('completed_at')
  if (opts.since) q = q.gte('completed_at', opts.since)
  if (opts.exerciseId) q = q.eq('exercise_id', opts.exerciseId)
  return unwrap(await q) as PerformedSet[]
}

/** Marque un créneau du programme comme non réalisé (le programme continue, rien n'est réinitialisé). */
export async function skipSlot(planned: PlannedSession, planId: string, date: string) {
  return unwrap(await supabase.from('workout_sessions').insert({
    plan_id: planId, planned_session_id: planned.id, title: planned.title, status: 'skipped', scheduled_for: date,
    comment: 'Séance non réalisée.',
  }).select().single())
}

/** Statue sur une séance « à vérifier » : réalisée (sans détail de performance) ou non réalisée. */
export async function resolveToVerify(sessionId: string, done: boolean, date: string) {
  const at = `${date}T12:00:00.000Z`
  return unwrap(await supabase.from('workout_sessions').update(done
    ? { status: 'completed', started_at: at, completed_at: at, comment: 'Réalisation confirmée (résultats non renseignés).' }
    : { status: 'skipped', comment: 'Séance de l’ancien suivi non réalisée.' }).eq('id', sessionId).eq('status', 'to_verify').select().single())
}
