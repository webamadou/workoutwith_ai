// Générateur du programme initial de 8 semaines (déterministe, sans IA).
import type { ExerciseInfo, PlanDraft, PlanExerciseDraft, PlanSessionDraft } from './types'

interface TemplateExercise {
  slug: string
  reps?: [number, number]
  duration?: number // durée cible en semaines 3-5 (s)
  note?: string
}

interface TemplateSession {
  title: string
  focus: string
  exercises: TemplateExercise[]
}

export const BASE_TEMPLATE: TemplateSession[] = [
  {
    title: 'Haut du corps',
    focus: 'Poussée et tirage',
    exercises: [
      { slug: 'pompes', reps: [8, 12] },
      { slug: 'rowing-halteres', reps: [8, 12] },
      { slug: 'developpe-sol', reps: [8, 12] },
      { slug: 'tirage-elastique', reps: [10, 15] },
      { slug: 'curl-biceps', reps: [10, 12] },
      { slug: 'extension-triceps', reps: [10, 12] },
    ],
  },
  {
    title: 'Jambes et épaules',
    focus: 'Bas du corps et épaules',
    exercises: [
      { slug: 'squat-goblet', reps: [8, 12] },
      { slug: 'fentes-arriere', reps: [8, 10], note: 'Répétitions par jambe.' },
      { slug: 'souleve-terre-roumain', reps: [8, 12] },
      { slug: 'developpe-epaules', reps: [8, 12] },
      { slug: 'elevations-laterales', reps: [10, 15] },
      { slug: 'dead-bug', reps: [6, 10], note: 'Répétitions par côté.' },
    ],
  },
  {
    title: 'Corps entier',
    focus: 'Séance complète',
    exercises: [
      { slug: 'pompes', reps: [8, 12] },
      { slug: 'rowing-unilateral', reps: [8, 12], note: 'Répétitions par bras.' },
      { slug: 'squat-pause', reps: [8, 10], note: 'Pause de 2 secondes en bas.' },
      { slug: 'pont-fessier', reps: [10, 15] },
      { slug: 'face-pull-elastique', reps: [12, 15] },
      { slug: 'planche-laterale', duration: 25, note: 'Durée par côté.' },
    ],
  },
]

export const DEFAULT_DAYS = [1, 3, 5] // lundi, mercredi, vendredi

export type Phase = 'reprise' | 'construction' | 'progression' | 'consolidation'

export function phaseOfWeek(week: number, totalWeeks = 8): Phase {
  if (week <= 2) return 'reprise'
  if (week === totalWeeks) return 'consolidation'
  if (week >= totalWeeks - 2) return 'progression'
  return 'construction'
}

export const PHASE_LABELS: Record<Phase, string> = {
  reprise: 'Reprise progressive',
  construction: 'Construction',
  progression: 'Progression',
  consolidation: 'Semaine allégée',
}

export interface GeneratorInput {
  exercises: ExerciseInfo[]
  ownedEquipment: string[]
  avoidedSlugs?: string[]
  availableDays?: number[]
  experience?: 'beginner' | 'returning' | 'intermediate' | 'advanced' | null
  goal?: string | null
  weeks?: number
}

export interface GeneratorResult {
  draft: PlanDraft
  substitutions: { from: string; to: string | null; reason: string }[]
}

/**
 * Applique le volume de la phase : reprise (2 séries, bas de fourchette, repos allongé),
 * construction (3 séries), progression (3 séries, haut de fourchette), consolidation (2 séries).
 */
function prescribe(t: TemplateExercise, ex: ExerciseInfo, week: number, weeks: number): PlanExerciseDraft {
  const phase = phaseOfWeek(week, weeks)
  const sets = phase === 'reprise' || phase === 'consolidation' ? 2 : 3
  const rest = ex.default_rest_s + (phase === 'reprise' ? 15 : 0)
  const notes = [t.note, phase === 'reprise' ? 'Reprise : garder 3 répétitions en réserve.' : null,
    phase === 'progression' ? 'Si toutes les séries atteignent le haut de la fourchette, augmenter légèrement la difficulté.' : null]
    .filter(Boolean).join(' ') || null
  if (ex.measurement === 'duration') {
    const base = t.duration ?? 30
    const duration = phase === 'reprise' ? base - 5 : phase === 'progression' ? base + 5 : base
    return { exercise_slug: ex.slug, sets, duration_s: duration, reps_min: null, reps_max: null, rest_s: rest, load_kg: null, notes }
  }
  const [lo, hi] = t.reps ?? [8, 12]
  const range: [number, number] = phase === 'reprise' ? [lo, Math.min(hi, lo + 2)] : [lo, hi]
  return { exercise_slug: ex.slug, sets, reps_min: range[0], reps_max: range[1], duration_s: null, rest_s: rest, load_kg: null, notes }
}

const EASIER: Record<string, string> = { pompes: 'pompes-inclinees' }

