import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/markdown'

describe('rendu des réponses du coach', () => {
  it('met en forme gras, listes et paragraphes', () => {
    expect(renderMarkdown('**Bilan**\n- un\n- deux\n\n1. a\n2. b')).toBe('<p><strong>Bilan</strong></p><ul><li>un</li><li>deux</li></ul><ol><li>a</li><li>b</li></ol>')
  })
  it('neutralise tout HTML', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> **<b>x</b>**')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>')
  })
})
