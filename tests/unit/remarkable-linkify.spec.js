import { describe, expect, it } from 'vitest'
import { Remarkable } from 'remarkable'
import { linkify } from '../../src/utils/remarkableLinkify'

function render (text) {
  return new Remarkable({ html: true, breaks: true }).use(linkify).render(text)
}

describe('remarkable linkify', () => {
  it('links explicit URLs', () => {
    expect(render('See https://example.com/a?x=1&y=2 now'))
      .toContain('href="https://example.com/a?x=1&amp;y=2"')
  })

  it('links www and fuzzy domains, including newer TLDs', () => {
    const html = render('www.example.com, foo.bar and hello.world')
    expect(html).toContain('href="http://www.example.com"')
    expect(html).toContain('href="http://foo.bar"')
    expect(html).toContain('href="http://hello.world"')
  })

  it('links email addresses', () => {
    expect(render('Mail me@example.com')).toContain('href="mailto:me@example.com"')
  })

  it('stops at trailing punctuation and brackets', () => {
    const html = render('(https://example.com/a).')
    expect(html).toContain('href="https://example.com/a"')
    expect(html).not.toContain('href="https://example.com/a).')
  })

  it('does not link plain numbers or dangerous schemes', () => {
    const html = render('version 1.2.3 javascript:alert(1) a@b')
    expect(html).not.toContain('<a ')
  })

  it('leaves markdown links alone', () => {
    const html = render('[label](https://example.com/md)')
    expect(html).toContain('href="https://example.com/md"')
    expect(html.match(/<a /g)).toHaveLength(1)
  })
})
