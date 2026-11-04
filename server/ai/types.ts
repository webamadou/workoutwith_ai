// Interface commune des fournisseurs IA. La logique métier (server/coach) ne dépend que de ce fichier.

export type ProviderId = 'openai' | 'anthropic'
export type JSONSchema = Record<string, unknown>

export interface ToolDef {
  name: string
  description: string
  parameters: JSONSchema
  run: (args: Record<string, unknown>) => Promise<unknown>
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface ChatRequest {
  model: string
  system: string
  messages: ChatTurn[]
  tools: ToolDef[]
  maxOutputTokens: number
  maxToolRounds: number
}

export interface ChatResult {
  text: string
  model: string
  usage: Usage
  toolCalls: { name: string; ok: boolean }[]
}

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}

export interface StructuredRequest {
  model: string
  system: string
  prompt: string
  /** Images analysées par un modèle multimodal (facultatif). */
  images?: ImageInput[]
  schemaName: string
  schema: JSONSchema
  maxOutputTokens: number
}

export interface StructuredResult {
  data: unknown
  model: string
  usage: Usage
}

export interface AIProvider {
  readonly id: ProviderId
  chat(req: ChatRequest): Promise<ChatResult>
  generateStructured(req: StructuredRequest): Promise<StructuredResult>
}

export type AIErrorCode =
  | 'not_configured' | 'rate_limited' | 'quota_exceeded' | 'unavailable' | 'timeout'
  | 'auth' | 'bad_request' | 'invalid_response' | 'refused' | 'limit_reached'

const RETRYABLE: AIErrorCode[] = ['rate_limited', 'unavailable', 'timeout']

export class AIError extends Error {
  constructor(public code: AIErrorCode, message: string, public provider?: ProviderId, public usage?: Usage) {
    super(message)
  }
  get retryable() {
    return RETRYABLE.includes(this.code)
  }
}

/** Messages présentés à l'utilisateur (sans détail technique ni secret). */
export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  not_configured: 'Le coach IA n’est pas configuré.',
  rate_limited: 'Le fournisseur IA est très sollicité. Réessayez dans un instant.',
  quota_exceeded: 'Le quota du fournisseur IA est épuisé. Vérifiez la facturation du compte fournisseur.',
  unavailable: 'Le fournisseur IA est momentanément indisponible.',
  timeout: 'Le fournisseur IA a mis trop de temps à répondre.',
  auth: 'La clé du fournisseur IA est refusée. Vérifiez la configuration serveur.',
  bad_request: 'La requête au fournisseur IA a été refusée.',
  invalid_response: 'La réponse du coach était inexploitable.',
  refused: 'Le fournisseur IA a refusé de répondre à cette demande.',
  limit_reached: 'Limite quotidienne d’utilisation du coach atteinte.',
}
