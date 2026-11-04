import { supabase, unwrap } from '@/lib/supabase'

const TABLES = [
  'profiles', 'user_equipment', 'body_measurements', 'progress_photos', 'workout_plans', 'workout_plan_versions',
  'planned_sessions', 'planned_exercises', 'workout_sessions', 'performed_sets', 'coach_conversations',
  'coach_messages', 'coach_recommendations', 'ai_usage_logs',
] as const

/** Export JSON de toutes les données de l'utilisateur (RLS : uniquement les siennes). */
export async function exportMyData(): Promise<Blob> {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() }
  for (const t of TABLES) out[t] = unwrap(await supabase.from(t).select('*'))
  return new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
}

/** Supprime les photos puis le compte (cascade sur toutes les tables). */
export async function deleteMyAccount() {
  const photos = unwrap(await supabase.from('progress_photos').select('storage_path'))
  if (photos.length) {
    const rm = await supabase.storage.from('progress-photos').remove(photos.map((p) => p.storage_path))
    if (rm.error) throw new Error(rm.error.message)
  }
  unwrap(await supabase.rpc('delete_my_account'))
  await supabase.auth.signOut()
}
