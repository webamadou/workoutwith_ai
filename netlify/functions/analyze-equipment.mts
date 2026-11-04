import type { Config } from '@netlify/functions'
import { analyzeEquipmentPhotos } from '../../server/coach/service'
import { authenticate, errorResponse, HttpError, json, readJson } from '../../server/http'
import type { ImageInput } from '../../server/ai/types'

const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_IMAGES = 4
const MAX_B64 = 2_000_000 // ~1,5 Mo par image (les photos sont redimensionnées dans le navigateur)

// Les photos sont transmises au fournisseur IA pour cette analyse uniquement : elles ne sont pas stockées.
export default async (req: Request) => {
  try {
    const { db, userId } = await authenticate(req)
    const { images } = await readJson<{ images?: unknown }>(req, MAX_IMAGES * MAX_B64 + 10_000)
    if (!Array.isArray(images) || !images.length || images.length > MAX_IMAGES) throw new HttpError(400, `Envoyez entre 1 et ${MAX_IMAGES} photos.`, 'bad_images')
    const clean: ImageInput[] = images.map((img) => {
      const i = img as { mediaType?: unknown; base64?: unknown }
      if (!TYPES.includes(i.mediaType as never) || typeof i.base64 !== 'string' || i.base64.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(i.base64)) {
        throw new HttpError(400, 'Format de photo non pris en charge (JPEG, PNG ou WebP, 1,5 Mo maximum).', 'bad_images')
      }
      return { mediaType: i.mediaType as ImageInput['mediaType'], base64: i.base64 }
    })
    return json(await analyzeEquipmentPhotos(db, userId, clean))
  } catch (e) {
    return errorResponse(e)
  }
}

export const config: Config = { path: '/api/analyze-equipment', method: 'POST' }
