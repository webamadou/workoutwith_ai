import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

type Res = { data: unknown; error: { message: string } | null }

/** Lève l'erreur Supabase éventuelle, sinon renvoie les données (requêtes qui renvoient toujours un résultat). */
export function unwrap<R extends Res>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R['data']>
}

/** Variante pour maybeSingle() : le résultat peut être absent. */
export function unwrapMaybe<R extends Res>(res: R): R['data'] | null {
  if (res.error) throw new Error(res.error.message)
  return res.data
}
