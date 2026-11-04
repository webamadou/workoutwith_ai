import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { AIError, type ProviderId } from './types'

/** Traduit les erreurs typées des SDK officiels en erreurs communes. */
export function mapError(e: unknown, provider: ProviderId): AIError {
  if (e instanceof AIError) return e
  const sdk = provider === 'openai' ? OpenAI : Anthropic
  if (e instanceof sdk.APIConnectionTimeoutError) return new AIError('timeout', 'timeout', provider)
  if (e instanceof sdk.APIConnectionError) return new AIError('unavailable', 'connexion impossible', provider)
  if (e instanceof sdk.AuthenticationError || e instanceof sdk.PermissionDeniedError) return new AIError('auth', 'authentification', provider)
  if (e instanceof sdk.RateLimitError) {
    // OpenAI signale un quota épuisé par un 429 avec code « insufficient_quota ».
    const code = (e as { code?: string | null }).code
    return new AIError(code === 'insufficient_quota' ? 'quota_exceeded' : 'rate_limited', 'limite de débit', provider)
  }
  if (e instanceof sdk.InternalServerError) return new AIError('unavailable', 'erreur serveur fournisseur', provider)
  if (e instanceof sdk.APIError) {
    if (e.status === 529) return new AIError('unavailable', 'surcharge', provider)
    if (e.status === 402) return new AIError('quota_exceeded', 'quota', provider)
    return new AIError('bad_request', `requête refusée (${e.status})`, provider)
  }
  return new AIError('unavailable', (e as Error)?.message ?? 'erreur inconnue', provider)
}
