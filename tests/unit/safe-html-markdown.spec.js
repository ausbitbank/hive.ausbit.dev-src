import { describe, expect, it } from 'vitest'
import { simpleMarkdownToHtml, stripHtml } from '../../src/utils/safeHtml'

const XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<svg onload=alert(1)>'
]

describe('simpleMarkdownToHtml', () => {
  it('returns an empty string for non-string input', () => {
    expect(simpleMarkdownToHtml(null)).toBe('')
    expect(simpleMarkdownToHtml(undefined)).toBe('')
    expect(simpleMarkdownToHtml(42)).toBe('')
    expect(simpleMarkdownToHtml('')).toBe('')
  })

  it.each(XSS)('escapes raw HTML %s', value => {
    const html = simpleMarkdownToHtml(value)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<svg')
    expect(html).toContain('&lt;')
  })

  it('renders only http(s) Markdown links', () => {
    expect(simpleMarkdownToHtml('[site](https://banksia.io)')).toBe('<p><a href="https://banksia.io" target="_blank" rel="noopener noreferrer">site</a></p>')
    expect(simpleMarkdownToHtml('[plain](http://banksia.io)')).toBe('<p><a href="http://banksia.io" target="_blank" rel="noopener noreferrer">plain</a></p>')
    expect(simpleMarkdownToHtml('[bad](javascript:alert(1))')).toBe('<p>[bad](javascript:alert(1))</p>')
  })

  it('renders bold, italics, paragraphs and line breaks', () => {
    expect(simpleMarkdownToHtml('**bold** and *soft*')).toBe('<p><strong>bold</strong> and <em>soft</em></p>')
    expect(simpleMarkdownToHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>')
  })

  it('escapes ampersands before inserting entities', () => {
    expect(simpleMarkdownToHtml('a & b')).toBe('<p>a &amp; b</p>')
  })
})

describe('stripHtml', () => {
  it('turns block tags into words and drops scripts', () => {
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one two')
    expect(stripHtml('a<script>alert(1)</script>b')).toBe('ab')
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(12)).toBe('')
  })
})
