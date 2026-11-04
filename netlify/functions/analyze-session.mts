import type { Config } from '@netlify/functions'
import { analyzeSession } from '../../server/coach/service'
import { authenticate, errorResponse, HttpError, json, readJson, UUID } from '../../server/http'

export default async (req: Request) => {
  try {
    const { db, userId } = await authenticate(req)
    const { session_id } = await readJson<{ session_id?: unknown }>(req)
    if (typeof session_id !== 'string' || !UUID.test(session_id)) throw new HttpError(400, 'Séance invalide.', 'bad_session')
    return json(await analyzeSession(db, userId, session_id))
  } catch (e) {
    return errorResponse(e)
  }
}

export const config: Config = { path: '/api/analyze-session', method: 'POST' }
