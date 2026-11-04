// Tests de permissions (Row Level Security) contre le Supabase local : `npm run db:start` au préalable.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/database.types'

try { process.loadEnvFile('.env') } catch { /* variables déjà présentes ou absentes */ }
const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const local = Boolean(url && anon && service && /127\.0\.0\.1|localhost/.test(url))

type DB = SupabaseClient<Database>
const opts = { auth: { persistSession: false } }
const password = `T3st-${crypto.randomUUID()}`
const emails = [`rls-a-${Date.now()}@test.local`, `rls-b-${Date.now()}@test.local`]

describe.skipIf(!local)('Row Level Security', () => {
  const admin = createClient<Database>(url!, service!, opts)
  let a: DB, b: DB, anonDb: DB
  let aId = '', bId = '', sessionId = '', planId = ''

  beforeAll(async () => {
    const clients: DB[] = []
    for (const email of emails) {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw error
      const c = createClient<Database>(url!, anon!, opts)
      const { error: e2 } = await c.auth.signInWithPassword({ email, password })
      if (e2) throw e2
      clients.push(c)
    }
    ;[a, b] = clients
    anonDb = createClient<Database>(url!, anon!, opts)
    aId = (await a.auth.getUser()).data.user!.id
    bId = (await b.auth.getUser()).data.user!.id

    const ex = (await a.from('exercises').select('id').eq('slug', 'pompes').single()).data!
    const plan = await a.rpc('create_workout_plan', {
      p_name: 'Test', p_goal: 'Test', p_start_date: '2026-11-02', p_weeks: 1,
      p_sessions: [{ week_number: 1, day_of_week: 1, title: 'A', focus: '', exercises: [{ exercise_id: ex.id, sets: 2, reps_min: 8, reps_max: 10, rest_s: 60 }] }],
    })
    if (plan.error) throw plan.error
    planId = plan.data
    const s = await a.from('workout_sessions').insert({ title: 'A', status: 'in_progress', started_at: new Date().toISOString(), plan_id: planId }).select().single()
    if (s.error) throw s.error
    sessionId = s.data.id
    const set = await a.from('performed_sets').insert({ workout_session_id: sessionId, exercise_id: ex.id, set_number: 1, reps: 10 })
    if (set.error) throw set.error
    await a.from('body_measurements').insert({ weight_kg: 74 })
  })

  afterAll(async () => {
    for (const id of [aId, bId]) if (id) await admin.auth.admin.deleteUser(id)
  })

  it('crée automatiquement le profil et ne montre que le sien', async () => {
    const { data } = await b.from('profiles').select('id')
    expect(data?.map((p) => p.id)).toEqual([bId])
  })

  it('isole séances, séries, programmes et mesures entre utilisateurs', async () => {
    for (const t of ['workout_sessions', 'performed_sets', 'workout_plans', 'planned_exercises', 'body_measurements'] as const) {
      const mine = await a.from(t).select('id')
      const theirs = await b.from(t).select('id')
      expect(mine.data?.length, t).toBeGreaterThan(0)
      expect(theirs.data, t).toEqual([])
    }
  })

  it('refuse d’écrire dans la séance d’un autre utilisateur', async () => {
    const ex = (await b.from('exercises').select('id').eq('slug', 'pompes').single()).data!
    const ins = await b.from('performed_sets').insert({ workout_session_id: sessionId, exercise_id: ex.id, set_number: 2, reps: 99 })
    expect(ins.error).not.toBeNull()
    const upd = await b.from('workout_sessions').update({ status: 'abandoned' }).eq('id', sessionId).select()
    expect(upd.data).toEqual([])
    const del = await b.from('performed_sets').delete().eq('workout_session_id', sessionId).select()
    expect(del.data).toEqual([])
    const check = await a.from('performed_sets').select('reps').eq('workout_session_id', sessionId)
    expect(check.data).toEqual([{ reps: 10 }])
  })

  it('empêche d’usurper user_id et de versionner le programme d’autrui', async () => {
    const spoof = await b.from('body_measurements').insert({ user_id: aId, weight_kg: 50 })
    expect(spoof.error).not.toBeNull()
    const v = await b.rpc('create_plan_version', { p_plan_id: planId, p_sessions: [], p_source: 'user', p_change_summary: 'x' })
    expect(v.error).not.toBeNull()
  })

  it('protège la bibliothèque et refuse les accès anonymes', async () => {
    const write = await a.from('exercises').update({ name: 'piraté' }).eq('slug', 'pompes').select()
    expect(write.data).toEqual([])
    const anonRead = await anonDb.from('exercises').select('id')
    expect(anonRead.data).toEqual([])
    const anonSessions = await anonDb.from('workout_sessions').select('id')
    expect(anonSessions.data ?? []).toEqual([])
  })

  it('garde les photos privées par dossier utilisateur', async () => {
    const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    const own = await a.storage.from('progress-photos').upload(`${aId}/test.jpg`, file)
    expect(own.error).toBeNull()
    const intrude = await b.storage.from('progress-photos').upload(`${aId}/intrus.jpg`, file)
    expect(intrude.error).not.toBeNull()
    const read = await b.storage.from('progress-photos').download(`${aId}/test.jpg`)
    expect(read.error).not.toBeNull()
    const list = await b.storage.from('progress-photos').list(aId)
    expect(list.data ?? []).toEqual([])
    await a.storage.from('progress-photos').remove([`${aId}/test.jpg`])
  })

  it('n’autorise pas la suppression des journaux de consommation', async () => {
    await a.from('ai_usage_logs').insert({ provider: 'anthropic', model: 'm', task: 'test', status: 'ok' })
    const del = await a.from('ai_usage_logs').delete().eq('user_id', aId).select()
    expect(del.data).toEqual([])
  })

  it('supprime le compte et toutes ses données', async () => {
    const r = await b.rpc('delete_my_account')
    expect(r.error).toBeNull()
    const gone = await admin.from('profiles').select('id').eq('id', bId)
    expect(gone.data).toEqual([])
    bId = ''
  })
})
