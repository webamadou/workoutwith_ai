import { describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { loadConfig } from '../../server/ai/config'
import { providerOrder, runWithProviders } from '../../server/ai/registry'
import { mapError } from '../../server/ai/errors'
import { AnthropicProvider } from '../../server/ai/anthropic'
import { OpenAIProvider } from '../../server/ai/openai'
import { AIError, type ToolDef } from '../../server/ai/types'
import { normalizeAdjustment } from '../../server/coach/prompts'

// Configuration fictive : aucune clé réelle n'est utilisée, aucun appel réseau n'est effectué.
const env = (extra: Record<string, string> = {}) => loadConfig({
  ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_CHAT_MODEL: 'model-a', OPENAI_API_KEY: 'test-key', OPENAI_CHAT_MODEL: 'model-o', ...extra,
})

describe('sélection du fournisseur', () => {
  it('désactive l’IA sans clé ou sans modèle', () => {
    expect(providerOrder(loadConfig({}))).toEqual([])
    expect(providerOrder(loadConfig({ OPENAI_API_KEY: 'k' }))).toEqual([])
  })

  it('respecte la préférence puis le fournisseur par défaut', () => {
    expect(providerOrder(env({ AI_DEFAULT_PROVIDER: 'openai' }))).toEqual(['openai'])
    expect(providerOrder(env({ AI_DEFAULT_PROVIDER: 'openai' }), 'anthropic')).toEqual(['anthropic'])
  })

  it('n’ajoute un secours que s’il est explicitement autorisé', () => {
    expect(providerOrder(env({ AI_DEFAULT_PROVIDER: 'anthropic' }))).toHaveLength(1)
    expect(providerOrder(env({ AI_DEFAULT_PROVIDER: 'anthropic', AI_FALLBACK_PROVIDER: 'openai' }))).toEqual(['anthropic', 'openai'])
  })

  it('bascule uniquement sur erreur temporaire', async () => {
    const config = env()
    const calls: string[] = []
    const r = await runWithProviders(['anthropic', 'openai'], config, async (_p, id) => {
      calls.push(id)
      if (id === 'anthropic') throw new AIError('unavailable', 'down', id)
      return 'ok'
    })
    expect(r).toBe('ok')
    expect(calls).toEqual(['anthropic', 'openai'])

    calls.length = 0
    await expect(runWithProviders(['anthropic', 'openai'], config, async (_p, id) => {
      calls.push(id)
      throw new AIError('auth', 'bad key', id)
    })).rejects.toMatchObject({ code: 'auth' })
    expect(calls).toEqual(['anthropic'])
  })
})

describe('traduction des erreurs SDK', () => {
  it('reconnaît limites, quotas, authentification et réseau', () => {
    expect(mapError(new Anthropic.RateLimitError(429, {}, 'slow', new Headers()), 'anthropic').code).toBe('rate_limited')
    expect(mapError(new Anthropic.AuthenticationError(401, {}, 'no', new Headers()), 'anthropic').code).toBe('auth')
    expect(mapError(new Anthropic.APIConnectionError({ message: 'net' }), 'anthropic').code).toBe('unavailable')
    const quota = new OpenAI.RateLimitError(429, { code: 'insufficient_quota' }, 'quota', new Headers())
    expect(mapError(quota, 'openai').code).toBe('quota_exceeded')
  })
})

const echoTool = (spy: (a: Record<string, unknown>) => void): ToolDef => ({
  name: 'get_body_measurements', description: 'test', parameters: { type: 'object', properties: {} },
  run: async (a) => { spy(a); return [{ weight_kg: 74 }] },
})
const chatReq = (tools: ToolDef[]) => ({ model: 'm', system: 's', messages: [{ role: 'user' as const, content: 'Mon poids ?' }], tools, maxOutputTokens: 100, maxToolRounds: 3 })

describe('boucle d’outils', () => {
  it('Anthropic : exécute l’outil puis renvoie le texte final et la consommation', async () => {
    const p = new AnthropicProvider('test-key', 1000)
    const create = vi.fn()
      .mockResolvedValueOnce({ stop_reason: 'tool_use', model: 'm', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'tool_use', id: 't1', name: 'get_body_measurements', input: {} }] })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', model: 'm', usage: { input_tokens: 20, output_tokens: 7 }, content: [{ type: 'text', text: '74 kg enregistrés.' }] })
    ;(p as unknown as { client: unknown }).client = { messages: { create } }
    const spy = vi.fn()
    const r = await p.chat(chatReq([echoTool(spy)]))
    expect(r).toMatchObject({ text: '74 kg enregistrés.', usage: { inputTokens: 30, outputTokens: 12 }, toolCalls: [{ name: 'get_body_measurements', ok: true }] })
    expect(spy).toHaveBeenCalledOnce()
    const second = create.mock.calls[1][0]
    expect(second.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' })
  })

  it('Anthropic : signale un refus', async () => {
    const p = new AnthropicProvider('test-key', 1000)
    ;(p as unknown as { client: unknown }).client = { messages: { create: vi.fn().mockResolvedValue({ stop_reason: 'refusal', model: 'm', usage: { input_tokens: 1, output_tokens: 0 }, content: [] }) } }
    await expect(p.chat(chatReq([]))).rejects.toMatchObject({ code: 'refused' })
  })

  it('OpenAI : renvoie les résultats d’outils via previous_response_id', async () => {
    const p = new OpenAIProvider('test-key', 1000)
    const create = vi.fn()
      .mockResolvedValueOnce({ id: 'r1', model: 'm', status: 'completed', output_text: '', usage: { input_tokens: 8, output_tokens: 3 }, output: [{ type: 'function_call', call_id: 'c1', name: 'get_body_measurements', arguments: '{}' }] })
      .mockResolvedValueOnce({ id: 'r2', model: 'm', status: 'completed', output_text: 'Vous pesez 74 kg.', usage: { input_tokens: 9, output_tokens: 4 }, output: [{ type: 'message' }] })
    ;(p as unknown as { client: unknown }).client = { responses: { create } }
    const r = await p.chat(chatReq([echoTool(() => {})]))
    expect(r.text).toBe('Vous pesez 74 kg.')
    expect(r.usage).toEqual({ inputTokens: 17, outputTokens: 7 })
    expect(create.mock.calls[1][0]).toMatchObject({ previous_response_id: 'r1', input: [{ type: 'function_call_output', call_id: 'c1' }] })
  })

  it('OpenAI : sortie structurée invalide → erreur explicite', async () => {
    const p = new OpenAIProvider('test-key', 1000)
    ;(p as unknown as { client: unknown }).client = { responses: { create: vi.fn().mockResolvedValue({ model: 'm', output_text: 'pas du json', usage: {} }) } }
    await expect(p.generateStructured({ model: 'm', system: 's', prompt: 'p', schemaName: 'x', schema: {}, maxOutputTokens: 10 }))
      .rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('ajustements produits par l’IA', () => {
  it('convertit le format à plat et rejette les formats invalides', () => {
    expect(normalizeAdjustment({ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, to_week: null, day_of_week: null, sets: 3, reps_min: 10, reps_max: 12, new_exercise_slug: null, duration_s: null, rest_s: null, load_kg: null }))
      .toEqual({ type: 'update_targets', exercise_slug: 'pompes', from_week: 3, sets: 3, reps_min: 10, reps_max: 12 })
    expect(normalizeAdjustment({ type: 'replace_exercise', exercise_slug: 'pompes', from_week: 3 })).toBeNull()
    expect(normalizeAdjustment('n’importe quoi')).toBeNull()
  })
})

describe('analyse d’images (multimodal)', () => {
  const req = { model: 'm', system: 's', prompt: 'Inventorie', schemaName: 'equipment_inventory', schema: { type: 'object' }, maxOutputTokens: 100,
    images: [{ mediaType: 'image/jpeg' as const, base64: 'AAAA' }] }
  const out = { items: [{ equipment_key: 'dumbbell', label: 'Haltère', quantity: 2, details: null, confidence: 'high' }], notes: '' }

  it('Anthropic : envoie l’image en bloc base64 avant le texte, avec sortie structurée', async () => {
    const p = new AnthropicProvider('test-key', 1000)
    const create = vi.fn().mockResolvedValue({ stop_reason: 'end_turn', model: 'm', usage: { input_tokens: 5, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(out) }] })
    ;(p as unknown as { client: unknown }).client = { messages: { create } }
    const r = await p.generateStructured(req)
    expect(r.data).toEqual(out)
    const body = create.mock.calls[0][0]
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } })
    expect(body.output_config.format.type).toBe('json_schema')
  })

  it('OpenAI : envoie l’image en input_image (data URL)', async () => {
    const p = new OpenAIProvider('test-key', 1000)
    const create = vi.fn().mockResolvedValue({ model: 'm', output_text: JSON.stringify(out), usage: { input_tokens: 5, output_tokens: 5 } })
    ;(p as unknown as { client: unknown }).client = { responses: { create } }
    await p.generateStructured(req)
    const body = create.mock.calls[0][0]
    expect(body.input[0].content[0]).toMatchObject({ type: 'input_image', image_url: 'data:image/jpeg;base64,AAAA' })
    expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'equipment_inventory', strict: true })
  })
})

describe('contexte ciblé du coach', async () => {
  const { topicsOf } = await import('../../server/coach/context')
  const d = { exercises: [{ slug: 'pompes', name: 'Pompes' }, { slug: 'squat-goblet', name: 'Squat goblet' }] } as never
  it('détecte exercices et sujets mentionnés', () => {
    const t = topicsOf('Comment améliorer mes pompes ?', d)
    expect(t.exercises.map((e: { slug: string }) => e.slug)).toEqual(['pompes'])
    expect(t.body).toBe(false)
    expect(topicsOf('Mon tour de taille baisse-t-il ?', d).body).toBe(true)
    expect(topicsOf('Quel groupe musculaire ai-je insuffisamment travaillé ?', d).muscles).toBe(true)
  })
})
