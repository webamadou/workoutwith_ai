// Outils exposés au coach : lecture des données de l'utilisateur connecté et proposition d'ajustement.
// Ils s'exécutent côté serveur avec le client Supabase de l'utilisateur (RLS) : aucun accès aux données d'autrui.
import { checkAdjustments, type Adjustment } from '../../shared/program/adjustments'
import { exerciseHistory, comparePerformances, suggestNext, volumeByMuscle } from '../../shared/progression/engine'
import type { Json } from '../../shared/database.types'
import type { ToolDef } from '../ai/types'
import { describeSession, target } from './context'
import { toSetRecords, type DB, type UserData } from './data'
import { ADJUSTMENT_JSON_SCHEMA, normalizeAdjustment } from './prompts'

const int = (v: unknown, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isInteger(v) ? (v as number) : d))
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })

export interface ProposalContext {
  db: DB
  data: UserData
  provider: string
  model: () => string
  conversationId?: string
  sessionId?: string
  created: string[]
}

/** Vérifie une liste d'ajustements bruts et l'enregistre comme recommandation en attente. */
export async function saveProposal(ctx: ProposalContext, input: { title: string; summary: string; rationale: string; adjustments: unknown[]; kind?: 'program_adjustment' | 'session_analysis'; details?: Record<string, unknown> }) {
  const d = ctx.data
  const adjustments = input.adjustments.map(normalizeAdjustment)
  if (adjustments.some((a) => !a)) return { ok: false, violations: ['Format d’ajustement invalide.'] }
  const list = adjustments as Adjustment[]
  if (list.length && !d.draft) return { ok: false, violations: ['Aucun programme actif.'] }
  if (list.length) {
    const avoided = d.profile.avoided_exercise_ids.map((id) => d.exById.get(id)?.slug).filter(Boolean) as string[]
    const check = checkAdjustments(d.draft!, list, d.infos, {
      currentWeek: d.currentWeek, lastCoachChangeAt: d.lastCoachChangeAt, avoidedSlugs: avoided,
      ownedEquipment: d.equipment.map((e) => e.equipment_key),
    })
    if (!check.ok) return { ok: false, violations: check.violations }
  }
  const { data, error } = await ctx.db.from('coach_recommendations').insert({
    kind: input.kind ?? 'program_adjustment', title: input.title.slice(0, 200), summary: input.summary,
    rationale: input.rationale, adjustments: list, details: (input.details ?? {}) as NonNullable<Json>,
    engine_facts: { current_week: d.currentWeek, plan_version: d.plan?.version_number ?? null },
    provider: ctx.provider, model: ctx.model(), conversation_id: ctx.conversationId ?? null, workout_session_id: ctx.sessionId ?? null,
  }).select('id').single()
  if (error) throw new Error(error.message)
  ctx.created.push(data.id)
  return { ok: true, recommendation_id: data.id, status: list.length ? 'en attente de validation par l’utilisateur' : 'enregistrée' }
}

