// Logique métier du coach, indépendante du fournisseur IA.
import { loadConfig, type AIConfig } from '../ai/config'
import { providerOrder, runWithProviders } from '../ai/registry'
import { AIError, type ChatTurn, type ProviderId, type Usage } from '../ai/types'
import { buildContext, describeSession } from './context'
import { loadUserData, type DB } from './data'
import { z } from 'zod'
import type { ImageInput } from '../ai/types'
import { ANALYSIS_INSTRUCTIONS, ANALYSIS_JSON_SCHEMA, COACH_PRINCIPLES, EQUIPMENT_JSON_SCHEMA, EQUIPMENT_KEYS, EQUIPMENT_VISION_INSTRUCTIONS } from './prompts'
import { coachTools, saveProposal, type ProposalContext } from './tools'

const HISTORY_TURNS = 12 // messages précédents renvoyés au modèle
const MAX_TOOL_ROUNDS = 4

export async function usageToday(db: DB) {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { data, error } = await db.from('ai_usage_logs').select('input_tokens, output_tokens, created_at').gte('created_at', since.toISOString())
  if (error) throw new Error(error.message)
  const minuteAgo = Date.now() - 60_000
  return {
    requests: data.length,
    tokens: data.reduce((n, r) => n + r.input_tokens + r.output_tokens, 0),
    lastMinute: data.filter((r) => Date.parse(r.created_at) > minuteAgo).length,
  }
}

/** Limites par utilisateur : quotas journaliers et protection contre les rafales. */
export async function assertWithinLimits(db: DB, config: AIConfig) {
  const u = await usageToday(db)
  if (u.lastMinute >= 8) throw new AIError('rate_limited', 'trop de requêtes par minute')
  if (config.dailyRequestLimit > 0 && u.requests >= config.dailyRequestLimit) throw new AIError('limit_reached', 'quota de requêtes')
  if (config.dailyTokenLimit > 0 && u.tokens >= config.dailyTokenLimit) throw new AIError('limit_reached', 'quota de jetons')
}

async function logUsage(db: DB, entry: { provider: ProviderId; model: string; task: string; usage?: Usage; latency: number; error?: AIError }) {
  // Jamais de contenu ni de secret : uniquement des compteurs.
  await db.from('ai_usage_logs').insert({
    provider: entry.provider, model: entry.model || 'inconnu', task: entry.task,
    input_tokens: entry.usage?.inputTokens ?? 0, output_tokens: entry.usage?.outputTokens ?? 0,
    latency_ms: entry.latency, status: entry.error ? 'error' : 'ok', error_code: entry.error?.code ?? null,
  })
}

function modelFor(config: AIConfig, id: ProviderId, kind: 'chat' | 'analysis' | 'vision') {
  const m = config.models[id][kind] ?? config.models[id].chat
  if (!m) throw new AIError('not_configured', `modèle ${kind} manquant`, id)
  return m
}

