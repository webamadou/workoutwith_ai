// Continuité du coaching : propositions déterministes calculées à l'ouverture de l'application (sans IA).
// Chaque proposition porte une clé de déclenchement unique : une proposition refusée n'est pas reproposée.
import type { Adjustment } from '../program/adjustments'
import { findSubstitute } from '../program/template'
import type { ExerciseInfo, PlanDraft } from '../program/types'
import { comparePerformances, exerciseHistory, type SessionRecord, type SetRecord } from './engine'

export interface ContinuityProposal {
  trigger_key: string
  title: string
  summary: string
  rationale: string
  adjustments: Adjustment[]
  facts: Record<string, unknown>
}

export interface ContinuityInput {
  draft: PlanDraft
  currentWeek: number
  exercises: (ExerciseInfo & { id: string })[]
  ownedEquipment: string[]
  avoidedSlugs: string[]
  sessions: SessionRecord[]
  sets: SetRecord[]
  /** Ne regarde que les séances terminées depuis N jours. */
  lookbackDays?: number
  now?: Date
}

const plannedFrom = (draft: PlanDraft, slug: string, fromWeek: number) =>
  draft.sessions.filter((s) => s.week_number >= fromWeek && s.exercises.some((e) => e.exercise_slug === slug))

/** Exercices déjà présents dans les séances qui contiennent `slug` (pour éviter un doublon dans une même séance). */
const coOccurring = (draft: PlanDraft, slug: string, fromWeek: number) =>
  new Set(plannedFrom(draft, slug, fromWeek).flatMap((s) => s.exercises.map((e) => e.exercise_slug)))

/** Douleur signalée → remplacer l'exercice (sans vigilance commune) ou, à défaut, réduire d'une série. */
function painProposals(i: ContinuityInput, byId: Map<string, ExerciseInfo & { id: string }>, recent: SessionRecord[]): ContinuityProposal[] {
  const out: ContinuityProposal[] = []
  for (const s of recent) {
    const painful = new Map<string, SetRecord[]>()
    for (const set of i.sets) if (set.workout_session_id === s.id && set.pain) painful.set(set.exercise_id, [...(painful.get(set.exercise_id) ?? []), set])
    for (const [exId, list] of painful) {
      const ex = byId.get(exId)
      if (!ex || !plannedFrom(i.draft, ex.slug, i.currentWeek).length) continue
      const notes = list.map((x) => x.pain_note).filter(Boolean).join(' ; ')
      const sub = findSubstitute(ex, i.exercises, i.ownedEquipment, i.avoidedSlugs, coOccurring(i.draft, ex.slug, i.currentWeek), ex)
      const weeks = { from_week: i.currentWeek }
      const adjustments: Adjustment[] = sub
        ? [{ type: 'replace_exercise', exercise_slug: ex.slug, new_exercise_slug: sub.slug, ...weeks }]
        : [{ type: 'update_targets', exercise_slug: ex.slug, sets: Math.max(1, Math.min(...plannedFrom(i.draft, ex.slug, i.currentWeek).flatMap((x) => x.exercises.filter((e) => e.exercise_slug === ex.slug).map((e) => e.sets))) - 1), ...weeks }]
      out.push({
        trigger_key: `pain:${s.id}:${ex.slug}`,
        title: `Douleur signalée : ${ex.name}`,
        summary: sub
          ? `Remplacer ${ex.name} par ${sub.name} à partir de la semaine ${i.currentWeek}, le temps que la gêne disparaisse.`
          : `Réduire ${ex.name} d’une série à partir de la semaine ${i.currentWeek} et diminuer l’amplitude si besoin.`,
        rationale: `Douleur ou inconfort noté sur ${list.length} série(s)${notes ? ` (${notes})` : ''}. Ne pas s’entraîner dans la douleur ; si elle persiste, est vive ou inhabituelle, consulter un professionnel de santé.`,
        adjustments,
        facts: { session_id: s.id, exercise: ex.slug, painful_sets: list.map((x) => x.set_number) },
      })
    }
  }
  return out
}