export function coachTools(ctx: ProposalContext): ToolDef[] {
  const d = ctx.data
  const sets = toSetRecords(d.sets)
  const exercise = (slug: unknown) => {
    const e = d.exBySlug.get(String(slug))
    if (!e) throw new Error(`Exercice inconnu : ${slug}. Utiliser un slug de la bibliothèque.`)
    return e
  }

  return [
    {
      name: 'get_exercise_history',
      description: 'Historique réel d’un exercice (séries par séance, charges, difficulté, douleurs), comparaison séance à séance et suggestion du moteur déterministe.',
      parameters: obj({ exercise_slug: { type: 'string' }, limit: { type: 'integer', description: '1 à 12 séances' } }, ['exercise_slug']),
      run: async (a) => {
        const e = exercise(a.exercise_slug)
        const hist = exerciseHistory(sets, e.id)
        const last = hist.slice(-int(a.limit, 6, 1, 12))
        const planned = d.plannedSessions.find((s) => s.week_number >= d.currentWeek && s.planned_exercises.some((p) => p.exercise_id === e.id))
          ?.planned_exercises.find((p) => p.exercise_id === e.id)
        return {
          exercise: e.slug, name: e.name, sessions_recorded: hist.length,
          history: last.map((h, i) => ({
            date: h.date.slice(0, 10), values_by_set: h.reps_by_set, unit: e.measurement === 'duration' ? 's' : 'reps',
            max_load_kg: h.max_load_kg, avg_difficulty_5: h.avg_difficulty, pain: h.pain,
            vs_previous: comparePerformances(i ? last[i - 1] : hist[hist.length - last.length - 1], h).explanation,
          })),
          next_planned_target: planned ? target(planned) : null,
          engine_suggestion: planned ? suggestNext(hist, { ...planned, load_kg: planned.load_kg == null ? null : Number(planned.load_kg) }).message : null,
        }
      },
    },
    {
      name: 'get_recent_sessions',
      description: 'Séances réalisées récemment (terminées ou abandonnées), avec le détail des séries et la comparaison à la séance précédente.',
      parameters: obj({ limit: { type: 'integer', description: '1 à 10' } }),
      run: async (a) => d.sessions.filter((s) => s.status === 'completed' || s.status === 'abandoned')
        .slice(0, int(a.limit, 5, 1, 10)).map((s) => describeSession(d, s.id)),
    },
    {
      name: 'get_program_week',
      description: 'Séances et objectifs prévus pour une semaine du programme actif.',
      parameters: obj({ week: { type: 'integer' } }, ['week']),
      run: async (a) => {
        if (!d.draft) return { error: 'Aucun programme actif.' }
        const w = int(a.week, d.currentWeek, 1, d.draft.weeks)
        return { week: w, sessions: d.draft.sessions.filter((s) => s.week_number === w) }
      },
    },
    {
      name: 'get_body_measurements',
      description: 'Mesures corporelles enregistrées (poids, tour de taille).',
      parameters: obj({}),
      run: async () => d.measurements.map((m) => ({ date: m.measured_on, weight_kg: m.weight_kg == null ? null : Number(m.weight_kg), waist_cm: m.waist_cm == null ? null : Number(m.waist_cm), note: m.note })),
    },
    {
      name: 'get_muscle_volume',
      description: 'Nombre de séries par groupe musculaire sur une période (principal = 1, secondaires = 0,5), pour repérer les groupes peu travaillés.',
      parameters: obj({ days: { type: 'integer', description: '7 à 56 jours' } }),
      run: async (a) => {
        const days = int(a.days, 28, 7, 56)
        const since = Date.now() - days * 86_400_000
        const completed = new Set(d.sessions.filter((s) => s.status === 'completed').map((s) => s.id))
        return { days, sets_by_muscle: volumeByMuscle(sets.filter((s) => completed.has(s.workout_session_id) && Date.parse(s.completed_at) >= since), d.exById) }
      },
    },
    {
      name: 'get_exercise_details',
      description: 'Description, consignes d’exécution et de sécurité d’un exercice de la bibliothèque.',
      parameters: obj({ exercise_slug: { type: 'string' } }, ['exercise_slug']),
      run: async (a) => {
        const e = exercise(a.exercise_slug)
        return { slug: e.slug, name: e.name, description: e.description, primary_muscle: e.primary_muscle, secondary_muscles: e.secondary_muscles, equipment: e.equipment, instructions: e.instructions, safety: e.safety_tips }
      },
    },
    {
      name: 'propose_program_adjustment',
      description: 'Propose une modification du programme actif. Elle est vérifiée par des garde-fous puis soumise à l’utilisateur (rien n’est appliqué automatiquement). Renvoie les violations éventuelles.',
      parameters: obj({
        title: { type: 'string', description: 'Titre court' },
        summary: { type: 'string', description: 'Ce qui change, en une ou deux phrases' },
        rationale: { type: 'string', description: 'Justification fondée sur les données' },
        adjustments: { type: 'array', items: ADJUSTMENT_JSON_SCHEMA, minItems: 1 },
      }, ['title', 'summary', 'rationale', 'adjustments']),
      run: async (a) => saveProposal(ctx, {
        title: String(a.title ?? 'Ajustement'), summary: String(a.summary ?? ''), rationale: String(a.rationale ?? ''),
        adjustments: Array.isArray(a.adjustments) ? a.adjustments : [],
      }),
    },
  ]
}
