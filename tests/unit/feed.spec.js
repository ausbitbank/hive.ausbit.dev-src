import { describe, expect, it } from 'vitest'
import { buildFeedXml, feedTitle, isOwnPost } from '../../scripts/lib/feed.mjs'

const POST = {
  author: 'ausbitbank',
  permlink: 'hive-explorer-update',
  title: 'Hive explorer update',
  body: '<p>New <strong>wallet</strong> tools.</p>',
  created: '2026-11-18T03:00:00'
}

describe('RSS feed helpers', () => {
  it('keeps only posts authored by the feed account', () => {
    expect(isOwnPost(POST)).toBe(true)
    expect(isOwnPost({ author: 'someone-else' })).toBe(false)
    expect(isOwnPost({ author: 'AusbitBank' })).toBe(true)
  })

  it('falls back to the permlink for empty or punctuation-only titles', () => {
    expect(feedTitle(POST)).toBe('Hive explorer update')
    expect(feedTitle({ ...POST, title: '.' })).toBe('hive-explorer-update')
    expect(feedTitle({ ...POST, title: '   ' })).toBe('hive-explorer-update')
    expect(feedTitle({ ...POST, title: '', permlink: '' })).toBe('Hive post')
  })

  it('filters reblogs from other authors and escapes item content', () => {
    const xml = buildFeedXml({
      posts: [
        POST,
        { ...POST, author: 'magi.network', permlink: 'reblogged', title: 'Not ours' }
      ],
      now: new Date('2026-11-18T00:00:00Z')
    })
    expect(xml).toContain('<title>Hive explorer update</title>')
    expect(xml).not.toContain('Not ours')
    expect(xml).toContain('Project updates from @ausbitbank')
    expect(xml.match(/<item>/g)).toHaveLength(1)
  })

  it('uses the fallback item when no posts are available', () => {
    const xml = buildFeedXml({
      posts: [{ ...POST, author: 'someone-else' }],
      now: new Date('2026-11-18T00:00:00Z')
    })
    expect(xml).toContain('<title>Banksia</title>')
    expect(xml.match(/<item>/g)).toHaveLength(1)
  })
})
