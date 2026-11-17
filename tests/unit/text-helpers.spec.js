import { describe, expect, it } from 'vitest'
import { stripHtml, safeJsonParse } from '../../src/utils/safeHtml'

describe('stripHtml', () => {
  it('removes tags and keeps their text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
    expect(stripHtml('<a href="https://example.com">link</a>')).toBe('link')
  })

  it('decodes HTML entities', () => {
    expect(stripHtml('A &amp; B &lt; C &gt; D')).toBe('A & B < C > D')
    expect(stripHtml('&quot;quoted&quot; &#39;text&#39;')).toBe('"quoted" \'text\'')
  })

  it('adds spacing around block elements', () => {
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one two')
    expect(stripHtml('<div>one</div><div>two</div>')).toBe('one two')
    expect(stripHtml('one<br>two')).toBe('one two')
    expect(stripHtml('<h1>Title</h1><p>Body</p>')).toBe('Title Body')
    expect(stripHtml('<ul><li>one</li><li>two</li></ul>')).toBe('one two')
  })

  it('collapses whitespace', () => {
    expect(stripHtml('  hello \n\t world  ')).toBe('hello world')
    expect(stripHtml('<p>a</p>\n\n<p>b</p>')).toBe('a b')
  })

  it('removes script and style content entirely', () => {
    expect(stripHtml('<p>visible</p><script>alert(1)</script>')).toBe('visible')
    expect(stripHtml('<style>.x { color: red }</style><p>visible</p>')).toBe('visible')
    expect(stripHtml('<p>a</p><noscript>fallback</noscript><p>b</p>')).toBe('a b')
  })

  it('returns an empty string for null and non-string input', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml(42)).toBe('')
    expect(stripHtml({ text: 'no' })).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON objects', () => {
    const metadata = { profile: { name: 'Alice' }, tags: ['hive'] }
    expect(safeJsonParse(JSON.stringify(metadata))).toEqual(metadata)
    expect(safeJsonParse('{}')).toEqual({})
  })

  it('returns the fallback for invalid JSON', () => {
    const fallback = { profile: {} }
    expect(safeJsonParse('{not json', fallback)).toBe(fallback)
    expect(safeJsonParse('', fallback)).toBe(fallback)
    expect(safeJsonParse('{"unterminated":', fallback)).toBe(fallback)
  })

  it('returns the fallback for null/undefined and non-string input', () => {
    const fallback = { tags: [] }
    expect(safeJsonParse(null, fallback)).toBe(fallback)
    expect(safeJsonParse(undefined, fallback)).toBe(fallback)
    expect(safeJsonParse(42, fallback)).toBe(fallback)
    expect(safeJsonParse({ already: 'parsed' }, fallback)).toBe(fallback)
  })

  it('returns the fallback for primitive JSON values', () => {
    const fallback = {}
    expect(safeJsonParse('42', fallback)).toBe(fallback)
    expect(safeJsonParse('"text"', fallback)).toBe(fallback)
    expect(safeJsonParse('true', fallback)).toBe(fallback)
    expect(safeJsonParse('null', fallback)).toBe(fallback)
  })

  it('defaults the fallback to an empty object', () => {
    expect(safeJsonParse('oops')).toEqual({})
    expect(safeJsonParse('42')).toEqual({})
  })
})
