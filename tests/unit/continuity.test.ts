import { describe, expect, it } from 'vitest'
import { EXERCISES } from '@shared/exercises/library'
import { generateInitialProgram, findSubstitute } from '@shared/program/template'
import { continuityProposals, equipmentProposal } from '@shared/progression/continuity'
import { scheduleStatus, type SetRecord } from '@shared/progression/engine'
import { parseImport } from '@shared/import/importer'
import initial from '../../data/import-initial.json'

const exercises = EXERCISES.map(({ animation: _a, alt: _b, ...e }) => ({ ...e, id: `id-${e.slug}`, caution_tags: e.caution_tags ?? [] }))
const owned = ['dumbbell', 'weight_plate', 'resistance_band', 'pushup_handles']
const { draft } = generateInitialProgram({ exercises, ownedEquipment: owned })
const base = { draft, currentWeek: 2, exercises, ownedEquipment: owned, avoidedSlugs: [], now: new Date('2026-11-10T12:00:00Z') }
const set = (session: string, ex: string, n: number, reps: number, extra: Partial<SetRecord> = {}): SetRecord => ({
  workout_session_id: session, exercise_id: `id-${ex}`, set_number: n, reps, duration_s: null, load_kg: null, difficulty: 3, pain: false,
  completed_at: `2026-11-0${session.slice(-1)}T18:0${n}:00Z`, ...extra,
})
const done = (id: string, day: string) => ({ id, status: 'completed' as const, started_at: `${day}T18:00:00Z`, completed_at: `${day}T19:00:00Z` })

describe('statuts du programme', () => {
  const slots = [1, 3, 5].map((d) => ({ week_number: 1, day_of_week: d, title: `S${d}` }))
  it('distingue à vérifier, non réalisée, avant le début et manquée sans rien réinitialiser', () => {
    const sessions = [
      { id: 'a', status: 'to_verify' as const, started_at: null, completed_at: null, week_number: 1, day_of_week: 1 },
      { id: 'b', status: 'skipped' as const, started_at: null, completed_at: null, week_number: 1, day_of_week: 3 },
    ]
    expect(scheduleStatus('2026-11-02', slots, sessions, '2026-11-07').map((s) => s.status)).toEqual(['to_verify', 'skipped', 'missed'])
    expect(scheduleStatus('2026-11-04', slots, [], '2026-11-04').map((s) => s.status)).toEqual(['before_start', 'today', 'upcoming'])
  })
  it('une séance terminée l’emporte sur une séance à vérifier du même créneau', () => {
    const sessions = [
      { id: 'a', status: 'to_verify' as const, started_at: null, completed_at: null, week_number: 1, day_of_week: 1 },
      { id: 'c', status: 'completed' as const, started_at: null, completed_at: '2026-11-02T19:00:00Z', week_number: 1, day_of_week: 1 },
    ]
    expect(scheduleStatus('2026-11-02', slots, sessions, '2026-11-03')[0]).toMatchObject({ status: 'done', session_id: 'c' })
  })
})

describe('propositions de continuité (sans IA)', () => {
  it('douleur → remplacement sans zone de vigilance commune', () => {
    const p = continuityProposals({ ...base, sessions: [done('s5', '2026-11-05')], sets: [set('s5', 'dead-bug', 1, 6, { pain: true, pain_note: 'tiraillement' })] })
    expect(p).toHaveLength(1)
    const adj = p[0].adjustments[0]
    expect(adj).toMatchObject({ type: 'replace_exercise', exercise_slug: 'dead-bug', from_week: 2 })
    const sub = exercises.find((e) => e.slug === (adj as { new_exercise_slug: string }).new_exercise_slug)!
    expect(sub.caution_tags).not.toContain('abdominal')
    expect(p[0].trigger_key).toBe('pain:s5:dead-bug')
    expect(p[0].rationale).toMatch(/professionnel de santé/)
  })

  it('ignore les douleurs anciennes et les exercices absents du programme à venir', () => {
    const old = continuityProposals({ ...base, sessions: [done('s1', '2026-10-01')], sets: [set('s1', 'dead-bug', 1, 6, { pain: true })] })
    expect(old).toEqual([])
    const absent = continuityProposals({ ...base, sessions: [done('s5', '2026-11-05')], sets: [set('s5', 'bird-dog', 1, 6, { pain: true })] })
    expect(absent).toEqual([])
  })

  it('deux baisses consécutives → une série de moins cette semaine seulement', () => {
    const sessions = [done('s1', '2026-11-01'), done('s3', '2026-11-03'), done('s5', '2026-11-05')]
    const sets = [12, 10, 8].flatMap((r, i) => [1, 2].map((n) => set(sessions[i].id, 'pompes', n, r)))
    const p = continuityProposals({ ...base, sessions, sets })
    expect(p).toHaveLength(1)
    expect(p[0].adjustments[0]).toMatchObject({ type: 'update_targets', exercise_slug: 'pompes', from_week: 2, to_week: 2, sets: 1 })
  })

  it('matériel retiré → exercices remplacés par des alternatives réalisables', () => {
    const p = equipmentProposal({ ...base, ownedEquipment: ['resistance_band'] })!
    expect(p).not.toBeNull()
    const replaced = p.adjustments.filter((a) => a.type === 'replace_exercise') as { new_exercise_slug: string }[]
    for (const r of replaced) expect(exercises.find((e) => e.slug === r.new_exercise_slug)!.equipment.every((k) => k === 'resistance_band')).toBe(true)
    expect(p.adjustments.some((a) => a.exercise_slug === 'squat-goblet')).toBe(true)
    expect(equipmentProposal(base)).toBeNull()
  })

  it('trouve un substitut du même groupe musculaire', () => {
    const goblet = exercises.find((e) => e.slug === 'squat-goblet')!
    expect(findSubstitute(goblet, exercises, [])?.primary_muscle).toBe('quads')
  })
})

describe('format d’import', () => {
  it('valide le jeu de données initial sans performance inventée', () => {
    const r = parseImport(initial)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.profile).toMatchObject({ height_cm: 170, experience_level: 'returning' })
    expect(r.data.measurements?.[0].weight_kg).toBe(74)
    expect(r.data.equipment?.map((e) => e.equipment_key)).toEqual(['dumbbell', 'weight_plate', 'resistance_band', 'pushup_handles'])
    const exercisesWithSets = r.data.sessions!.flatMap((s) => s.exercises.map((e) => e.exercise_slug))
    expect(exercisesWithSets).toEqual(['pompes'])
    expect(r.data.sessions![0].exercises[0].sets.map((x) => x.reps)).toEqual([8, 12, 12])
    expect(r.data.sessions![0].exercises[0].sets[1]).toMatchObject({ rest_s: 60, technique: { pause_bottom_s: 2 } })
    expect(r.data.program).toMatchObject({ available_days: [1, 3, 5], mark_past_as_to_verify: true })
  })

  it('rejette un fichier invalide avec des messages lisibles', () => {
    const r = parseImport({ format: 'workoutwith-ai/import', version: 1, sessions: [{ ref: 'x', title: 't', status: 'done', exercises: [] }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/sessions\.0\.status/)
    expect(parseImport({ format: 'autre' }).ok).toBe(false)
  })
})
