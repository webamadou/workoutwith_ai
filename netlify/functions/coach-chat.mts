import type { Config } from '@netlify/functions'
import { coachChat } from '../../server/coach/service'
import { authenticate, errorResponse, HttpError, json, readJson, UUID } from '../../server/http'

export default async (req: Request) => {
  try {
    const { db, userId } = await authenticate(req)
    const body = await readJson<{ message?: unknown; conversation_id?: unknown }>(req)
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message || message.length > 2000) throw new HttpError(400, 'Message vide ou trop long (2000 caractères maximum).', 'bad_message')
    const conv = body.conversation_id
    if (conv !== undefined && (typeof conv !== 'string' || !UUID.test(conv))) throw new HttpError(400, 'Conversation invalide.', 'bad_conversation')
    return json(await coachChat(db, userId, message, conv as string | undefined))
  } catch (e) {
    return errorResponse(e)
  }
}

export const config: Config = { path: '/api/coach-chat', method: 'POST' }
