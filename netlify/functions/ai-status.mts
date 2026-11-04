import type { Config } from '@netlify/functions'
import { loadConfig, isConfigured } from '../../server/ai/config'
import { providerOrder } from '../../server/ai/registry'
import { usageToday } from '../../server/coach/service'
import { authenticate, errorResponse, json } from '../../server/http'

// État du coach : fournisseurs disponibles (sans jamais exposer les clés) et consommation du jour.
export default async (req: Request) => {
  try {
    const { db } = await authenticate(req)
    const config = loadConfig()
    const usage = await usageToday(db)
    const order = providerOrder(config)
    return json({
      enabled: order.length > 0,
      default_provider: order[0] ?? null,
      providers: (['openai', 'anthropic'] as const).map((id) => ({ id, configured: isConfigured(config, id) })),
      usage_today: { requests: usage.requests, tokens: usage.tokens, request_limit: config.dailyRequestLimit, token_limit: config.dailyTokenLimit },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export const config: Config = { path: '/api/ai-status', method: 'GET' }
