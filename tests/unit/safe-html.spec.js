import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from '../../src/utils/safeRichHtml'

describe('sanitizeRichHtml', () => {
  it('keeps normal rich-text markup', () => {
    const clean = sanitizeRichHtml(
      '<p>Hello <strong>world</strong> <a href="https://example.com" title="Example">link</a></p>'
    )

    expect(clean).toContain('<p>Hello')
    expect(clean).toContain('<strong>world</strong>')
    expect(clean).toContain('href="https://example.com"')
    expect(clean).toContain('title="Example"')
    expect(clean).toContain('link</a>')
  })

  it('removes script elements and their contents', () => {
    const clean = sanitizeRichHtml('<p>before</p><script>alert("xss")</script><p>after</p>')

    expect(clean).toContain('<p>before</p>')
    expect(clean).toContain('<p>after</p>')
    expect(clean).not.toMatch(/<script/i)
    expect(clean).not.toContain('alert')
  })

  it('removes inline event handlers from otherwise normal markup', () => {
    const clean = sanitizeRichHtml(
      '<img src="https://example.com/a.png" onerror="alert(1)" onload="alert(2)">' +
      '<p onclick="alert(3)">text</p>'
    )

    expect(clean).toContain('<img')
    expect(clean).toContain('src="https://example.com/a.png"')
    expect(clean).toContain('<p>text</p>')
    expect(clean).not.toMatch(/onerror/i)
    expect(clean).not.toMatch(/onload/i)
    expect(clean).not.toMatch(/onclick/i)
  })

  it('removes iframes with javascript: sources', () => {
    const clean = sanitizeRichHtml(
      '<iframe src="javascript:alert(1)"></iframe><p>kept</p>'
    )

    expect(clean).not.toMatch(/<iframe/i)
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('<p>kept</p>')
  })

  it('removes iframes from unknown hosts', () => {
    const clean = sanitizeRichHtml(
      '<iframe src="https://evil.example/embed" allowfullscreen></iframe><p>kept</p>'
    )

    expect(clean).not.toMatch(/<iframe/i)
    expect(clean).not.toContain('evil.example')
    expect(clean).toContain('<p>kept</p>')
  })

  it('keeps iframes from allowed https embed hosts', () => {
    const youtube = sanitizeRichHtml(
      '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe>'
    )
    const vimeo = sanitizeRichHtml(
      '<iframe src="https://player.vimeo.com/video/123456" allowfullscreen></iframe>'
    )

    expect(youtube).toMatch(/<iframe/i)
    expect(youtube).toContain('https://www.youtube.com/embed/abc123')
    expect(youtube).toContain('allowfullscreen')

    expect(vimeo).toMatch(/<iframe/i)
    expect(vimeo).toContain('https://player.vimeo.com/video/123456')
    expect(vimeo).toContain('allowfullscreen')
  })

  it('returns an empty string for empty or non-string input', () => {
    expect(sanitizeRichHtml('')).toBe('')
    expect(sanitizeRichHtml(null)).toBe('')
    expect(sanitizeRichHtml(undefined)).toBe('')
    expect(sanitizeRichHtml(42)).toBe('')
  })
})
