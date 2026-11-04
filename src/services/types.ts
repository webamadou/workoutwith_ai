import type { Database } from '@shared/database.types'
import type { PoseAnimation } from '@shared/exercises/poses'

type T = Database['public']['Tables']
export type Row<K extends keyof T> = T[K]['Row']
export type Insert<K extends keyof T> = T[K]['Insert']
export type Update<K extends keyof T> = T[K]['Update']

export type Profile = Row<'profiles'>
export type Equipment = Row<'user_equipment'>
export type ExerciseMedia = Omit<Row<'exercise_media'>, 'data'> & { data: PoseAnimation | null }
export type Exercise = Row<'exercises'> & { exercise_media: ExerciseMedia[] }
export type WorkoutPlan = Row<'workout_plans'>
export type PlanVersion = Row<'workout_plan_versions'>
export type PlannedExercise = Row<'planned_exercises'>
export type PlannedSession = Row<'planned_sessions'> & { planned_exercises: PlannedExercise[] }
export type WorkoutSession = Row<'workout_sessions'>
// Les colonnes JSON sont typées simplement pour éviter le type Json récursif dans les refs Vue.
export type PerformedSet = Omit<Row<'performed_sets'>, 'technique'> & { technique: Record<string, unknown> }
export type Measurement = Row<'body_measurements'>
export type ProgressPhoto = Row<'progress_photos'>
export type Conversation = Row<'coach_conversations'>
export type CoachMessage = Row<'coach_messages'>
export type Recommendation = Omit<Row<'coach_recommendations'>, 'details' | 'adjustments' | 'engine_facts'> & {
  details: Record<string, unknown>; adjustments: unknown[]; engine_facts: Record<string, unknown>
}
export type CoachMessageRow = Omit<Row<'coach_messages'>, 'metadata'> & { metadata: Record<string, unknown> }

export interface ActivePlan {
  plan: WorkoutPlan
  version: PlanVersion
  sessions: PlannedSession[]
}

export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quadriceps', hamstrings: 'Ischios', glutes: 'Fessiers', core: 'Sangle abdominale', forearms: 'Avant-bras',
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  dumbbell: 'Haltères', weight_plate: 'Disques', resistance_band: 'Bandes élastiques',
  pushup_handles: 'Poignées de pompes', mat: 'Tapis',
}

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Débutant', returning: 'Reprise après une pause', intermediate: 'Intermédiaire', advanced: 'Avancé',
}

export const DIFFICULTY_LABELS = ['', 'Très facile', 'Facile', 'Modérée', 'Difficile', 'Maximale'] as const
