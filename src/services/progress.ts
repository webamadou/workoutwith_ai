import { supabase, unwrap } from '@/lib/supabase'
import type { Insert } from './types'

const BUCKET = 'progress-photos'

export async function fetchMeasurements() {
  return unwrap(await supabase.from('body_measurements').select('*').order('measured_on'))
}

export async function saveMeasurement(m: Omit<Insert<'body_measurements'>, 'user_id'>) {
  return unwrap(await supabase.from('body_measurements').upsert(m, { onConflict: 'user_id,measured_on' }).select().single())
}

export async function deleteMeasurement(id: string) {
  unwrap(await supabase.from('body_measurements').delete().eq('id', id))
}

export async function fetchPhotos() {
  const photos = unwrap(await supabase.from('progress_photos').select('*').order('taken_on', { ascending: false }))
  if (!photos.length) return []
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(photos.map((p) => p.storage_path), 3600)
  return photos.map((p, i) => ({ ...p, url: data?.[i]?.signedUrl ?? null }))
}

export async function uploadPhoto(userId: string, file: File, takenOn: string, note?: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw new Error(up.error.message)
  try {
    return unwrap(await supabase.from('progress_photos').insert({ storage_path: path, taken_on: takenOn, note: note || null }).select().single())
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([path])
    throw e
  }
}

export async function deletePhoto(id: string, path: string) {
  const rm = await supabase.storage.from(BUCKET).remove([path])
  if (rm.error) throw new Error(rm.error.message)
  unwrap(await supabase.from('progress_photos').delete().eq('id', id))
}
