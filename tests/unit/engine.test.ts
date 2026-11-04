import { describe, expect, it } from 'vitest'
import {
  comparePerformances, exerciseHistory, nextSession, scheduleStatus, suggestNext, summarizeExercise,
  summarizeSession, volumeByMuscle, weeklyStats, type SetRecord,
} from '@shared/progression/engine'

const set = (session: string, n: number, reps: number | null, extra: Partial<SetRecord> = {}): SetRecord => ({
  workout_session_id: session, exercise_id: 'pushup', set_number: n, reps, duration_s: null, load_kg: null,
  difficulty: 3, pain: false, completed_at: `2026-11-0${session === 's1' ? 2 : 4}T18:0${n}:00Z`, ...extra,
})

// Exemple du cahier des charges : 8, 12 et 12 pompes avec pause en bas.
const pushups = [set('s1', 1, 8), set('s1', 2, 12), set('s1', 3, 12)]

describe('moteur de progression', () => {
  it('compte 32 répétitions pour 8 + 12 + 12 pompes', () => {
    const perf = summarizeExercise(pushups)
    expect(perf.total_reps).toBe(32)
    expect(perf.reps_by_set).toEqual([8, 12, 12])
    expect(perf.tonnage_kg).toBe(0) // poids du corps
  })

  it('recommande de stabiliser autour de 3 × 10–12 quand une série est sous la cible', () => {
    const s = suggestNext([summarizeExercise(pushups)], { sets: 3, reps_min: 10, reps_max: 12 })
    expect(s.action).toBe('hold')
    expect(s.message).toContain('3 × 10–12')
    expect(s.facts.last_total_reps).toBe(32)
  })

  it('propose une hausse de charge quand toutes les séries atteignent le haut de fourchette facilement', () => {
    const sets = [1, 2, 3].map((n) => set('s1', n, 12, { load_kg: 6, difficulty: 2, exercise_id: 'row' }))
    const s = suggestNext(exerciseHistory(sets, 'row'), { sets: 3, reps_min: 8, reps_max: 12 })
    expect(s.action).toBe('increase_load')
    expect(s.facts.next_load_kg).toBe(7)
  })

  it('ne propose jamais d’augmenter après une douleur', () => {
    const sets = [1, 2, 3].map((n) => set('s1', n, 12, { pain: n === 3, difficulty: 2 }))
    expect(suggestNext([summarizeExercise(sets)], { sets: 3, reps_min: 8, reps_max: 12 }).action).toBe('reduce')
  })

  it('détecte progression, stabilité et régression', () => {
    const a = summarizeExercise(pushups)
    const b = summarizeExercise([set('s2', 1, 11), set('s2', 2, 12), set('s2', 3, 12)])
    expect(comparePerformances(a, b).trend).toBe('progression')
    expect(comparePerformances(a, a).trend).toBe('stable')
    const c = summarizeExercise([set('s2', 1, 6), set('s2', 2, 8), set('s2', 3, 8)])
    expect(comparePerformances(a, c).trend).toBe('regression')
    expect(comparePerformances(undefined, a).trend).toBe('first')
  })

  it('considère une hausse de charge à répétitions maintenues comme une progression', () => {
    const a = summarizeExercise([1, 2].map((n) => set('s1', n, 10, { load_kg: 6 })))
    const b = summarizeExercise([1, 2].map((n) => set('s2', n, 9, { load_kg: 7 })))
    expect(comparePerformances(a, b)).toMatchObject({ trend: 'progression', delta_load_kg: 1 })
  })

  it('résume une séance (durée, tonnage, douleurs)', () => {
    const sets = [set('s1', 1, 10, { load_kg: 8 }), set('s1', 2, 8, { load_kg: 8, pain: true, exercise_id: 'squat' })]
    const sum = summarizeSession(sets, { started_at: '2026-11-02T18:00:00Z', completed_at: '2026-11-02T18:45:00Z' })
    expect(sum).toMatchObject({ sets: 2, reps: 18, tonnage_kg: 144, exercises: 2, pain_reports: 1, elapsed_s: 2700 })
  })

  it('identifie les séances manquées et la prochaine séance', () => {
    const slots = [
      { week_number: 1, day_of_week: 1, title: 'Haut' },
      { week_number: 1, day_of_week: 3, title: 'Jambes' },
      { week_number: 1, day_of_week: 5, title: 'Complet' },
      { week_number: 2, day_of_week: 1, title: 'Haut' },
    ]
    const sessions = [{ id: 'x', status: 'completed' as const, started_at: null, completed_at: '2026-11-02T19:00:00Z', week_number: 1, day_of_week: 1 }]
    // Programme démarré le lundi 2 novembre 2026, nous sommes le vendredi 6.
    const st = scheduleStatus('2026-11-02', slots, sessions, '2026-11-06')
    expect(st.map((s) => s.status)).toEqual(['done', 'missed', 'today', 'upcoming'])
    expect(nextSession(st)?.slot.title).toBe('Complet')
  })

  it('calcule la régularité hebdomadaire', () => {
    const sessions = [{ id: 's1', status: 'completed' as const, started_at: null, completed_at: '2026-11-02T19:00:00Z' }]
    const weeks = weeklyStats(sessions, pushups, 2, '2026-11-04')
    expect(weeks.at(-1)).toMatchObject({ week_start: '2026-11-02', sessions: 1, sets: 3, reps: 32 })
    expect(weeks[0].sessions).toBe(0)
  })

  it('répartit le volume par groupe musculaire', () => {
    const ex = new Map([['pushup', { primary_muscle: 'chest', secondary_muscles: ['triceps'] }]])
    expect(volumeByMuscle(pushups, ex)).toEqual({ chest: 3, triceps: 1.5 })
  })
})