export async function coachChat(db: DB, userId: string, message: string, conversationId?: string) {
  const config = loadConfig()
  await assertWithinLimits(db, config)
  const data = await loadUserData(db, userId)
  const order = providerOrder(config, data.profile.ai_provider)
  if (!order.length) throw new AIError('not_configured', 'aucun fournisseur')

  // Conversation existante (RLS : seulement celles de l'utilisateur) ou nouvelle.
  let convId = conversationId
  let history: ChatTurn[] = []
  if (convId) {
    const { data: rows, error } = await db.from('coach_messages').select('role, content').eq('conversation_id', convId)
      .order('created_at', { ascending: false }).limit(HISTORY_TURNS)
    if (error) throw new Error(error.message)
    history = rows.reverse().map((r) => ({ role: r.role, content: r.content }))
  } else {
    const { data: c, error } = await db.from('coach_conversations').insert({ title: message.slice(0, 80) }).select('id').single()
    if (error) throw new Error(error.message)
    convId = c.id
  }
  const { error: insErr } = await db.from('coach_messages').insert({ conversation_id: convId, role: 'user', content: message })
  if (insErr) throw new Error(insErr.message)

  let currentModel = ''
  let currentProvider: ProviderId = order[0]
  const ctx: ProposalContext = { db, data, provider: order[0], model: () => currentModel, conversationId: convId, created: [] }
  const system = `${COACH_PRINCIPLES}\n\n# Données de l'utilisateur\n${buildContext(data, message)}`

  const result = await runWithProviders(order, config, async (provider, id) => {
    currentProvider = id
    ctx.provider = id
    currentModel = modelFor(config, id, 'chat')
    const t0 = Date.now()
    try {
      const r = await provider.chat({
        model: currentModel, system, messages: [...history, { role: 'user', content: message }],
        tools: coachTools(ctx), maxOutputTokens: config.maxOutputTokens, maxToolRounds: MAX_TOOL_ROUNDS,
      })
      await logUsage(db, { provider: id, model: r.model, task: 'chat', usage: r.usage, latency: Date.now() - t0 })
      return r
    } catch (e) {
      const err = e as AIError
      await logUsage(db, { provider: id, model: currentModel, task: 'chat', usage: err.usage, latency: Date.now() - t0, error: err })
      throw err
    }
  })

  const { data: saved, error } = await db.from('coach_messages').insert({
    conversation_id: convId, role: 'assistant', content: result.text,
    metadata: { provider: currentProvider, model: result.model, recommendation_ids: ctx.created, tools: result.toolCalls },
  }).select('id, content, created_at').single()
  if (error) throw new Error(error.message)
  await db.from('coach_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

  const { data: recs } = ctx.created.length
    ? await db.from('coach_recommendations').select('*').in('id', ctx.created)
    : { data: [] }
  return { conversation_id: convId!, message: saved, recommendations: recs ?? [] }
}

export async function analyzeSession(db: DB, userId: string, sessionId: string) {
  const config = loadConfig()
  await assertWithinLimits(db, config)
  const data = await loadUserData(db, userId)
  const session = describeSession(data, sessionId)
  if (!session) throw new AIError('bad_request', 'séance introuvable')
  if (session.status !== 'completed') throw new AIError('bad_request', 'séance non terminée')
  const order = providerOrder(config, data.profile.ai_provider)

  let currentModel = ''
  const ctx: ProposalContext = { db, data, provider: order[0], model: () => currentModel, sessionId, created: [] }
  const prompt = `# Données de l'utilisateur\n${buildContext(data, 'séance douleur difficulté')}\n\n# Séance à analyser\n${JSON.stringify(session)}`

  const result = await runWithProviders(order, config, async (provider, id) => {
    ctx.provider = id
    currentModel = modelFor(config, id, 'analysis')
    const t0 = Date.now()
    try {
      const r = await provider.generateStructured({
        model: currentModel, system: ANALYSIS_INSTRUCTIONS, prompt, schemaName: 'session_analysis',
        schema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>, maxOutputTokens: config.maxOutputTokens,
      })
      await logUsage(db, { provider: id, model: r.model, task: 'session_analysis', usage: r.usage, latency: Date.now() - t0 })
      return r
    } catch (e) {
      const err = e as AIError
      await logUsage(db, { provider: id, model: currentModel, task: 'session_analysis', usage: err.usage, latency: Date.now() - t0, error: err })
      throw err
    }
  })

  const a = result.data as { title?: string; summary?: string; highlights?: string[]; difficulties?: string[]; rationale?: string; adjustments?: unknown[] }
  if (typeof a?.summary !== 'string' || typeof a.title !== 'string') throw new AIError('invalid_response', 'analyse incomplète')
  const details = { highlights: (a.highlights ?? []).map(String).slice(0, 8), difficulties: (a.difficulties ?? []).map(String).slice(0, 8) }
  let r = await saveProposal(ctx, { kind: 'session_analysis', title: a.title, summary: a.summary, rationale: a.rationale ?? '', adjustments: a.adjustments ?? [], details })
  if (!r.ok) {
    // Ajustements refusés par les garde-fous : on garde l'analyse, sans modification du programme, et on l'explique.
    const note = `\n\nAjustement proposé non retenu par les garde-fous : ${(r.violations ?? []).join(' ')}`
    r = await saveProposal(ctx, { kind: 'session_analysis', title: a.title, summary: a.summary, rationale: (a.rationale ?? '') + note, adjustments: [], details })
  }
  const { data: rec, error } = await db.from('coach_recommendations').select('*').eq('id', (r as { recommendation_id: string }).recommendation_id).single()
  if (error) throw new Error(error.message)
  return { recommendation: rec }
}

const equipmentResult = z.object({
  items: z.array(z.object({
    equipment_key: z.enum(EQUIPMENT_KEYS),
    label: z.string().max(120),
    quantity: z.number().int().min(1).max(100).nullable(),
    details: z.string().max(200).nullable(),
    confidence: z.enum(['low', 'medium', 'high']),
  })).max(30),
  notes: z.string().max(1000),
})

/** Suggère un inventaire à partir de photos. Rien n'est enregistré : l'utilisateur confirme ou corrige. */
export async function analyzeEquipmentPhotos(db: DB, userId: string, images: ImageInput[]) {
  const config = loadConfig()
  await assertWithinLimits(db, config)
  const { data: profile } = await db.from('profiles').select('ai_provider').eq('id', userId).single()
  const order = providerOrder(config, profile?.ai_provider)
  let currentModel = ''
  const result = await runWithProviders(order, config, async (provider, id) => {
    currentModel = modelFor(config, id, 'vision')
    const t0 = Date.now()
    try {
      const r = await provider.generateStructured({
        model: currentModel, system: EQUIPMENT_VISION_INSTRUCTIONS, images, schemaName: 'equipment_inventory',
        prompt: `Inventorie le matériel visible sur ${images.length > 1 ? `ces ${images.length} photos` : 'cette photo'}.`,
        schema: EQUIPMENT_JSON_SCHEMA as unknown as Record<string, unknown>, maxOutputTokens: config.maxOutputTokens,
      })
      await logUsage(db, { provider: id, model: r.model, task: 'equipment_vision', usage: r.usage, latency: Date.now() - t0 })
      return { ...r, provider: id }
    } catch (e) {
      const err = e as AIError
      await logUsage(db, { provider: id, model: currentModel, task: 'equipment_vision', usage: err.usage, latency: Date.now() - t0, error: err })
      throw err
    }
  })
  const parsed = equipmentResult.safeParse(result.data)
  if (!parsed.success) throw new AIError('invalid_response', 'inventaire invalide', result.provider)
  return { ...parsed.data, provider: result.provider, model: result.model }
}
