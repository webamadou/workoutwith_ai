// Contexte compact transmis au coach : l'essentiel, pas l'historique complet (les détails passent par les outils).
import {
  comparePerformances, exerciseHistory, nextSession, scheduleStatus, suggestNext, summarizeExercise, summarizeSession, volumeByMuscle,
} from '../../shared/progression/engine'
import { phaseOfWeek, PHASE_LABELS } from '../../shared/program/template'
import { toSessionRecords, toSetRecords, type UserData } from './data'

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function target(e: { sets: number; reps_min: number | null; reps_max: number | null; duration_s: number | null; load_kg?: unknown }) {
  const t = e.duration_s ? `${e.sets}×${e.duration_s}s` : `${e.sets}×${e.reps_min}-${e.reps_max}`
  return e.load_kg != null ? `${t} @${Number(e.load_kg)}kg` : t
}

/** Résumé d'une séance réalisée, exercice par exercice, avec comparaison à la séance précédente. */
export function describeSession(d: UserData, sessionId: string) {
  const s = d.sessions.find((x) => x.id === sessionId)
  if (!s) return null
  const all = toSetRecords(d.sets)
  const mine = all.filter((x) => x.workout_session_id === sessionId)
  const before = all.filter((x) => x.workout_session_id !== sessionId && x.completed_at < (s.started_at ?? s.created_at))
  const byEx = new Map<string, typeof mine>()
  for (const x of mine) byEx.set(x.exercise_id, [...(byEx.get(x.exercise_id) ?? []), x])
  return {
    date: (s.completed_at ?? s.started_at ?? s.created_at).slice(0, 10),
    title: s.title, status: s.status,
    perceived_difficulty_10: s.perceived_difficulty, comment: s.comment,
    totals: summarizeSession(mine, s),
    exercises: [...byEx.entries()].map(([exId, list]) => {
      const perf = summarizeExercise(list)
      const cmp = comparePerformances(exerciseHistory(before, exId).at(-1), perf)
      return {
        exercise: d.exById.get(exId)?.slug,
        name: d.exById.get(exId)?.name,
        per_set: list.sort((a, b) => a.set_number - b.set_number).map((x) => ({
          reps: x.reps, duration_s: x.duration_s, load_kg: x.load_kg, difficulty_5: x.difficulty, pain: x.pain || undefined,
          pain_note: x.pain_note ?? undefined, note: x.note ?? undefined,
          technique: Object.keys(x.technique ?? {}).length ? x.technique : undefined,
        })),
        vs_previous: { trend: cmp.trend, explanation: cmp.explanation },
      }
    }),
  }
}

const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Sujets détectés dans la demande, pour ne transmettre que le contexte utile. */
export function topicsOf(message: string, d: UserData) {
  const m = norm(message)
  const exercises = d.exercises.filter((e) => {
    const name = norm(e.name)
    const stem = name.split(' ')[0].replace(/s$/, '')
    return m.includes(e.slug) || m.includes(name) || (stem.length >= 5 && m.includes(stem))
  })
  return {
    exercises,
    body: /poids|tour de taille|taille|mesure|maigr|graisse|ventre|kilo/.test(m),
    muscles: /muscle|groupe|equilibr|insuffisamment|neglig|travaill/.test(m),
    sessions: /seance|aujourd|hier|demain|progress|rate|manque|fatigu|difficil|douleur|mal |reussi|charge|semaine/.test(m),
  }
}

