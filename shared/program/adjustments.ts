// Ajustements de programme proposés (par le coach ou l'utilisateur) et garde-fous déterministes.
import { z } from 'zod'
import type { ExerciseInfo, PlanDraft, PlanExerciseDraft, PlanSessionDraft } from './types'

const scope = {
  exercise_slug: z.string().min(1),
  from_week: z.number().int().min(1).max(52),
  to_week: z.number().int().min(1).max(52).nullish(),
  day_of_week: z.number().int().min(1).max(7).nullish(),
}

export const adjustmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('update_targets'),
    ...scope,
    sets: z.number().int().min(1).max(10).nullish(),
    reps_min: z.number().int().min(1).max(100).nullish(),
    reps_max: z.number().int().min(1).max(100).nullish(),
    duration_s: z.number().int().min(5).max(600).nullish(),
    rest_s: z.number().int().min(0).max(600).nullish(),
    load_kg: z.number().min(0).max(500).nullish(),
  }),
  z.object({ type: z.literal('replace_exercise'), ...scope, new_exercise_slug: z.string().min(1) }),
  z.object({ type: z.literal('remove_exercise'), ...scope }),
])

export type Adjustment = z.infer<typeof adjustmentSchema>
export const adjustmentListSchema = z.array(adjustmentSchema).min(1).max(20)

function inScope(a: Adjustment, s: PlanSessionDraft): boolean {
  return s.week_number >= a.from_week
    && (a.to_week == null || s.week_number <= a.to_week)
    && (a.day_of_week == null || s.day_of_week === a.day_of_week)
}

/** Applique les ajustements sur une copie du programme. */
export function applyAdjustments(draft: PlanDraft, adjustments: Adjustment[], exercises: ExerciseInfo[]): PlanDraft {
  const bySlug = new Map(exercises.map((e) => [e.slug, e]))
  const next: PlanDraft = structuredClone(draft)
  for (const a of adjustments) {
    for (const s of next.sessions) {
      if (!inScope(a, s)) continue
      if (a.type === 'remove_exercise') {
        s.exercises = s.exercises.filter((e) => e.exercise_slug !== a.exercise_slug)
        continue
      }
      for (const e of s.exercises) {
        if (e.exercise_slug !== a.exercise_slug) continue
        if (a.type === 'replace_exercise') {
          const ne = bySlug.get(a.new_exercise_slug)
          if (!ne) throw new Error(`Exercice inconnu : ${a.new_exercise_slug}`)
          e.exercise_slug = ne.slug
          e.load_kg = null
          if (ne.measurement === 'duration') { e.duration_s = e.duration_s ?? 30; e.reps_min = null; e.reps_max = null }
          else { e.reps_min = e.reps_min ?? 8; e.reps_max = e.reps_max ?? 12; e.duration_s = null }
        } else {
          const patch: Partial<PlanExerciseDraft> = {}
          for (const k of ['sets', 'reps_min', 'reps_max', 'duration_s', 'rest_s', 'load_kg'] as const) {
            if (a[k] !== undefined && a[k] !== null) (patch as Record<string, number>)[k] = a[k] as number
          }
          Object.assign(e, patch)
          if (e.reps_min != null && e.reps_max != null && e.reps_min > e.reps_max) e.reps_min = e.reps_max
        }
      }
    }
  }
  return next
}

export interface GuardrailContext {
  currentWeek: number
  /** date ISO du dernier ajustement proposé par le coach et accepté */
  lastCoachChangeAt?: string | null
  now?: Date
  avoidedSlugs?: string[]
  ownedEquipment?: string[]
}

export interface GuardrailResult {
  ok: boolean
  violations: string[]
  warnings: string[]
}

export const GUARDRAILS = {
  maxWeeklySetsIncrease: 0.2, // +20 % de séries hebdomadaires au maximum
  maxLoadIncreaseRatio: 0.1, // +10 % de charge…
  maxLoadIncreaseKg: 2, // … ou +2 kg si c'est plus permissif (petites charges)
  maxRepsIncrease: 3,
  minDaysBetweenCoachChanges: 7,
}

const weeklySets = (d: PlanDraft, week: number) =>
  d.sessions.filter((s) => s.week_number === week).reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets, 0), 0)

