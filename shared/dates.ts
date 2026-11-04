// Dates « calendaires » au format ISO (YYYY-MM-DD), indépendantes du fuseau.

export type ISODate = string

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** 1 = lundi … 7 = dimanche */
export function isoDayOfWeek(s: ISODate): number {
  return ((parseISODate(s).getDay() + 6) % 7) + 1
}

export function mondayOf(s: ISODate): ISODate {
  return addDays(s, 1 - isoDayOfWeek(s))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** Date prévue d'une séance : lundi de la semaine de début + décalage. */
export function plannedDate(planStart: ISODate, week: number, dayOfWeek: number): ISODate {
  return addDays(mondayOf(planStart), (week - 1) * 7 + (dayOfWeek - 1))
}

/** Numéro de semaine du programme pour une date (peut être < 1 ou > weeks). */
export function planWeekOf(planStart: ISODate, date: ISODate): number {
  return Math.floor(daysBetween(mondayOf(planStart), date) / 7) + 1
}

export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
