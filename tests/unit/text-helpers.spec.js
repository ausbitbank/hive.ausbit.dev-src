import { describe, expect, it } from 'vitest'
import { stripHtml, safeJsonParse } from '../../src/utils/safeHtml'

describe('stripHtml', () => {
  it('removes tags, keeps their text and decodes HTML entities', () => {
    const cases = [
      ['<p>Hello <strong>world</strong></p>', 'Hello world'],
      ['<a href="https://example.com">link</a>', 'link'],
      ['A &amp; B &lt; C &gt; D', 'A & B < C > D'],
      ['&quot;quoted&quot; &#39;text&#39;', '"quoted" \'text\'']
    ]
    for (const [input, expected] of cases) expect(stripHtml(input)).toBe(expected)
  })

  it('adds spacing around block elements and collapses whitespace', () => {
    const cases = [
      ['<p>one</p><p>two</p>', 'one two'],
      ['<div>one</div><div>two</div>', 'one two'],
      ['one<br>two', 'one two'],
      ['<h1>Title</h1><p>Body</p>', 'Title Body'],
      ['<ul><li>one</li><li>two</li></ul>', 'one two'],
      ['  hello \n\t world  ', 'hello world'],
      ['<p>a</p>\n\n<p>b</p>', 'a b']
    ]
    for (const [input, expected] of cases) expect(stripHtml(input)).toBe(expected)
  })

  it('removes script, style and noscript content entirely', () => {
    expect(stripHtml('<p>visible</p><script>alert(1)</script>')).toBe('visible')
    expect(stripHtml('<style>.x { color: red }</style><p>visible</p>')).toBe('visible')
    expect(stripHtml('<p>a</p><noscript>fallback</noscript><p>b</p>')).toBe('a b')
  })

  it('returns an empty string for null and non-string input', () => {
    for (const value of [null, undefined, 42, { text: 'no' }, '']) {
      expect(stripHtml(value)).toBe('')
    }
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON objects', () => {
    const metadata = { profile: { name: 'Alice' }, tags: ['hive'] }
    expect(safeJsonParse(JSON.stringify(metadata))).toEqual(metadata)
    expect(safeJsonParse('{}')).toEqual({})
  })

  it('returns the fallback for invalid, primitive or non-string input', () => {
    const fallback = { profile: {} }
    const invalid = [
      '{not json',
      '',
      '{"unterminated":',
      '42',
      '"text"',
      'true',
      'null',
      null,
      undefined,
      42,
      { already: 'parsed' }
    ]
    for (const value of invalid) expect(safeJsonParse(value, fallback)).toBe(fallback)
  })

  it('defaults the fallback to an empty object', () => {
    expect(safeJsonParse('oops')).toEqual({})
    expect(safeJsonParse('42')).toEqual({})
  })
})