/** Vérifie qu'une proposition reste prudente par rapport au programme courant. */
export function checkAdjustments(
  current: PlanDraft, adjustments: Adjustment[], exercises: ExerciseInfo[], ctx: GuardrailContext,
): GuardrailResult {
  const violations: string[] = []
  const warnings: string[] = []
  const bySlug = new Map(exercises.map((e) => [e.slug, e]))
  const avoided = new Set(ctx.avoidedSlugs ?? [])
  const owned = ctx.ownedEquipment ? new Set(ctx.ownedEquipment) : null

  for (const a of adjustments) {
    if (a.from_week < ctx.currentWeek) violations.push(`Les semaines passées ne peuvent pas être modifiées (semaine ${a.from_week}).`)
    if (a.to_week != null && a.to_week < a.from_week) violations.push('La semaine de fin précède la semaine de début.')
    if (!current.sessions.some((s) => inScope(a, s) && s.exercises.some((e) => e.exercise_slug === a.exercise_slug))) {
      violations.push(`« ${a.exercise_slug} » n'est pas présent dans les séances visées.`)
    }
    if (a.type === 'replace_exercise') {
      const ne = bySlug.get(a.new_exercise_slug)
      if (!ne) violations.push(`Exercice inconnu dans la bibliothèque : ${a.new_exercise_slug}.`)
      else {
        if (avoided.has(ne.slug)) violations.push(`${ne.name} fait partie des exercices à éviter.`)
        if (owned && !ne.equipment.every((k) => owned.has(k))) violations.push(`${ne.name} nécessite du matériel non disponible.`)
      }
    }
  }
  if (violations.length) return { ok: false, violations, warnings }

  let proposed: PlanDraft
  try {
    proposed = applyAdjustments(current, adjustments, exercises)
  } catch (e) {
    return { ok: false, violations: [(e as Error).message], warnings }
  }

  let increasesVolume = false
  for (let w = ctx.currentWeek; w <= current.weeks; w++) {
    const before = weeklySets(current, w)
    const after = weeklySets(proposed, w)
    if (after > before) increasesVolume = true
    if (before > 0 && (after - before) / before > GUARDRAILS.maxWeeklySetsIncrease) {
      violations.push(`Semaine ${w} : +${Math.round(((after - before) / before) * 100)} % de séries (maximum ${GUARDRAILS.maxWeeklySetsIncrease * 100} %).`)
    }
  }

  current.sessions.forEach((s, si) => {
    const ps = proposed.sessions[si]
    s.exercises.forEach((e) => {
      const pe = ps.exercises.find((x) => x.exercise_slug === e.exercise_slug)
      if (!pe) return
      if (e.load_kg != null && pe.load_kg != null && pe.load_kg > e.load_kg) {
        increasesVolume = true
        const max = Math.max(e.load_kg * (1 + GUARDRAILS.maxLoadIncreaseRatio), e.load_kg + GUARDRAILS.maxLoadIncreaseKg)
        if (pe.load_kg > max + 1e-9) violations.push(`${e.exercise_slug} (S${s.week_number}) : charge ${e.load_kg} → ${pe.load_kg} kg trop rapide.`)
      }
      if (e.reps_max != null && pe.reps_max != null && pe.reps_max - e.reps_max > GUARDRAILS.maxRepsIncrease) {
        violations.push(`${e.exercise_slug} (S${s.week_number}) : +${pe.reps_max - e.reps_max} répétitions, trop brutal.`)
      }
      if (pe.reps_max != null && e.reps_max != null && pe.reps_max > e.reps_max) increasesVolume = true
    })
  })

  if (increasesVolume && ctx.lastCoachChangeAt) {
    const days = ((ctx.now ?? new Date()).getTime() - new Date(ctx.lastCoachChangeAt).getTime()) / 86_400_000
    if (days < GUARDRAILS.minDaysBetweenCoachChanges) {
      violations.push(`Dernière augmentation acceptée il y a ${Math.floor(days)} jour(s) : attendre ${GUARDRAILS.minDaysBetweenCoachChanges} jours avant d'augmenter à nouveau.`)
    }
  }

  // Doublons dans une séance après remplacement
  proposed.sessions.forEach((s) => {
    const slugs = s.exercises.map((e) => e.exercise_slug)
    if (new Set(slugs).size !== slugs.length) warnings.push(`Semaine ${s.week_number}, ${s.title} : exercice en double.`)
  })

  return { ok: violations.length === 0, violations, warnings }
}

/** Résumé lisible d'un ajustement, pour l'interface et l'historique. */
export function describeAdjustment(a: Adjustment, names: Map<string, string>): string {
  const n = (slug: string) => names.get(slug) ?? slug
  const weeks = a.to_week ? `semaines ${a.from_week} à ${a.to_week}` : `à partir de la semaine ${a.from_week}`
  if (a.type === 'remove_exercise') return `Retirer ${n(a.exercise_slug)} (${weeks})`
  if (a.type === 'replace_exercise') return `Remplacer ${n(a.exercise_slug)} par ${n(a.new_exercise_slug)} (${weeks})`
  const parts: string[] = []
  if (a.sets != null) parts.push(`${a.sets} séries`)
  if (a.reps_min != null || a.reps_max != null) parts.push(`${a.reps_min ?? '?'}–${a.reps_max ?? '?'} répétitions`)
  if (a.duration_s != null) parts.push(`${a.duration_s} s`)
  if (a.load_kg != null) parts.push(`${a.load_kg} kg`)
  if (a.rest_s != null) parts.push(`repos ${a.rest_s} s`)
  return `${n(a.exercise_slug)} : ${parts.join(', ') || 'objectifs mis à jour'} (${weeks})`
}
