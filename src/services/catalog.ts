import { supabase, unwrap } from '@/lib/supabase'
import type { ExerciseInfo } from '@shared/program/types'
import type { Exercise } from './types'

export async function fetchExercises(): Promise<Exercise[]> {
  const data = unwrap(await supabase.from('exercises').select('*, exercise_media(*)').order('name'))
  return data as unknown as Exercise[]
}

export const toExerciseInfo = (e: Exercise): ExerciseInfo => ({
  id: e.id, slug: e.slug, name: e.name, primary_muscle: e.primary_muscle, secondary_muscles: e.secondary_muscles,
  equipment: e.equipment, difficulty: e.difficulty, measurement: e.measurement as 'reps' | 'duration',
  default_rest_s: e.default_rest_s, caution_tags: e.caution_tags,
})