/** Deux baisses consécutives sur un exercice → alléger d'une série la semaine en cours seulement. */
function regressionProposals(i: ContinuityInput, byId: Map<string, ExerciseInfo & { id: string }>, completedIds: Set<string>): ContinuityProposal[] {
  const out: ContinuityProposal[] = []
  const done = i.sets.filter((s) => completedIds.has(s.workout_session_id))
  for (const exId of new Set(done.map((s) => s.exercise_id))) {
    const ex = byId.get(exId)
    const hist = exerciseHistory(done, exId)
    if (!ex || hist.length < 3) continue
    const [a, b, c] = hist.slice(-3)
    if (comparePerformances(a, b).trend !== 'regression' || comparePerformances(b, c).trend !== 'regression') continue
    const planned = plannedFrom(i.draft, ex.slug, i.currentWeek).filter((s) => s.week_number === i.currentWeek)
    const sets = Math.min(...planned.flatMap((s) => s.exercises.filter((e) => e.exercise_slug === ex.slug).map((e) => e.sets)))
    if (!planned.length || sets <= 1) continue
    out.push({
      trigger_key: `regression:${c.session_id}:${ex.slug}`,
      title: `Baisse de performance : ${ex.name}`,
      summary: `Passer ${ex.name} à ${sets - 1} série(s) cette semaine pour récupérer, puis reprendre le volume prévu.`,
      rationale: `Deux baisses consécutives : ${[a, b, c].map((h) => h.reps_by_set.join('·')).join(' → ')}. La fatigue ou le manque de récupération sont des causes fréquentes.`,
      adjustments: [{ type: 'update_targets', exercise_slug: ex.slug, from_week: i.currentWeek, to_week: i.currentWeek, sets: sets - 1 }],
      facts: { exercise: ex.slug, last: [a, b, c].map((h) => h.reps_by_set) },
    })
  }
  return out
}

/** Matériel retiré → remplacer les exercices devenus irréalisables (à partir de la semaine en cours). */
export function equipmentProposal(i: Pick<ContinuityInput, 'draft' | 'currentWeek' | 'exercises' | 'ownedEquipment' | 'avoidedSlugs'>): ContinuityProposal | null {
  const owned = new Set(i.ownedEquipment)
  const bySlug = new Map(i.exercises.map((e) => [e.slug, e]))
  const future = i.draft.sessions.filter((s) => s.week_number >= i.currentWeek)
  const blocked = [...new Set(future.flatMap((s) => s.exercises.map((e) => e.exercise_slug)))]
    .map((slug) => bySlug.get(slug)).filter((e): e is ExerciseInfo & { id: string } => Boolean(e && !e.equipment.every((k) => owned.has(k))))
  if (!blocked.length) return null
  const adjustments: Adjustment[] = []
  const lines: string[] = []
  const chosen = new Set<string>()
  for (const ex of blocked) {
    const sub = findSubstitute(ex, i.exercises, i.ownedEquipment, i.avoidedSlugs, new Set([...coOccurring(i.draft, ex.slug, i.currentWeek), ...chosen]))
    if (sub) chosen.add(sub.slug)
    adjustments.push(sub
      ? { type: 'replace_exercise', exercise_slug: ex.slug, new_exercise_slug: sub.slug, from_week: i.currentWeek }
      : { type: 'remove_exercise', exercise_slug: ex.slug, from_week: i.currentWeek })
    lines.push(sub ? `${ex.name} → ${sub.name}` : `${ex.name} retiré (aucune alternative avec votre matériel)`)
  }
  return {
    trigger_key: `equipment:${[...owned].sort().join('+') || 'aucun'}:${blocked.map((e) => e.slug).sort().join('+')}`,
    title: 'Programme à adapter à votre matériel',
    summary: lines.join(' ; '),
    rationale: `Ces exercices demandent du matériel qui ne figure plus dans votre inventaire (${[...new Set(blocked.flatMap((e) => e.equipment.filter((k) => !owned.has(k))))].join(', ')}).`,
    adjustments,
    facts: { blocked: blocked.map((e) => e.slug), owned: [...owned] },
  }
}

export function continuityProposals(i: ContinuityInput): ContinuityProposal[] {
  const byId = new Map(i.exercises.map((e) => [e.id, e]))
  const since = (i.now ?? new Date()).getTime() - (i.lookbackDays ?? 14) * 86_400_000
  const completed = i.sessions.filter((s) => s.status === 'completed' && s.completed_at)
  const recent = completed.filter((s) => Date.parse(s.completed_at!) >= since)
  return [
    ...(equipmentProposal(i) ? [equipmentProposal(i)!] : []),
    ...painProposals(i, byId, recent),
    ...regressionProposals(i, byId, new Set(completed.map((s) => s.id))),
  ]
}
