import { describe, expect, it } from 'vitest'
import { BLOG_THEMES, blogOgImagePath, getBlogTheme, resolveBlogTheme } from '../../src/themes/blogThemes'
import { validateTheme } from '../../src/themes/schema'

describe('blog themes', () => {
  it('validates every built-in theme, including contrast', () => {
    for (const theme of BLOG_THEMES) {
      const result = validateTheme(theme)
      expect(result.errors, theme.id).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('ships five themes with opposite-mode variants', () => {
    expect(BLOG_THEMES.map(theme => theme.id)).toEqual(['paper', 'studio', 'terminal', 'journal', 'gallery'])
    expect(getBlogTheme('paper').variants.dark.tokens.text).toBeTruthy()
    expect(getBlogTheme('studio').variants.light.tokens.text).toBeTruthy()
    expect(getBlogTheme('terminal').variants.light.tokens.text).toBeTruthy()
    expect(getBlogTheme('journal').variants.dark.tokens.text).toBeTruthy()
    expect(getBlogTheme('gallery').variants.light.tokens.text).toBeTruthy()
  })

  it('maps themes to deterministic 1200×630 OG images', () => {
    expect(blogOgImagePath('paper')).toBe('/statics/og-blog-paper.png')
    expect(blogOgImagePath('studio')).toBe('/statics/og-blog-studio.png')
    expect(blogOgImagePath('terminal')).toBe('/statics/og-blog-terminal.png')
    expect(blogOgImagePath('journal')).toBe('/statics/og-blog-journal.png')
    expect(blogOgImagePath('gallery')).toBe('/statics/og-blog-gallery.png')
    expect(blogOgImagePath('auto')).toBe('/statics/og-blog-paper.png')
    expect(blogOgImagePath('not-a-theme')).toBe('/statics/og-blog-paper.png')
  })

  it('resolves auto to the account theme and falls back to Paper', () => {
    const custom = { ...BLOG_THEMES[1], id: 'custom' }
    expect(resolveBlogTheme({ theme: 'auto' }, custom)).toBe(custom)
    expect(resolveBlogTheme({ theme: 'auto' }, null).id).toBe('paper')
    expect(resolveBlogTheme({ theme: 'terminal' }, custom).id).toBe('terminal')
    expect(resolveBlogTheme({ theme: 'unknown' }, null).id).toBe('paper')
  })

  it('applies an accent without accepting arbitrary CSS', () => {
    expect(resolveBlogTheme({ theme: 'paper', accent: '#123abc' }, null).tokens.primary).toBe('#123abc')
    expect(resolveBlogTheme({ theme: 'paper', accent: 'red' }, null).tokens.primary)
      .toBe(BLOG_THEMES[0].tokens.primary)
    const variant = resolveBlogTheme({ theme: 'studio', accent: '#123abc' }, null)
    expect(variant.variants.light.tokens.primary).toBe('#123abc')
  })

  it('exposes the theme getter', () => {
    expect(getBlogTheme('studio').name).toBe('Studio')
    expect(getBlogTheme('nope')).toBeNull()
  })
})
