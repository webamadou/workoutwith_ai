import Anthropic from '@anthropic-ai/sdk'
import { mapError } from './errors'
import { AIError, type AIProvider, type ChatRequest, type ChatResult, type StructuredRequest, type StructuredResult } from './types'

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string, timeoutMs: number) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 })
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }))
    const tools: Anthropic.Tool[] = req.tools.map((t) => ({
      name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }))
    const usage = { inputTokens: 0, outputTokens: 0 }
    const toolCalls: ChatResult['toolCalls'] = []
    try {
      for (let round = 0; ; round++) {
        const res = await this.client.messages.create({
          model: req.model, max_tokens: req.maxOutputTokens, system: req.system, messages,
          // Dernier tour : plus d'outils, pour obtenir une réponse finale.
          tools: round < req.maxToolRounds ? tools : undefined,
        })
        usage.inputTokens += res.usage.input_tokens
        usage.outputTokens += res.usage.output_tokens
        if (res.stop_reason === 'refusal') throw new AIError('refused', 'refus', this.id, usage)
        if (res.stop_reason !== 'tool_use') {
          const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
          if (!text) throw new AIError('invalid_response', 'réponse vide', this.id, usage)
          return { text, model: res.model, usage, toolCalls }
        }
        messages.push({ role: 'assistant', content: res.content })
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const block of res.content) {
          if (block.type !== 'tool_use') continue
          const tool = req.tools.find((t) => t.name === block.name)
          try {
            if (!tool) throw new Error(`outil inconnu : ${block.name}`)
            const out = await tool.run((block.input ?? {}) as Record<string, unknown>)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
            toolCalls.push({ name: block.name, ok: true })
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: block.id, content: (e as Error).message, is_error: true })
            toolCalls.push({ name: block.name, ok: false })
          }
        }
        messages.push({ role: 'user', content: results })
      }
    } catch (e) {
      const err = mapError(e, this.id)
      err.usage ??= usage
      throw err
    }
  }

  async generateStructured(req: StructuredRequest): Promise<StructuredResult> {
    try {
      const res = await this.client.messages.create({
        model: req.model, max_tokens: req.maxOutputTokens, system: req.system,
        messages: [{
          role: 'user',
          content: [
            ...(req.images ?? []).map((img): Anthropic.ImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } })),
            { type: 'text', text: req.prompt },
          ],
        }],
        output_config: { format: { type: 'json_schema', schema: req.schema } },
      })
      const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
      if (res.stop_reason === 'refusal') throw new AIError('refused', 'refus', this.id, usage)
      const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      try {
        return { data: JSON.parse(text), model: res.model, usage }
      } catch {
        throw new AIError('invalid_response', 'JSON invalide', this.id, usage)
      }
    } catch (e) {
      throw mapError(e, this.id)
    }
  }
}
