import { describe, expect, it } from 'vitest'
import { blogFeedPosts, buildBlogRss, escapeXml, feedText, rfc822 } from '../../src/services/blogFeed'

const POSTS = [
  {
    author: 'alice',
    permlink: 'older',
    title: 'Older post',
    body: '<p>An older &amp; quieter note.</p>',
    created: '2026-11-01T10:00:00',
    json_metadata: JSON.stringify({ tags: ['hive-123456', 'garden'] })
  },
  {
    author: 'alice',
    permlink: 'newer',
    title: 'Newer <post>',
    body: 'A newer note with a & and a <tag>.',
    created: '2026-11-20T10:00:00',
    json_metadata: JSON.stringify({ tags: ['hive-123456', 'notes', 'notes'] })
  },
  {
    author: 'alice',
    permlink: 'a-comment',
    title: 'A comment',
    parent_author: 'bob',
    depth: 1,
    created: '2026-11-21T10:00:00'
  },
  {
    author: 'alice',
    permlink: 'newer',
    title: 'Duplicate row',
    created: '2026-11-20T10:00:00'
  }
]

describe('RSS helpers', () => {
  it('escapes XML text and attributes', () => {
    expect(escapeXml('a & b < c > d "e" \'f\'')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;')
  })

  it('strips XML-invalid control characters and bidi overrides', () => {
    expect(escapeXml('a\u0001b\u001fc\u202ed')).toBe('abcd')
  })

  it('strips markup without a DOM', () => {
    expect(feedText('<p>One</p><p>Two</p>')).toBe('One Two')
    expect(feedText('x'.repeat(20), 10)).toBe('xxxxxxxxxx…')
  })

  it('formats an RFC 822 date', () => {
    expect(rfc822('2026-11-20T10:00:00Z')).toBe('Fri, 20 Nov 2026 10:00:00 GMT')
    expect(rfc822('not a date')).toBe('')
  })

  it('filters comments, deduplicates and sorts newest first', () => {
    const posts = blogFeedPosts(POSTS, 10)
    expect(posts.map(post => post.permlink)).toEqual(['newer', 'older'])
  })

  it('keeps Vault containers and HOM products out of feeds', () => {
    const posts = blogFeedPosts([
      { author: 'alice', permlink: 'post', title: 'Post', created: '2026-11-20T10:00:00', json_metadata: '{}' },
      { author: 'alice', permlink: 'vault', title: 'Vault', created: '2026-11-21T10:00:00', json_metadata: '{"banksia_vault_container":true}' },
      { author: 'alice', permlink: 'product', title: 'Product', created: '2026-11-22T10:00:00', json_metadata: '{"content_type":"product"}' }
    ], 10)
    expect(posts.map(post => post.permlink)).toEqual(['post'])
  })
})

describe('buildBlogRss', () => {
  it('builds a channel and items with absolute blog links', () => {
    const xml = buildBlogRss({
      account: 'alice',
      title: 'Alice writes',
      description: 'Notes & photographs.',
      posts: POSTS,
      baseUrl: 'https://alice.banksia.io',
      now: new Date('2026-11-27T00:00:00Z')
    })

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<title>Alice writes</title>')
    expect(xml).toContain('<link>https://alice.banksia.io</link>')
    expect(xml).toContain('<description>Notes &amp; photographs.</description>')
    expect(xml).toContain('<link>https://alice.banksia.io/newer</link>')
    expect(xml).toContain('<guid isPermaLink="true">https://alice.banksia.io/newer</guid>')
    expect(xml).toContain('<dc:creator>alice</dc:creator>')
    expect(xml).toContain('<title>Newer</title>')
    expect(xml).toContain('<category>notes</category>')
    expect(xml).not.toContain('<category>hive-123456</category>')
  })

  it('puts the newest item first and honours the limit', () => {
    const xml = buildBlogRss({ account: 'alice', posts: POSTS, baseUrl: 'https://alice.banksia.io', limit: 1 })
    const newer = xml.indexOf('https://alice.banksia.io/newer')
    const older = xml.indexOf('https://alice.banksia.io/older')
    expect(newer).toBeGreaterThan(-1)
    expect(older).toBe(-1)
  })

  it('produces a valid empty channel', () => {
    const xml = buildBlogRss({ account: 'alice', posts: [], baseUrl: 'https://alice.banksia.io' })
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<title>@alice</title>')
    expect(xml).not.toContain('<item>')
    expect(xml.trim().endsWith('</rss>')).toBe(true)
  })

  it('uses the /p/ fallback for a permlink that collides with a route', () => {
    const simple = {
      author: 'alice',
      permlink: 'a-post',
      title: 'A post',
      body: 'Body',
      created: '2026-11-20T10:00:00'
    }
    const xml = buildBlogRss({
      account: 'alice',
      posts: [simple],
      baseUrl: 'https://alice.banksia.io'
    })
    expect(xml).toContain('https://alice.banksia.io/a-post')
    const reserved = buildBlogRss({
      account: 'alice',
      posts: [{ ...simple, permlink: 'about' }],
      baseUrl: 'https://alice.banksia.io'
    })
    expect(reserved).toContain('https://alice.banksia.io/p/about')
  })

  it('falls back to a safe base URL', () => {
    const xml = buildBlogRss({ account: 'alice', posts: [], baseUrl: '' })
    expect(xml).toContain('<link>https://banksia.io</link>')
    expect(xml).toContain('href="https://banksia.io/rss.xml"')
  })
})
