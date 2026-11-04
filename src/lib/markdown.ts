// Rendu Markdown minimal et sûr pour les réponses du coach : paragraphes, listes, gras, italique.
// Le texte est échappé AVANT toute mise en forme : aucun HTML venant du modèle n'est interprété.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')

export function renderMarkdown(text: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const close = () => { if (list) out.push(`</${list}>`); list = null }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const ul = line.match(/^\s*[-•*]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
      continue
    }
    close()
    if (!line.trim()) continue
    const h = line.match(/^#{1,4}\s+(.*)$/)
    out.push(h ? `<p><strong>${inline(h[1])}</strong></p>` : `<p>${inline(line)}</p>`)
  }
  close()
  return out.join('')
}
