// Représentation d'un programme indépendante de la base (identifiants d'exercices = slugs).

export interface PlanExerciseDraft {
  exercise_slug: string
  sets: number
  reps_min?: number | null
  reps_max?: number | null
  duration_s?: number | null
  rest_s: number
  load_kg?: number | null
  notes?: string | null
}

export interface PlanSessionDraft {
  week_number: number
  day_of_week: number
  title: string
  focus: string
  exercises: PlanExerciseDraft[]
}

export interface PlanDraft {
  name: string
  goal: string
  weeks: number
  sessions: PlanSessionDraft[]
}

/** Exercice tel que le générateur et les garde-fous en ont besoin. */
export interface ExerciseInfo {
  id?: string
  slug: string
  name: string
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string[]
  difficulty: number
  measurement: 'reps' | 'duration'
  default_rest_s: number
  caution_tags?: string[]
}
