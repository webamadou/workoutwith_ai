// Moteur de progression déterministe. Aucune IA ici : l'IA s'appuie sur ces résultats.
import { mondayOf, plannedDate, toISODate, type ISODate } from '../dates'

export interface SetRecord {
  workout_session_id: string
  exercise_id: string
  set_number: number
  reps: number | null
  duration_s: number | null
  load_kg: number | null
  difficulty: number | null
  pain: boolean
  completed_at: string
  technique?: Record<string, unknown>
  note?: string | null
  pain_note?: string | null
}

export interface SessionRecord {
  id: string
  status: 'planned' | 'in_progress' | 'completed' | 'abandoned' | 'skipped' | 'to_verify'
  started_at: string | null
  completed_at: string | null
  week_number?: number | null
  day_of_week?: number | null
  perceived_difficulty?: number | null
}

export interface ExercisePerformance {
  session_id: string
  date: string
  sets: number
  total_reps: number
  best_reps: number
  total_duration_s: number
  max_load_kg: number | null
  tonnage_kg: number
  avg_difficulty: number | null
  pain: boolean
  reps_by_set: number[]
}

const round1 = (n: number) => Math.round(n * 10) / 10
const num = (n: number | string | null | undefined) => (n == null ? null : Number(n))

/** Volume d'une série : charge × répétitions (0 pour le poids du corps). */
export function setTonnage(s: Pick<SetRecord, 'reps' | 'load_kg'>): number {
  const load = num(s.load_kg) ?? 0
  return load > 0 && s.reps ? load * s.reps : 0
}

