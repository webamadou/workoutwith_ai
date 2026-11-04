import { supabase, unwrap } from '@/lib/supabase'
import type { Profile, Update } from './types'

export async function fetchProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single())
}

export async function updateProfile(userId: string, patch: Update<'profiles'>): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select().single())
}

export async function fetchEquipment() {
  return unwrap(await supabase.from('user_equipment').select('*').order('equipment_key'))
}

/** Remplace la liste du matériel de l'utilisateur. */
export async function saveEquipment(items: { equipment_key: string; quantity: number; details: string | null }[]) {
  const keys = items.map((i) => i.equipment_key)
  const existing = await fetchEquipment()
  const toDelete = existing.filter((e) => !keys.includes(e.equipment_key)).map((e) => e.id)
  if (toDelete.length) unwrap(await supabase.from('user_equipment').delete().in('id', toDelete))
  if (items.length) unwrap(await supabase.from('user_equipment').upsert(items, { onConflict: 'user_id,equipment_key' }))
}
