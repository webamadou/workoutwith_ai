// Import d'un ancien suivi (format JSON documenté dans docs/IMPORT.md).
// Rejouable sans doublon : sessions identifiées par external_ref, séries par (séance, exercice, numéro),
// mesures par date. Un programme actif existant n'est jamais régénéré sans demande explicite.
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { mondayOf, plannedDate, toISODate } from '../dates'
import { generateInitialProgram } from '../program/template'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date au format AAAA-MM-JJ')
const day = z.number().int().min(1).max(7)

const setSchema = z.object({
  reps: z.number().int().min(0).max(500).nullish(),
  duration_s: z.number().int().min(0).max(3600).nullish(),
  load_kg: z.number().min(0).max(500).nullish(),
  difficulty: z.number().int().min(1).max(5).nullish(),
  rest_s: z.number().int().min(0).max(3600).nullish(),
  pain: z.boolean().optional(),
  pain_note: z.string().max(500).nullish(),
  note: z.string().max(500).nullish(),
  technique: z.record(z.string(), z.unknown()).optional(),
}).refine((s) => s.reps != null || s.duration_s != null, 'chaque série doit avoir des répétitions ou une durée')

export const importSchema = z.object({
  format: z.literal('workoutwith-ai/import'),
  version: z.literal(1),
  profile: z.object({
    display_name: z.string().max(80).optional(),
    height_cm: z.number().min(100).max(250).optional(),
    goal: z.string().max(300).optional(),
    experience_level: z.enum(['beginner', 'returning', 'intermediate', 'advanced']).optional(),
    sessions_per_week: z.number().int().min(1).max(7).optional(),
    available_days: z.array(day).optional(),
    session_duration_min: z.number().int().min(10).max(240).optional(),
    training_preferences: z.string().max(1000).optional(),
    limitations: z.string().max(1000).optional(),
    limitation_tags: z.array(z.string().max(40)).optional(),
    recovery_notes: z.string().max(1000).optional(),
  }).optional(),
  equipment: z.array(z.object({
    equipment_key: z.enum(['dumbbell', 'weight_plate', 'resistance_band', 'pushup_handles', 'mat']),
    quantity: z.number().int().min(1).max(100).default(1),
    details: z.string().max(200).nullish(),
  })).optional(),
  measurements: z.array(z.object({
    measured_on: date.nullish(),
    weight_kg: z.number().min(25).max(350).nullish(),
    waist_cm: z.number().min(30).max(250).nullish(),
    note: z.string().max(300).nullish(),
  })).optional(),
  program: z.object({
    template: z.literal('reprise-8-semaines'),
    start_date: date.nullish(),
    available_days: z.array(day).min(3).optional(),
    /** Séances passées du programme sans résultat confirmé → « à vérifier ». */
    mark_past_as_to_verify: z.boolean().default(true),
    replace_active_program: z.boolean().default(false),
  }).optional(),
  sessions: z.array(z.object({
    ref: z.string().min(1).max(80),
    title: z.string().min(1).max(120),
    date: date.nullish(),
    status: z.enum(['completed', 'to_verify']),
    perceived_difficulty: z.number().int().min(1).max(10).nullish(),
    comment: z.string().max(1000).nullish(),
    exercises: z.array(z.object({ exercise_slug: z.string(), sets: z.array(setSchema) })).default([]),
  })).optional(),
})

export type ImportPayload = z.infer<typeof importSchema>

export interface ImportReport {
  profile: boolean
  equipment: number
  measurements: number
  program: 'created' | 'kept' | 'none'
  to_verify: number
  sessions: number
  sets: number
  warnings: string[]
}

type DB = SupabaseClient<Database>
const must = <R extends { error: { message: string } | null; data: unknown }>(r: R, what: string): NonNullable<R['data']> => {
  if (r.error) throw new Error(`${what} : ${r.error.message}`)
  return r.data as NonNullable<R['data']>
}

