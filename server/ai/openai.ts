import OpenAI from 'openai'
import { mapError } from './errors'
import { AIError, type AIProvider, type ChatRequest, type ChatResult, type StructuredRequest, type StructuredResult } from './types'

/** Adaptateur OpenAI basé sur la Responses API. */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const
  private client: OpenAI

  constructor(apiKey: string, timeoutMs: number) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 })
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const tools: OpenAI.Responses.FunctionTool[] = req.tools.map((t) => ({
      type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false,
    }))
    const usage = { inputTokens: 0, outputTokens: 0 }
    const toolCalls: ChatResult['toolCalls'] = []
    let input: OpenAI.Responses.ResponseInput = req.messages.map((m) => ({ role: m.role, content: m.content }))
    let previous: string | undefined
    try {
      for (let round = 0; ; round++) {
        const res = await this.client.responses.create({
          model: req.model, instructions: req.system, input, previous_response_id: previous,
          max_output_tokens: req.maxOutputTokens,
          tools: round < req.maxToolRounds ? tools : undefined,
        })
        usage.inputTokens += res.usage?.input_tokens ?? 0
        usage.outputTokens += res.usage?.output_tokens ?? 0
        const calls = res.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === 'function_call')
        if (!calls.length) {
          const text = res.output_text.trim()
          if (!text) throw new AIError(res.status === 'incomplete' ? 'invalid_response' : 'refused', 'réponse vide', this.id, usage)
          return { text, model: res.model, usage, toolCalls }
        }
        const outputs: OpenAI.Responses.ResponseInputItem[] = []
        for (const call of calls) {
          const tool = req.tools.find((t) => t.name === call.name)
          let output: string
          try {
            if (!tool) throw new Error(`outil inconnu : ${call.name}`)
            output = JSON.stringify(await tool.run(JSON.parse(call.arguments || '{}')))
            toolCalls.push({ name: call.name, ok: true })
          } catch (e) {
            output = JSON.stringify({ error: (e as Error).message })
            toolCalls.push({ name: call.name, ok: false })
          }
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output })
        }
        previous = res.id
        input = outputs
      }
    } catch (e) {
      const err = mapError(e, this.id)
      err.usage ??= usage
      throw err
    }
  }

  async generateStructured(req: StructuredRequest): Promise<StructuredResult> {
    try {
      const res = await this.client.responses.create({
        model: req.model, instructions: req.system, max_output_tokens: req.maxOutputTokens,
        input: req.images?.length
          ? [{
            role: 'user',
            content: [
              ...req.images.map((img): OpenAI.Responses.ResponseInputImage => ({ type: 'input_image', detail: 'auto', image_url: `data:${img.mediaType};base64,${img.base64}` })),
              { type: 'input_text', text: req.prompt },
            ],
          }]
          : req.prompt,
        text: { format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true } },
      })
      const usage = { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 }
      try {
        return { data: JSON.parse(res.output_text), model: res.model, usage }
      } catch {
        throw new AIError('invalid_response', 'JSON invalide', this.id, usage)
      }
    } catch (e) {
      throw mapError(e, this.id)
    }
  }
}
