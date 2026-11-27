import { describe, expect, it } from 'vitest'
import { buildBlogSocialCardModel, wrapTextLines } from '../../src/services/blogSocialCard'

describe('blog social card model', () => {
  it('uses the Paper theme by default', () => {
    const model = buildBlogSocialCardModel({
      title: 'Notes from the garden',
      account: 'Alice',
      description: 'A quiet place to read.'
    })
    expect(model.themeId).toBe('paper')
    expect(model.background).toBe('#fbf8f1')
    expect(model.text).toBe('#1c1917')
    expect(model.accent).toBe('#8a3b12')
    expect(model.title).toBe('Notes from the garden')
    expect(model.account).toBe('alice')
    expect(model.footer).toBe('alice.banksia.io')
    expect(model.fonts.title).toContain('Georgia')
    expect(model.titleSize).toBe(88)
  })

  it('renders the terminal theme in monospace', () => {
    const model = buildBlogSocialCardModel({ theme: 'terminal', account: 'alice' })
    expect(model.themeId).toBe('terminal')
    expect(model.fonts.title).toContain('monospace')
    expect(model.titleSize).toBe(66)
    expect(model.title).toBe('@alice')
  })

  it('applies a valid accent and ignores arbitrary CSS', () => {
    expect(buildBlogSocialCardModel({ accent: '#123abc' }).accent).toBe('#123abc')
    expect(buildBlogSocialCardModel({ accent: 'red' }).accent).toBe('#8a3b12')
  })

  it('falls back to the generic title and address', () => {
    const model = buildBlogSocialCardModel({})
    expect(model.title).toBe('A Hive blog')
    expect(model.footer).toBe('banksia.io')
  })
})

describe('wrapTextLines', () => {
  const measure = value => value.length * 10

  it('wraps at the measured width', () => {
    expect(wrapTextLines('one two three four', 50, 2, measure)).toEqual(['one', 'two…'])
  })

  it('keeps a line that fits', () => {
    expect(wrapTextLines('one two', 100, 2, measure)).toEqual(['one two'])
  })

  it('returns nothing for empty text', () => {
    expect(wrapTextLines('', 100, 2, measure)).toEqual([])
    expect(wrapTextLines('one', 100, 0, measure)).toEqual([])
  })
})
