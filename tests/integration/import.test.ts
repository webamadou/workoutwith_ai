// Import et continuité contre le Supabase local.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/database.types'
import { parseImport, runImport, type ImportPayload } from '../../shared/import/importer'
import initial from '../../data/import-initial.json'

try { process.loadEnvFile('.env') } catch { /* déjà chargées */ }
const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const local = Boolean(url && anon && service && /127\.0\.0\.1|localhost/.test(url))

describe.skipIf(!local)('import d’un ancien suivi', () => {
  const admin = createClient<Database>(url!, service!, { auth: { persistSession: false } })
  const db: SupabaseClient<Database> = createClient<Database>(url!, anon!, { auth: { persistSession: false } })
  const email = `import-${Date.now()}@test.local`
  const password = `I-${crypto.randomUUID()}`
  let userId = ''
  const payload = (parseImport(initial) as { ok: true; data: ImportPayload }).data

  beforeAll(async () => {
    const c = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (c.error) throw c.error
    userId = c.data.user.id
    const s = await db.auth.signInWithPassword({ email, password })
    if (s.error) throw s.error
  })
  afterAll(async () => { if (userId) await admin.auth.admin.deleteUser(userId) })

  it('initialise profil, matériel, mesure, programme et l’historique confirmé', async () => {
    const report = await runImport(db, userId, payload, '2026-11-04') // un mercredi
    expect(report).toMatchObject({ profile: true, equipment: 4, measurements: 1, program: 'created', sessions: 1, sets: 3 })
    expect(report.to_verify).toBe(1) // le lundi passé n'est pas inventé comme « terminé »

    const profile = (await db.from('profiles').select('*').eq('id', userId).single()).data!
    expect(profile).toMatchObject({ experience_level: 'returning', available_days: [1, 3, 5] })
    expect(profile.onboarding_completed_at).not.toBeNull()

    const sessions = (await db.from('workout_sessions').select('status, title, performed_sets(reps, rest_s, technique)')).data!
    expect(sessions.find((s) => s.status === 'to_verify')?.performed_sets).toEqual([])
    const pushups = sessions.find((s) => s.status === 'completed')!
    expect(pushups.performed_sets.map((x) => x.reps).sort()).toEqual([12, 12, 8])
    expect(pushups.performed_sets.every((x) => (x.technique as { pause_bottom_s?: number }).pause_bottom_s === 2)).toBe(true)
  })

  it('est rejouable sans doublon et ne régénère pas le programme existant', async () => {
    const plan = (await db.from('workout_plans').select('id, current_version_id').eq('status', 'active').single()).data!
    const report = await runImport(db, userId, payload, '2026-11-04')
    expect(report.program).toBe('kept')
    expect((await db.from('workout_sessions').select('id')).data).toHaveLength(2)
    expect((await db.from('performed_sets').select('id')).data).toHaveLength(3)
    expect((await db.from('workout_plans').select('id')).data).toHaveLength(1)
    const after = (await db.from('workout_plans').select('id, current_version_id').eq('status', 'active').single()).data!
    expect(after).toEqual(plan)
  })

  it('permet de modifier le matériel sans refaire l’onboarding', async () => {
    await db.from('user_equipment').delete().eq('equipment_key', 'resistance_band')
    await db.from('user_equipment').update({ quantity: 10 }).eq('equipment_key', 'weight_plate')
    const eq = (await db.from('user_equipment').select('equipment_key, quantity').order('equipment_key')).data!
    expect(eq).toEqual([{ equipment_key: 'dumbbell', quantity: 2 }, { equipment_key: 'pushup_handles', quantity: 2 }, { equipment_key: 'weight_plate', quantity: 10 }])
    const profile = (await db.from('profiles').select('onboarding_completed_at').eq('id', userId).single()).data!
    expect(profile.onboarding_completed_at).not.toBeNull()
  })

  it('une séance non réalisée ou à vérifier ne réinitialise pas le programme', async () => {
    const tv = (await db.from('workout_sessions').select('id').eq('status', 'to_verify').single()).data!
    const r = await db.from('workout_sessions').update({ status: 'skipped' }).eq('id', tv.id).select()
    expect(r.error).toBeNull()
    expect((await db.from('workout_plans').select('id').eq('status', 'active')).data).toHaveLength(1)
  })

  it('n’enregistre qu’une proposition par déclencheur', async () => {
    const row = { kind: 'program_adjustment', source: 'rules', trigger_key: 'pain:x:pompes', title: 't', summary: 's', adjustments: [] }
    await db.from('coach_recommendations').upsert(row, { onConflict: 'user_id,trigger_key', ignoreDuplicates: true })
    await db.from('coach_recommendations').upsert({ ...row, title: 'doublon' }, { onConflict: 'user_id,trigger_key', ignoreDuplicates: true })
    const recs = (await db.from('coach_recommendations').select('title').eq('trigger_key', 'pain:x:pompes')).data!
    expect(recs).toEqual([{ title: 't' }])
  })
})
