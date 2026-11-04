import { supabase, unwrap } from '@/lib/supabase'
import type { Recommendation } from './types'

/** Appelle une fonction serveur Netlify avec le jeton de l'utilisateur. */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new CoachError(json.error ?? `Erreur ${res.status}`, json.code ?? 'http_error')
  return json as T
}

export class CoachError extends Error {
  constructor(message: string, public code: string) { super(message) }
}

export interface AIStatus {
  enabled: boolean
  providers: { id: 'openai' | 'anthropic'; configured: boolean }[]
  default_provider: string | null
  usage_today: { requests: number; tokens: number; request_limit: number; token_limit: number }
}

export const getAIStatus = () => call<AIStatus>('ai-status')

export interface ChatReply {
  conversation_id: string
  message: { id: string; content: string; created_at: string }
  recommendations: Recommendation[]
}

export const sendChat = (message: string, conversationId?: string) =>
  call<ChatReply>('coach-chat', { message, conversation_id: conversationId })

export const analyzeSession = (sessionId: string) =>
  call<{ recommendation: Recommendation }>('analyze-session', { session_id: sessionId })

export async function fetchConversations() {
  return unwrap(await supabase.from('coach_conversations').select('*').order('updated_at', { ascending: false }).limit(30))
}

export async function fetchMessages(conversationId: string) {
  return unwrap(await supabase.from('coach_messages').select('*').eq('conversation_id', conversationId).order('created_at'))
}

export async function fetchRecommendations(opts: { status?: 'pending'; limit?: number; sessionId?: string } = {}) {
  let q = supabase.from('coach_recommendations').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 30)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.sessionId) q = q.eq('workout_session_id', opts.sessionId)
  return unwrap(await q) as Recommendation[]
}

export async function rejectRecommendation(id: string) {
  return unwrap(await supabase.from('coach_recommendations')
    .update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').select().single()) as Recommendation
}

export async function deleteConversation(id: string) {
  unwrap(await supabase.from('coach_conversations').delete().eq('id', id))
}

export interface EquipmentSuggestion {
  items: { equipment_key: string; label: string; quantity: number | null; details: string | null; confidence: 'low' | 'medium' | 'high' }[]
  notes: string
  provider: string
  model: string
}

export const analyzeEquipment = (images: { mediaType: string; base64: string }[]) =>
  call<EquipmentSuggestion>('analyze-equipment', { images })
