import { supabase, unwrap, unwrapMaybe } from '@/lib/supabase'
import type { PlanDraft } from '@shared/program/types'
import type { ActivePlan, Exercise, PlannedSession, PlanVersion } from './types'

export async function fetchActivePlan(): Promise<ActivePlan | null> {
  const plan = unwrapMaybe(await supabase.from('workout_plans').select('*').eq('status', 'active').maybeSingle())
  if (!plan?.current_version_id) return null
  const [version, sessions] = await Promise.all([
    supabase.from('workout_plan_versions').select('*').eq('id', plan.current_version_id).single().then(unwrap),
    supabase.from('planned_sessions').select('*, planned_exercises(*)').eq('plan_version_id', plan.current_version_id)
      .order('week_number').order('day_of_week').then(unwrap),
  ])
  for (const s of sessions) s.planned_exercises.sort((a, b) => a.position - b.position)
  return { plan, version, sessions: sessions as PlannedSession[] }
}

export async function fetchPlanVersions(planId: string): Promise<PlanVersion[]> {
  return unwrap(await supabase.from('workout_plan_versions').select('*').eq('plan_id', planId).order('version_number', { ascending: false }))
}

/** Convertit une version stockée en brouillon manipulable par les ajustements. */
export function toDraft(active: ActivePlan, exercisesById: Map<string, Exercise>): PlanDraft {
  return {
    name: active.plan.name,
    goal: active.plan.goal ?? '',
    weeks: active.plan.weeks,
    sessions: active.sessions.map((s) => ({
      week_number: s.week_number, day_of_week: s.day_of_week, title: s.title, focus: s.focus ?? '',
      exercises: s.planned_exercises.map((e) => ({
        exercise_slug: exercisesById.get(e.exercise_id)?.slug ?? e.exercise_id,
        sets: e.sets, reps_min: e.reps_min, reps_max: e.reps_max, duration_s: e.duration_s,
        rest_s: e.rest_s, load_kg: e.load_kg == null ? null : Number(e.load_kg), notes: e.notes,
      })),
    })),
  }
}

function sessionsPayload(draft: PlanDraft, exercisesBySlug: Map<string, Exercise>) {
  return draft.sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map(({ exercise_slug, ...e }) => {
      const ex = exercisesBySlug.get(exercise_slug)
      if (!ex) throw new Error(`Exercice inconnu : ${exercise_slug}`)
      return { exercise_id: ex.id, ...e }
    }),
  }))
}

export async function createPlan(draft: PlanDraft, startDate: string, exercisesBySlug: Map<string, Exercise>, summary?: string) {
  return unwrap(await supabase.rpc('create_workout_plan', {
    p_name: draft.name, p_goal: draft.goal, p_start_date: startDate, p_weeks: draft.weeks,
    p_sessions: sessionsPayload(draft, exercisesBySlug), p_change_summary: summary ?? 'Programme initial',
  }))
}

export async function createVersion(
  planId: string, draft: PlanDraft, exercisesBySlug: Map<string, Exercise>,
  source: 'user' | 'coach' | 'rules', summary: string, recommendationId?: string,
) {
  return unwrap(await supabase.rpc('create_plan_version', {
    p_plan_id: planId, p_sessions: sessionsPayload(draft, exercisesBySlug), p_source: source,
    p_change_summary: summary, p_recommendation_id: recommendationId,
  }))
}