export function summarizeExercise(sets: SetRecord[]): ExercisePerformance {
  const sorted = [...sets].sort((a, b) => a.set_number - b.set_number)
  const loads = sorted.map((s) => num(s.load_kg)).filter((l): l is number => l != null && l > 0)
  const diffs = sorted.map((s) => s.difficulty).filter((d): d is number => d != null)
  return {
    session_id: sorted[0]?.workout_session_id ?? '',
    date: sorted.at(-1)?.completed_at ?? '',
    sets: sorted.length,
    total_reps: sorted.reduce((n, s) => n + (s.reps ?? 0), 0),
    best_reps: Math.max(0, ...sorted.map((s) => s.reps ?? 0)),
    total_duration_s: sorted.reduce((n, s) => n + (s.duration_s ?? 0), 0),
    max_load_kg: loads.length ? Math.max(...loads) : null,
    tonnage_kg: round1(sorted.reduce((n, s) => n + setTonnage(s), 0)),
    avg_difficulty: diffs.length ? round1(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null,
    pain: sorted.some((s) => s.pain),
    reps_by_set: sorted.map((s) => s.reps ?? s.duration_s ?? 0),
  }
}

export interface SessionSummary {
  sets: number
  reps: number
  duration_s: number
  tonnage_kg: number
  exercises: number
  avg_difficulty: number | null
  pain_reports: number
  elapsed_s: number | null
}

export function summarizeSession(sets: SetRecord[], session?: Pick<SessionRecord, 'started_at' | 'completed_at'>): SessionSummary {
  const diffs = sets.map((s) => s.difficulty).filter((d): d is number => d != null)
  const elapsed = session?.started_at && session.completed_at
    ? Math.max(0, Math.round((Date.parse(session.completed_at) - Date.parse(session.started_at)) / 1000))
    : null
  return {
    sets: sets.length,
    reps: sets.reduce((n, s) => n + (s.reps ?? 0), 0),
    duration_s: sets.reduce((n, s) => n + (s.duration_s ?? 0), 0),
    tonnage_kg: round1(sets.reduce((n, s) => n + setTonnage(s), 0)),
    exercises: new Set(sets.map((s) => s.exercise_id)).size,
    avg_difficulty: diffs.length ? round1(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null,
    pain_reports: sets.filter((s) => s.pain).length,
    elapsed_s: elapsed,
  }
}

/** Historique d'un exercice : une entrée par séance, de la plus ancienne à la plus récente. */
export function exerciseHistory(sets: SetRecord[], exerciseId: string): ExercisePerformance[] {
  const bySession = new Map<string, SetRecord[]>()
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue
    bySession.set(s.workout_session_id, [...(bySession.get(s.workout_session_id) ?? []), s])
  }
  return [...bySession.values()].map(summarizeExercise).sort((a, b) => a.date.localeCompare(b.date))
}

export type Trend = 'progression' | 'regression' | 'stable' | 'first'

export interface Comparison {
  trend: Trend
  delta_reps: number
  delta_load_kg: number | null
  delta_tonnage_kg: number
  delta_duration_s: number
  explanation: string
}

/** Compare deux séances d'un même exercice. */
export function comparePerformances(prev: ExercisePerformance | undefined, curr: ExercisePerformance): Comparison {
  if (!prev) {
    return { trend: 'first', delta_reps: 0, delta_load_kg: null, delta_tonnage_kg: 0, delta_duration_s: 0, explanation: 'Première séance enregistrée pour cet exercice.' }
  }
  const dReps = curr.total_reps - prev.total_reps
  const dDur = curr.total_duration_s - prev.total_duration_s
  const dLoad = curr.max_load_kg != null && prev.max_load_kg != null ? round1(curr.max_load_kg - prev.max_load_kg) : null
  const dTon = round1(curr.tonnage_kg - prev.tonnage_kg)
  const base = { delta_reps: dReps, delta_load_kg: dLoad, delta_tonnage_kg: dTon, delta_duration_s: dDur }

  if (dLoad != null && dLoad > 0 && curr.total_reps >= prev.total_reps * 0.8) {
    return { ...base, trend: 'progression', explanation: `Charge en hausse de ${dLoad} kg avec un volume de répétitions maintenu.` }
  }
  if (dLoad != null && dLoad < 0) {
    return { ...base, trend: 'regression', explanation: `Charge en baisse de ${Math.abs(dLoad)} kg.` }
  }
  const prevQty = prev.total_reps || prev.total_duration_s
  const currQty = curr.total_reps || curr.total_duration_s
  const delta = currQty - prevQty
  const unit = curr.total_reps ? 'répétitions' : 'secondes'
  if (prevQty > 0 && delta / prevQty >= 0.05 && delta >= 2) {
    return { ...base, trend: 'progression', explanation: `+${delta} ${unit} au total (${prevQty} → ${currQty}).` }
  }
  if (prevQty > 0 && delta / prevQty <= -0.1) {
    return { ...base, trend: 'regression', explanation: `${delta} ${unit} au total (${prevQty} → ${currQty}).` }
  }
  return { ...base, trend: 'stable', explanation: `Volume comparable (${prevQty} → ${currQty} ${unit}).` }
}

export interface Target {
  sets: number
  reps_min?: number | null
  reps_max?: number | null
  duration_s?: number | null
  load_kg?: number | null
}

export type SuggestionAction = 'increase_load' | 'increase_reps' | 'hold' | 'reduce' | 'no_data'

export interface Suggestion {
  action: SuggestionAction
  message: string
  facts: Record<string, unknown>
}

/**
 * Double progression prudente :
 * - douleur → réduire et consulter si elle persiste ;
 * - toutes les séries au haut de la fourchette avec une difficulté ≤ 3/5 → augmenter ;
 * - sinon → stabiliser dans la fourchette.
 */
export function suggestNext(history: ExercisePerformance[], target: Target, loadIncrementKg = 1): Suggestion {
  const last = history.at(-1)
  if (!last) return { action: 'no_data', message: 'Pas encore de données : choisir une charge confortable et garder 2 à 3 répétitions en réserve.', facts: {} }
  const facts: Record<string, unknown> = {
    last_reps_by_set: last.reps_by_set, last_total_reps: last.total_reps, last_load_kg: last.max_load_kg,
    last_avg_difficulty: last.avg_difficulty, target,
  }
  if (last.pain) {
    return { action: 'reduce', message: 'Une douleur a été signalée : réduire l’amplitude ou la charge, ou remplacer l’exercice. Consulter un professionnel de santé si la douleur persiste.', facts }
  }
  const prev = history.at(-2)
  if (prev && comparePerformances(prev, last).trend === 'regression' && history.length >= 3
    && comparePerformances(history.at(-3), prev).trend === 'regression') {
    return { action: 'reduce', message: 'Deux baisses consécutives : alléger la prochaine séance et vérifier la récupération (sommeil, fatigue).', facts }
  }
  const values = last.reps_by_set
  const hi = target.reps_max ?? target.duration_s ?? null
  const lo = target.reps_min ?? target.duration_s ?? null
  const easy = last.avg_difficulty == null || last.avg_difficulty <= 3
  const allAtTop = hi != null && last.sets >= target.sets && values.every((v) => v >= hi)
  if (allAtTop && easy) {
    if (last.max_load_kg != null) {
      const next = round1(last.max_load_kg + loadIncrementKg)
      return { action: 'increase_load', message: `Toutes les séries au haut de la fourchette : passer à ${next} kg et revenir vers ${lo ?? hi} répétitions.`, facts: { ...facts, next_load_kg: next } }
    }
    return { action: 'increase_reps', message: target.duration_s ? 'Objectif de durée atteint : ajouter 5 secondes par série.' : 'Objectif atteint : ajouter 1 à 2 répétitions par série ou choisir une variante plus difficile.', facts }
  }
  if (lo != null && values.some((v) => v < lo)) {
    return { action: 'hold', message: `Certaines séries sont sous ${lo} : stabiliser autour de ${target.sets} × ${lo}–${hi} avant d’augmenter la difficulté.`, facts }
  }
  return { action: 'hold', message: `Dans la fourchette : consolider ${target.sets} × ${lo}–${hi} jusqu’à atteindre le haut sur toutes les séries.`, facts }
}

export interface PlannedSlot {
  week_number: number
  day_of_week: number
  title: string
}

export interface ScheduleStatus {
  slot: PlannedSlot
  date: ISODate
  status: 'done' | 'missed' | 'today' | 'upcoming' | 'in_progress' | 'before_start' | 'to_verify' | 'skipped'
  session_id?: string
}

/**
 * Situe chaque séance prévue : faite, en cours, à vérifier, non réalisée (choix de l'utilisateur), manquée,
 * aujourd'hui, à venir, ou antérieure au début du programme. Une séance manquée ne décale ni ne réinitialise rien.
 */
export function scheduleStatus(
  planStart: ISODate, slots: PlannedSlot[], sessions: SessionRecord[], today: ISODate = toISODate(new Date()),
): ScheduleStatus[] {
  const key = (w: number, d: number) => `${w}-${d}`
  // Priorité quand plusieurs séances pointent vers le même créneau.
  const rank: Partial<Record<SessionRecord['status'], number>> = { completed: 4, in_progress: 3, to_verify: 2, skipped: 1 }
  const best = new Map<string, SessionRecord>()
  for (const s of sessions) {
    if (s.week_number == null || s.day_of_week == null || !rank[s.status]) continue
    const k = key(s.week_number, s.day_of_week)
    if (!best.has(k) || rank[s.status]! > rank[best.get(k)!.status]!) best.set(k, s)
  }
  const map = { completed: 'done', in_progress: 'in_progress', to_verify: 'to_verify', skipped: 'skipped' } as const
  return [...slots]
    .sort((a, b) => a.week_number - b.week_number || a.day_of_week - b.day_of_week)
    .map((slot) => {
      const date = plannedDate(planStart, slot.week_number, slot.day_of_week)
      const k = key(slot.week_number, slot.day_of_week)
      const s = best.get(k)
      if (s) return { slot, date, status: map[s.status as keyof typeof map], session_id: s.id }
      if (date < planStart) return { slot, date, status: 'before_start' as const } // avant le début choisi
      if (date < today) return { slot, date, status: 'missed' as const }
      return { slot, date, status: date === today ? 'today' as const : 'upcoming' as const }
    })
}

/** Prochaine séance à faire : en cours, sinon aujourd'hui, sinon la plus proche à venir. */
export function nextSession(statuses: ScheduleStatus[]): ScheduleStatus | undefined {
  return statuses.find((s) => s.status === 'in_progress')
    ?? statuses.find((s) => s.status === 'today')
    ?? statuses.find((s) => s.status === 'upcoming')
}

export interface WeekStat {
  week_start: ISODate
  sessions: number
  sets: number
  reps: number
  tonnage_kg: number
}

/** Régularité et volume par semaine calendaire (lundi). */
export function weeklyStats(sessions: SessionRecord[], sets: SetRecord[], weeks = 8, today: ISODate = toISODate(new Date())): WeekStat[] {
  const start = mondayOf(today)
  const out: WeekStat[] = []
  const completed = new Map(sessions.filter((s) => s.status === 'completed').map((s) => [s.id, s]))
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = toISODate(new Date(new Date(start + 'T00:00:00').getTime() - i * 7 * 86_400_000))
    out.push({ week_start: ws, sessions: 0, sets: 0, reps: 0, tonnage_kg: 0 })
  }
  const idx = new Map(out.map((w, i) => [w.week_start, i]))
  for (const s of completed.values()) {
    const i = idx.get(mondayOf(toISODate(new Date(s.completed_at!))))
    if (i != null) out[i].sessions++
  }
  for (const set of sets) {
    if (!completed.has(set.workout_session_id)) continue
    const i = idx.get(mondayOf(toISODate(new Date(set.completed_at))))
    if (i == null) continue
    out[i].sets++
    out[i].reps += set.reps ?? 0
    out[i].tonnage_kg = round1(out[i].tonnage_kg + setTonnage(set))
  }
  return out
}

/** Séries par groupe musculaire (1 pour le principal, 0,5 pour les secondaires). */
export function volumeByMuscle(
  sets: SetRecord[], exercises: Map<string, { primary_muscle: string; secondary_muscles: string[] }>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    const ex = exercises.get(s.exercise_id)
    if (!ex) continue
    out[ex.primary_muscle] = (out[ex.primary_muscle] ?? 0) + 1
    for (const m of ex.secondary_muscles) out[m] = (out[m] ?? 0) + 0.5
  }
  return out
}
