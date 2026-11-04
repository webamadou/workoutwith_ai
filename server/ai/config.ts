import type { ProviderId } from './types'

// Configuration lue depuis l'environnement serveur : aucun nom de modèle dans la logique métier.
export interface AIConfig {
  defaultProvider: ProviderId | null
  fallbackProvider: ProviderId | null
  keys: Record<ProviderId, string | undefined>
  models: Record<ProviderId, { chat?: string; analysis?: string; vision?: string }>
  dailyRequestLimit: number
  dailyTokenLimit: number
  maxOutputTokens: number
  timeoutMs: number
}

const provider = (v?: string): ProviderId | null => (v === 'openai' || v === 'anthropic' ? v : null)
const int = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)

export function loadConfig(env: Record<string, string | undefined> = process.env): AIConfig {
  return {
    defaultProvider: provider(env.AI_DEFAULT_PROVIDER),
    fallbackProvider: provider(env.AI_FALLBACK_PROVIDER),
    keys: { openai: env.OPENAI_API_KEY || undefined, anthropic: env.ANTHROPIC_API_KEY || undefined },
    models: {
      openai: { chat: env.OPENAI_CHAT_MODEL || undefined, analysis: env.OPENAI_ANALYSIS_MODEL || env.OPENAI_CHAT_MODEL || undefined, vision: env.OPENAI_VISION_MODEL || env.OPENAI_CHAT_MODEL || undefined },
      anthropic: { chat: env.ANTHROPIC_CHAT_MODEL || undefined, analysis: env.ANTHROPIC_ANALYSIS_MODEL || env.ANTHROPIC_CHAT_MODEL || undefined, vision: env.ANTHROPIC_VISION_MODEL || env.ANTHROPIC_CHAT_MODEL || undefined },
    },
    dailyRequestLimit: int(env.AI_DAILY_REQUEST_LIMIT, 60),
    dailyTokenLimit: int(env.AI_DAILY_TOKEN_LIMIT, 300_000),
    maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 4000),
    timeoutMs: int(env.AI_TIMEOUT_MS, 25_000),
  }
}

/** Un fournisseur est utilisable s'il a une clé et au moins un modèle conversationnel. */
export const isConfigured = (c: AIConfig, id: ProviderId) => Boolean(c.keys[id] && c.models[id].chat)
