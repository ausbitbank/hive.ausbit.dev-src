import { describe, expect, it } from 'vitest'
import { buildBlogSocialCardModel, drawBlogSocialCard, wrapTextLines } from '../../src/services/blogSocialCard'

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

  it('supports the journal and gallery themes', () => {
    expect(buildBlogSocialCardModel({ theme: 'journal' }).fonts.title).toContain('Georgia')
    expect(buildBlogSocialCardModel({ theme: 'gallery' }).fonts.title).toContain('Roboto')
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

describe('blog social card drawing', () => {
  function fakeContext () {
    const measurements = []
    const fills = []
    return {
      font: '',
      measurements,
      fills,
      clearRect () {},
      fillRect () {},
      save () {},
      restore () {},
      beginPath () {},
      arc () {},
      fill () {},
      fillText (text) { fills.push({ font: this.font, text }) },
      measureText (text) {
        measurements.push({ font: this.font, text })
        const size = Number((this.font.match(/(\d+)px/) || [])[1]) || 10
        return { width: String(text).length * size * 0.5 }
      }
    }
  }

  it('measures each block with the font it is drawn in', () => {
    const model = buildBlogSocialCardModel({
      title: 'A very long title about gardening, seasons, soil and the slow work of tending a patch of earth through the year',
      account: 'alice',
      description: 'Notes on what grew, what failed, and what to try again next spring. Read the full archive on the blog.'
    })
    const ctx = fakeContext()
    drawBlogSocialCard(ctx, model)

    const fonts = new Set(ctx.measurements.map(entry => entry.font))
    expect(fonts).toEqual(new Set([model.fonts.title, model.fonts.body]))
    expect(ctx.measurements.some(entry => entry.font === model.fonts.label)).toBe(false)

    const titleLines = ctx.fills.filter(entry => entry.font === model.fonts.title)
    expect(titleLines.length).toBeGreaterThan(1)
    expect(ctx.fills.some(entry => entry.font === model.fonts.body)).toBe(true)
  })
})