/** Choisit un exercice réalisable avec le matériel disponible, sinon un substitut du même groupe musculaire. */
function resolveExercise(
  slug: string, input: GeneratorInput, bySlug: Map<string, ExerciseInfo>, used: Set<string>,
): { ex: ExerciseInfo | null; reason?: string } {
  const owned = new Set(input.ownedEquipment)
  const avoided = new Set(input.avoidedSlugs ?? [])
  const usable = (e: ExerciseInfo) => e.equipment.every((k) => owned.has(k)) && !avoided.has(e.slug)
  let wanted = bySlug.get(slug)
  if (!wanted) return { ex: null, reason: 'exercice inconnu' }
  if (input.experience === 'beginner' && EASIER[slug] && bySlug.has(EASIER[slug])) wanted = bySlug.get(EASIER[slug])!
  if (usable(wanted)) return { ex: wanted }
  const reason = avoided.has(wanted.slug) ? 'exercice à éviter' : 'matériel non disponible'
  return { ex: findSubstitute(wanted, input.exercises, input.ownedEquipment, input.avoidedSlugs ?? [], used), reason }
}

/**
 * Remplaçant réalisable : même groupe musculaire principal, même type de mesure, matériel disponible,
 * hors exercices à éviter / déjà utilisés et, si demandé, sans étiquette de vigilance en commun.
 */
export function findSubstitute(
  target: ExerciseInfo, exercises: ExerciseInfo[], owned: string[], avoided: string[] = [],
  exclude: Set<string> = new Set(), avoidCautionOf?: ExerciseInfo,
): ExerciseInfo | null {
  const ownedSet = new Set(owned)
  const avoidedSet = new Set(avoided)
  const cautions = new Set(avoidCautionOf?.caution_tags ?? [])
  return exercises
    .filter((e) => e.slug !== target.slug && !exclude.has(e.slug) && !avoidedSet.has(e.slug)
      && e.measurement === target.measurement && e.equipment.every((k) => ownedSet.has(k))
      && !(e.caution_tags ?? []).some((t) => cautions.has(t)))
    .filter((e) => score(e, target) >= 2)
    .sort((a, b) => score(b, target) - score(a, target) || a.difficulty - b.difficulty || a.slug.localeCompare(b.slug))[0] ?? null
}

function score(e: ExerciseInfo, target: ExerciseInfo): number {
  let s = 0
  if (e.primary_muscle === target.primary_muscle) s += 2
  s += e.secondary_muscles.filter((m) => target.secondary_muscles.includes(m)).length * 0.5
  return s
}

export function generateInitialProgram(input: GeneratorInput): GeneratorResult {
  const weeks = input.weeks ?? 8
  const bySlug = new Map(input.exercises.map((e) => [e.slug, e]))
  const days = [...new Set(input.availableDays?.length ? input.availableDays : DEFAULT_DAYS)].sort((a, b) => a - b)
  const sessionDays = days.length >= BASE_TEMPLATE.length ? spread(days, BASE_TEMPLATE.length) : DEFAULT_DAYS
  const substitutions: GeneratorResult['substitutions'] = []

  // Résolution une seule fois par séance type pour que toutes les semaines restent cohérentes.
  const resolved = BASE_TEMPLATE.map((session) => {
    const used = new Set<string>()
    const items: { t: TemplateExercise; ex: ExerciseInfo }[] = []
    for (const t of session.exercises) {
      const { ex, reason } = resolveExercise(t.slug, input, bySlug, used)
      if (ex && ex.slug !== t.slug) substitutions.push({ from: t.slug, to: ex.slug, reason: reason ?? 'niveau' })
      if (!ex) substitutions.push({ from: t.slug, to: null, reason: reason ?? 'indisponible' })
      if (ex && !used.has(ex.slug)) {
        used.add(ex.slug)
        items.push({ t, ex })
      }
    }
    return { session, items }
  })

  const sessions: PlanSessionDraft[] = []
  for (let week = 1; week <= weeks; week++) {
    resolved.forEach(({ session, items }, i) => {
      sessions.push({
        week_number: week,
        day_of_week: sessionDays[i],
        title: session.title,
        focus: session.focus,
        exercises: items.map(({ t, ex }) => prescribe(t, ex, week, weeks)),
      })
    })
  }

  return {
    draft: {
      name: 'Programme reprise — 8 semaines',
      goal: input.goal ?? 'Renforcement général',
      weeks,
      sessions,
    },
    substitutions: dedupe(substitutions),
  }
}

/** Choisit n jours répartis au mieux dans la semaine parmi ceux disponibles. */
function spread(days: number[], n: number): number[] {
  if (days.length === n) return days
  let best = days.slice(0, n)
  let bestGap = -1
  const combos = (start: number, acc: number[]): void => {
    if (acc.length === n) {
      const gaps = acc.map((d, i) => (i ? d - acc[i - 1] : d + 7 - acc[acc.length - 1]))
      const minGap = Math.min(...gaps)
      if (minGap > bestGap) { bestGap = minGap; best = [...acc] }
      return
    }
    for (let i = start; i < days.length; i++) combos(i + 1, [...acc, days[i]])
  }
  combos(0, [])
  return best
}

function dedupe<T>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((x) => {
    const k = JSON.stringify(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