export function buildContext(d: UserData, message = ''): string {
  const topics = topicsOf(message, d)
  const p = d.profile
  const names = (ids: string[]) => ids.map((id) => d.exById.get(id)?.slug).filter(Boolean).join(', ') || 'aucun'
  const firstW = d.measurements.find((m) => m.weight_kg != null)
  const lastW = [...d.measurements].reverse().find((m) => m.weight_kg != null)
  const lastWaist = [...d.measurements].reverse().find((m) => m.waist_cm != null)

  const lines: string[] = [
    `Date du jour : ${d.today}.`,
    '## Profil',
    `Taille ${p.height_cm ?? '?'} cm. Objectif : ${p.goal ?? 'non renseigné'}. Niveau : ${p.experience_level ?? '?'}.`,
    `Fréquence souhaitée : ${p.sessions_per_week ?? '?'} séances/semaine, jours ${p.available_days.map((x) => DAYS[x - 1]).join(', ') || '?'}, ${p.session_duration_min ?? '?'} min.`,
    `Matériel : ${d.equipment.map((e) => `${e.equipment_key}${e.details ? ` (${e.details})` : ''}`).join(', ') || 'aucun (poids du corps)'}.`,
    `Préférences : ${p.training_preferences ?? '—'}. Exercices préférés : ${names(p.preferred_exercise_ids)}. À éviter : ${names(p.avoided_exercise_ids)}.`,
    `Limitations déclarées : ${[p.limitation_tags.join(', '), p.limitations].filter(Boolean).join(' — ') || 'aucune'}.`,
    `Récupération : ${p.recovery_notes ?? '—'}.`,
    `Mesures : poids ${lastW ? `${Number(lastW.weight_kg)} kg le ${lastW.measured_on}` : 'non mesuré'}${firstW && lastW && firstW !== lastW ? ` (départ ${Number(firstW.weight_kg)} kg le ${firstW.measured_on})` : ''} ; tour de taille ${lastWaist ? `${Number(lastWaist.waist_cm)} cm le ${lastWaist.measured_on}` : 'non mesuré'}.`,
  ]

  if (d.plan && d.draft) {
    const statuses = scheduleStatus(d.plan.start_date, d.plannedSessions, toSessionRecords(d), d.today)
    const done = statuses.filter((s) => s.status === 'done').length
    const missed = statuses.filter((s) => s.status === 'missed')
    const next = nextSession(statuses)
    lines.push(
      '## Programme actif',
      `${d.plan.name} (version ${d.plan.version_number}), ${d.plan.weeks} semaines, début ${d.plan.start_date}. Semaine en cours : ${d.currentWeek} (${PHASE_LABELS[phaseOfWeek(d.currentWeek, d.plan.weeks)]}).`,
      `Séances faites : ${done}/${statuses.length}. À vérifier (ancien suivi, non confirmées) : ${statuses.filter((s) => s.status === 'to_verify').length}. Non réalisées par choix : ${statuses.filter((s) => s.status === 'skipped').length}. Manquées : ${missed.length}${missed.length ? ` (${missed.slice(-4).map((m) => `S${m.slot.week_number} ${DAYS[m.slot.day_of_week - 1]} ${m.date}`).join(', ')})` : ''}.`,
      `Dernier ajustement accepté proposé par le coach : ${d.lastCoachChangeAt?.slice(0, 10) ?? 'aucun'}.`,
      `Semaine ${d.currentWeek} :`,
      ...d.draft.sessions.filter((s) => s.week_number === d.currentWeek).map((s) =>
        `- ${DAYS[s.day_of_week - 1]} « ${s.title} » : ${s.exercises.map((e) => `${e.exercise_slug} ${target({ ...e, reps_min: e.reps_min ?? null, reps_max: e.reps_max ?? null, duration_s: e.duration_s ?? null })}`).join(' ; ')}`),
    )
    if (next) {
      const ps = d.plannedSessions.find((x) => x.week_number === next.slot.week_number && x.day_of_week === next.slot.day_of_week)
      const sets = toSetRecords(d.sets)
      lines.push(`Prochaine séance : S${next.slot.week_number} ${DAYS[next.slot.day_of_week - 1]} ${next.date} « ${next.slot.title} » (${next.status}).`)
      if (ps) {
        lines.push('Suggestions du moteur déterministe pour cette séance :')
        for (const e of ps.planned_exercises) {
          const hist = exerciseHistory(sets, e.exercise_id)
          if (hist.length) lines.push(`- ${d.exById.get(e.exercise_id)?.slug} : ${suggestNext(hist, { ...e, load_kg: e.load_kg == null ? null : Number(e.load_kg) }).message}`)
        }
      }
    }
  } else {
    lines.push('## Programme actif', 'Aucun programme actif.')
  }

  // Mémoire : décisions passées et douleurs récentes (toujours utiles pour la sécurité et la cohérence).
  if (d.recommendations.length) {
    lines.push('## Recommandations passées et décisions', ...d.recommendations.map((r) =>
      `- ${r.created_at.slice(0, 10)} « ${r.title} » (${r.source === 'rules' ? 'règle de l’application' : 'coach IA'}) : ${{ pending: 'en attente', accepted: 'acceptée', rejected: 'refusée', superseded: 'remplacée' }[r.status]}`))
  }
  const monthAgo = Date.now() - 30 * 86_400_000
  const pains = d.sets.filter((s) => s.pain && Date.parse(s.completed_at) >= monthAgo)
  if (pains.length) {
    lines.push('## Douleurs signalées (30 jours)', ...pains.map((s) => `- ${s.completed_at.slice(0, 10)} ${d.exById.get(s.exercise_id)?.slug} série ${s.set_number}${s.pain_note ? ` : ${s.pain_note}` : ''}`))
  }

  // Contexte ciblé selon la demande.
  const sets = toSetRecords(d.sets)
  const completedIds = new Set(d.sessions.filter((s) => s.status === 'completed').map((s) => s.id))
  for (const e of topics.exercises.slice(0, 3)) {
    const hist = exerciseHistory(sets.filter((x) => completedIds.has(x.workout_session_id)), e.id).slice(-4)
    lines.push(`## Historique ${e.slug} (demandé)`, hist.length
      ? hist.map((h) => `- ${h.date.slice(0, 10)} : ${h.reps_by_set.join('·')}${e.measurement === 'duration' ? ' s' : ' rép.'}${h.max_load_kg != null ? ` @${h.max_load_kg}kg` : ''}, difficulté ${h.avg_difficulty ?? '?'}/5${h.pain ? ', douleur' : ''}`).join('\n')
      : 'Aucune performance enregistrée pour cet exercice.')
  }
  if (topics.body) {
    lines.push('## Mesures corporelles', d.measurements.slice(-8).map((m) => `- ${m.measured_on} : ${m.weight_kg != null ? `${Number(m.weight_kg)} kg` : ''} ${m.waist_cm != null ? `${Number(m.waist_cm)} cm` : ''}`.trim()).join('\n') || 'Aucune mesure.')
  }
  if (topics.muscles) {
    const since = Date.now() - 28 * 86_400_000
    lines.push('## Séries par groupe musculaire (28 jours)', JSON.stringify(volumeByMuscle(sets.filter((x) => completedIds.has(x.workout_session_id) && Date.parse(x.completed_at) >= since), d.exById)))
  }

  const recent = d.sessions.filter((s) => s.status === 'completed' || s.status === 'abandoned').slice(0, topics.sessions ? 3 : 1)
  lines.push('## Séances récentes (détail via get_recent_sessions)')
  if (!recent.length) lines.push('Aucune séance enregistrée.')
  for (const s of recent) lines.push(JSON.stringify(describeSession(d, s.id)))

  lines.push('## Bibliothèque (slug : nom)', d.exercises.map((e) => `${e.slug} : ${e.name} [${e.equipment.join('+') || 'poids du corps'}]`).join(' | '))
  return lines.join('\n')
}
