import { describe, expect, it } from 'vitest'
import { EXERCISES } from '@shared/exercises/library'
import { generateInitialProgram, phaseOfWeek } from '@shared/program/template'
import { applyAdjustments, checkAdjustments, describeAdjustment, adjustmentListSchema } from '@shared/program/adjustments'

const exercises = EXERCISES.map(({ animation: _a, alt: _b, ...e }) => e)
const demoEquipment = ['dumbbell', 'weight_plate', 'resistance_band', 'pushup_handles']

describe('programme initial', () => {
  const { draft, substitutions } = generateInitialProgram({ exercises, ownedEquipment: demoEquipment })

  it('crée 8 semaines × 3 séances lundi / mercredi / vendredi', () => {
    expect(draft.weeks).toBe(8)
    expect(draft.sessions).toHaveLength(24)
    expect(new Set(draft.sessions.map((s) => s.day_of_week))).toEqual(new Set([1, 3, 5]))
    expect(substitutions).toEqual([])
  })

  it('respecte l’organisation du cahier des charges', () => {
    const w1 = draft.sessions.filter((s) => s.week_number === 1)
    expect(w1.map((s) => s.title)).toEqual(['Haut du corps', 'Jambes et épaules', 'Corps entier'])
    expect(w1[0].exercises.map((e) => e.exercise_slug)).toEqual(
      ['pompes', 'rowing-halteres', 'developpe-sol', 'tirage-elastique', 'curl-biceps', 'extension-triceps'])
    expect(w1[2].exercises.at(-1)).toMatchObject({ exercise_slug: 'planche-laterale', duration_s: 20 })
  })

  it('limite le volume des deux premières semaines', () => {
    const sets = (w: number) => draft.sessions.filter((s) => s.week_number === w).flatMap((s) => s.exercises).reduce((n, e) => n + e.sets, 0)
    expect(sets(1)).toBeLessThan(sets(3))
    expect(sets(2)).toBe(sets(1))
    expect(phaseOfWeek(1)).toBe('reprise')
    expect(phaseOfWeek(8)).toBe('consolidation')
  })

  it('remplace les exercices sans matériel disponible', () => {
    const r = generateInitialProgram({ exercises, ownedEquipment: [] })
    const slugs = r.draft.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_slug))
    const needs = new Map(exercises.map((e) => [e.slug, e.equipment]))
    expect(slugs.every((s) => needs.get(s)!.length === 0)).toBe(true)
    expect(r.substitutions.some((s) => s.from === 'squat-goblet' && s.to)).toBe(true)
  })

  it('exclut les exercices à éviter et adapte aux jours disponibles', () => {
    const r = generateInitialProgram({ exercises, ownedEquipment: demoEquipment, avoidedSlugs: ['dead-bug'], availableDays: [2, 4, 6, 7] })
    expect(r.draft.sessions.flatMap((s) => s.exercises).some((e) => e.exercise_slug === 'dead-bug')).toBe(false)
    expect(new Set(r.draft.sessions.map((s) => s.day_of_week)).size).toBe(3)
  })
})

describe('ajustements et garde-fous', () => {
  const { draft } = generateInitialProgram({ exercises, ownedEquipment: demoEquipment })
  const ctx = { currentWeek: 3, ownedEquipment: demoEquipment }

  it('applique une mise à jour de cibles uniquement sur les semaines visées', () => {
    const next = applyAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, to_week: 4, reps_min: 10, reps_max: 12 }], exercises)
    const p = (w: number) => next.sessions.find((s) => s.week_number === w && s.day_of_week === 1)!.exercises[0]
    expect(p(3)).toMatchObject({ reps_min: 10, reps_max: 12 })
    expect(p(5)).toMatchObject({ reps_min: 8, reps_max: 12 })
    expect(draft.sessions.find((s) => s.week_number === 3)!.exercises[0].reps_min).toBe(8) // original intact
  })

  it('accepte une stabilisation prudente', () => {
    const r = checkAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, reps_min: 10, reps_max: 12 }], exercises, ctx)
    expect(r).toMatchObject({ ok: true, violations: [] })
  })

  it('refuse les semaines passées, les hausses brutales et le matériel absent', () => {
    expect(checkAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'pompes', from_week: 1, sets: 3 }], exercises, ctx).ok).toBe(false)
    const big = checkAdjustments(draft, [
      { type: 'update_targets', exercise_slug: 'pompes', from_week: 3, sets: 6 },
      { type: 'update_targets', exercise_slug: 'squat-goblet', from_week: 3, sets: 6 },
      { type: 'update_targets', exercise_slug: 'pont-fessier', from_week: 3, sets: 6 },
    ], exercises, ctx)
    expect(big.ok).toBe(false)
    expect(big.violations.join(' ')).toMatch(/% de séries/)
    const reps = checkAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'curl-biceps', from_week: 3, reps_max: 20 }], exercises, ctx)
    expect(reps.ok).toBe(false)
    const noBand = checkAdjustments(draft, [{ type: 'replace_exercise', exercise_slug: 'pompes', new_exercise_slug: 'face-pull-elastique', from_week: 3 }], exercises, { ...ctx, ownedEquipment: [] })
    expect(noBand.ok).toBe(false)
  })

  it('limite la fréquence des augmentations', () => {
    const r = checkAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, sets: 4 }], exercises,
      { ...ctx, lastCoachChangeAt: '2026-11-01T10:00:00Z', now: new Date('2026-11-04T10:00:00Z') })
    expect(r.ok).toBe(false)
    // Une réduction reste possible.
    const down = checkAdjustments(draft, [{ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, sets: 2 }], exercises,
      { ...ctx, lastCoachChangeAt: '2026-11-01T10:00:00Z', now: new Date('2026-11-04T10:00:00Z') })
    expect(down.ok).toBe(true)
  })

  it('valide le format et décrit les ajustements', () => {
    expect(adjustmentListSchema.safeParse([{ type: 'remove_exercise', exercise_slug: 'x' }]).success).toBe(false)
    const names = new Map(exercises.map((e) => [e.slug, e.name]))
    expect(describeAdjustment({ type: 'replace_exercise', exercise_slug: 'dead-bug', new_exercise_slug: 'bird-dog', from_week: 3 }, names))
      .toBe('Remplacer Dead bug par Bird dog (à partir de la semaine 3)')
  })
})
