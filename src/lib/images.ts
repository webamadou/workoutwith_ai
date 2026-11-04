/** Redimensionne une photo dans le navigateur (JPEG) avant envoi : moins de données, métadonnées EXIF retirées. */
export async function toJpegBase64(file: File, maxSide = 1280, quality = 0.82): Promise<{ mediaType: 'image/jpeg'; base64: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`Format de photo non lisible par ce navigateur (${file.type || file.name}). Essayez en JPEG ou PNG.`)
  })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
