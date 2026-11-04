import { AnthropicProvider } from './anthropic'
import { isConfigured, type AIConfig } from './config'
import { OpenAIProvider } from './openai'
import { AIError, type AIProvider, type ProviderId } from './types'

export function createProvider(id: ProviderId, config: AIConfig): AIProvider {
  const key = config.keys[id]
  if (!key) throw new AIError('not_configured', `${id} non configuré`, id)
  return id === 'openai' ? new OpenAIProvider(key, config.timeoutMs) : new AnthropicProvider(key, config.timeoutMs)
}

/**
 * Ordre d'essai : préférence utilisateur (si configurée), sinon fournisseur par défaut,
 * puis le secours UNIQUEMENT s'il est explicitement autorisé par AI_FALLBACK_PROVIDER.
 */
export function providerOrder(config: AIConfig, preferred?: string | null): ProviderId[] {
  const candidates: ProviderId[] = ['anthropic', 'openai']
  const primary = [preferred, config.defaultProvider, ...candidates]
    .find((p): p is ProviderId => (p === 'openai' || p === 'anthropic') && isConfigured(config, p))
  if (!primary) return []
  const order: ProviderId[] = [primary]
  if (config.fallbackProvider && config.fallbackProvider !== primary && isConfigured(config, config.fallbackProvider)) {
    order.push(config.fallbackProvider)
  }
  return order
}

/** Exécute une tâche IA ; ne bascule sur le secours que pour les erreurs temporaires. */
export async function runWithProviders<T>(
  order: ProviderId[], config: AIConfig, task: (p: AIProvider, id: ProviderId) => Promise<T>,
  onError?: (e: AIError) => Promise<void>,
): Promise<T> {
  if (!order.length) throw new AIError('not_configured', 'aucun fournisseur')
  let last: AIError | undefined
  for (const id of order) {
    try {
      return await task(createProvider(id, config), id)
    } catch (e) {
      last = e instanceof AIError ? e : new AIError('unavailable', String(e), id)
      last.provider ??= id
      await onError?.(last)
      if (!last.retryable) break
    }
  }
  throw last!
}
