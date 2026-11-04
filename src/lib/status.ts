import type { ScheduleStatus } from '@shared/progression/engine'

type S = ScheduleStatus['status']

export const SLOT_LABELS: Record<S, string> = {
  done: 'Faite', in_progress: 'En cours', to_verify: 'À vérifier', skipped: 'Non réalisée', missed: 'Manquée',
  today: 'Aujourd’hui', upcoming: 'À venir', before_start: 'Avant le début',
}

/** Classes de badge par statut. */
export const SLOT_BADGE: Record<S, string> = {
  done: 'bg-good/15 text-good', in_progress: 'bg-energy/25', today: 'bg-energy/25', to_verify: 'bg-accent-soft text-accent',
  skipped: 'bg-surface-2 text-muted', missed: 'bg-bad/15 text-bad', upcoming: 'bg-surface-2 text-muted', before_start: 'bg-surface-2 text-muted',
}

/** Couleur des pastilles de progression du programme. */
export const SLOT_DOT: Record<S, string> = {
  done: 'bg-good', in_progress: 'bg-energy', today: 'bg-energy', to_verify: 'bg-accent', skipped: 'bg-muted/40',
  missed: 'bg-bad/60', upcoming: 'bg-line', before_start: 'bg-line',
}
