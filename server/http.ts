// Utilitaires communs aux fonctions Netlify : authentification Supabase et réponses JSON.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../shared/database.types'
import { AI_ERROR_MESSAGES, AIError } from './ai/types'
import type { DB } from './coach/data'

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'http_error') { super(message) }
}

/** Vérifie le jeton de l'utilisateur et renvoie un client Supabase agissant en son nom (RLS appliquée). */
export async function authenticate(req: Request): Promise<{ db: DB; userId: string }> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new HttpError(500, 'Configuration Supabase manquante côté serveur.', 'server_config')
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) throw new HttpError(401, 'Authentification requise.', 'unauthenticated')
  const db = createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session expirée, reconnectez-vous.', 'unauthenticated')
  return { db, userId: data.user.id }
}

export async function readJson<T>(req: Request, max = 10_000): Promise<T> {
  const text = await req.text()
  if (text.length > max) throw new HttpError(413, 'Requête trop volumineuse.', 'too_large')
  try { return JSON.parse(text || '{}') as T } catch { throw new HttpError(400, 'JSON invalide.', 'bad_json') }
}

/** Convertit n'importe quelle erreur en réponse sans fuite d'information sensible. */
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status)
  if (e instanceof AIError) {
    const status = e.code === 'not_configured' ? 503 : e.code === 'limit_reached' || e.code === 'rate_limited' ? 429 : e.code === 'bad_request' ? 400 : 502
    return json({ error: AI_ERROR_MESSAGES[e.code], code: e.code, provider: e.provider }, status)
  }
  console.error(e)
  return json({ error: 'Erreur interne.', code: 'internal' }, 500)
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
