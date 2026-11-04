import { parseISODate } from '@shared/dates'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export const formatDay = (iso: string) => dateFmt.format(iso.length === 10 ? parseISODate(iso) : new Date(iso))
export const formatShort = (iso: string) => shortFmt.format(iso.length === 10 ? parseISODate(iso) : new Date(iso))

export function formatDuration(s: number | null | undefined): string {
  if (s == null) return '—'
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`
}

export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

export const formatKg = (n: number | string | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`

/** « 3 × 8–12 » ou « 2 × 25 s » */
export function formatTarget(e: { sets: number; reps_min?: number | null; reps_max?: number | null; duration_s?: number | null }) {
  if (e.duration_s) return `${e.sets} × ${e.duration_s} s`
  const r = e.reps_min && e.reps_max && e.reps_min !== e.reps_max ? `${e.reps_min}–${e.reps_max}` : `${e.reps_max ?? e.reps_min ?? '?'}`
  return `${e.sets} × ${r}`
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