/** Valide un fichier et renvoie des messages d'erreur lisibles. */
export function parseImport(raw: unknown): { ok: true; data: ImportPayload } | { ok: false; errors: string[] } {
  const r = importSchema.safeParse(raw)
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, errors: r.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || 'fichier'} : ${i.message}`) }
}

export async function runImport(db: DB, userId: string, payload: ImportPayload, today = toISODate(new Date())): Promise<ImportReport> {
  const report: ImportReport = { profile: false, equipment: 0, measurements: 0, program: 'none', to_verify: 0, sessions: 0, sets: 0, warnings: [] }
  const exercises = must(await db.from('exercises').select('*'), 'bibliothèque')
  const bySlug = new Map(exercises.map((e) => [e.slug, e]))
  const unknown = (payload.sessions ?? []).flatMap((s) => s.exercises.map((e) => e.exercise_slug)).filter((s) => !bySlug.has(s))
  if (unknown.length) throw new Error(`Exercices inconnus dans le fichier : ${[...new Set(unknown)].join(', ')}`)

  if (payload.profile) {
    const days = payload.program?.available_days
    must(await db.from('profiles').update({
      ...payload.profile, ...(days && !payload.profile.available_days ? { available_days: days } : {}),
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', userId), 'profil')
    report.profile = true
  }

  if (payload.equipment) {
    const keys = payload.equipment.map((e) => e.equipment_key)
    const existing = must(await db.from('user_equipment').select('id, equipment_key'), 'matériel')
    const stale = existing.filter((e) => !keys.includes(e.equipment_key as never)).map((e) => e.id)
    if (stale.length) must(await db.from('user_equipment').delete().in('id', stale), 'matériel')
    if (keys.length) must(await db.from('user_equipment').upsert(payload.equipment.map((e) => ({ ...e, details: e.details ?? null })), { onConflict: 'user_id,equipment_key' }), 'matériel')
    report.equipment = keys.length
  }

  for (const m of payload.measurements ?? []) {
    if (m.weight_kg == null && m.waist_cm == null) { report.warnings.push('Mesure vide ignorée.'); continue }
    must(await db.from('body_measurements').upsert({ measured_on: m.measured_on ?? today, weight_kg: m.weight_kg ?? null, waist_cm: m.waist_cm ?? null, note: m.note ?? null }, { onConflict: 'user_id,measured_on' }), 'mesure')
    report.measurements++
  }

  // Programme : généré depuis le profil et le matériel importés, sauf si un programme actif existe déjà.
  let plan = must(await db.from('workout_plans').select('*').eq('status', 'active').maybeSingle() as never, 'programme') as Database['public']['Tables']['workout_plans']['Row'] | null
  if (payload.program && (!plan || payload.program.replace_active_program)) {
    const profile = must(await db.from('profiles').select('*').eq('id', userId).single(), 'profil')
    const owned = must(await db.from('user_equipment').select('equipment_key'), 'matériel').map((e) => e.equipment_key)
    const start = payload.program.start_date ?? mondayOf(today)
    const { draft, substitutions } = generateInitialProgram({
      exercises: exercises.map((e) => ({ ...e, measurement: e.measurement as 'reps' | 'duration' })),
      ownedEquipment: owned, availableDays: payload.program.available_days ?? profile.available_days,
      avoidedSlugs: profile.avoided_exercise_ids.map((id) => exercises.find((e) => e.id === id)?.slug).filter(Boolean) as string[],
      experience: profile.experience_level, goal: profile.goal,
    })
    for (const s of substitutions) report.warnings.push(`Programme : ${s.from} → ${s.to ?? 'retiré'} (${s.reason}).`)
    const planId = must(await db.rpc('create_workout_plan', {
      p_name: draft.name, p_goal: draft.goal, p_start_date: start, p_weeks: draft.weeks,
      p_sessions: draft.sessions.map((s) => ({ ...s, exercises: s.exercises.map(({ exercise_slug, ...e }) => ({ exercise_id: bySlug.get(exercise_slug)!.id, ...e })) })),
      p_change_summary: 'Programme importé depuis un ancien suivi',
    }), 'programme')
    plan = must(await db.from('workout_plans').select('*').eq('id', planId).single(), 'programme')
    report.program = 'created'
  } else if (payload.program && plan) {
    report.program = 'kept'
    report.warnings.push('Un programme actif existe déjà : il est conservé (aucune réinitialisation).')
  }

  // Séances passées du programme sans résultat confirmé : « à vérifier », jamais « terminées ».
  if (plan?.current_version_id && payload.program?.mark_past_as_to_verify !== false) {
    const slots = must(await db.from('planned_sessions').select('id, week_number, day_of_week, title').eq('plan_version_id', plan.current_version_id), 'séances prévues')
    const past = slots.filter((s) => plannedDate(plan!.start_date, s.week_number, s.day_of_week) < today)
    for (const s of past) {
      const ref = `import:slot:${plan.id}:${s.week_number}-${s.day_of_week}`
      const r = await db.from('workout_sessions').upsert({
        plan_id: plan.id, planned_session_id: s.id, title: s.title, status: 'to_verify', external_ref: ref,
        scheduled_for: plannedDate(plan.start_date, s.week_number, s.day_of_week),
        comment: 'Séance issue de l’ancien suivi : réalisation non confirmée.',
      }, { onConflict: 'user_id,external_ref', ignoreDuplicates: true })
      must(r, 'séance à vérifier')
      report.to_verify++
    }
  }

  for (const s of payload.sessions ?? []) {
    const when = s.date ?? today
    const startedAt = `${when}T12:00:00.000Z`
    const session = must(await db.from('workout_sessions').upsert({
      title: s.title, status: s.status, external_ref: `import:${s.ref}`, scheduled_for: when,
      started_at: s.status === 'completed' ? startedAt : null, completed_at: s.status === 'completed' ? startedAt : null,
      perceived_difficulty: s.perceived_difficulty ?? null,
      comment: [s.comment, s.date ? null : 'Date exacte inconnue (ancien suivi) : date d’import utilisée.'].filter(Boolean).join(' ') || null,
    }, { onConflict: 'user_id,external_ref' }).select('id').single(), 'séance')
    report.sessions++
    for (const ex of s.exercises) {
      const rows = ex.sets.map((set, i) => ({
        workout_session_id: session.id, exercise_id: bySlug.get(ex.exercise_slug)!.id, set_number: i + 1,
        reps: set.reps ?? null, duration_s: set.duration_s ?? null, load_kg: set.load_kg ?? null, difficulty: set.difficulty ?? null,
        rest_s: set.rest_s ?? null, pain: set.pain ?? false, pain_note: set.pain_note ?? null, note: set.note ?? null,
        technique: (set.technique ?? {}) as never, completed_at: new Date(Date.parse(startedAt) + i * 90_000).toISOString(),
      }))
      if (rows.length) must(await db.from('performed_sets').upsert(rows, { onConflict: 'workout_session_id,exercise_id,set_number' }), 'séries')
      report.sets += rows.length
    }
  }
  return report
}
