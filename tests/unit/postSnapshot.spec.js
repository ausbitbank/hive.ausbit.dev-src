import { describe, expect, it } from 'vitest'
import { trimJsonMetadata, trimPost, trimPostsForSnapshot } from '../../src/services/postSnapshot'

const POST = {
  author: 'alice',
  permlink: 'hello',
  title: 'Hello',
  body: 'word '.repeat(600),
  json_metadata: { image: ['https://images.example/a.png'], tags: ['hive'], secret: 'drop' },
  stats: { total_votes: 4, hide: true, gray: true, flag_weight: 3, muted_reasons: [0] },
  author_role: 'member',
  blacklists: ['watchlist'],
  payout: '1.000 HBD'
}

describe('post snapshots', () => {
  it('trims a post to card fields', () => {
    const post = trimPost(POST, { bodyLimit: 100 })
    expect(post.author).toBe('alice')
    expect(post.body.length).toBeLessThanOrEqual(100)
    expect(post.json_metadata).toEqual({ image: ['https://images.example/a.png'], tags: ['hive'] })
    expect(post.stats).toEqual({
      total_votes: 4,
      hide: true,
      hidden: false,
      gray: true,
      flag_weight: 3,
      is_pinned: false,
      muted_reasons: [0]
    })
    expect(post.author_role).toBe('member')
    expect(post.blacklists).toEqual(['watchlist'])
    expect(post.payout).toBe(0)
  })

  it('limits the number of saved posts', () => {
    const posts = Array.from({ length: 5 }, (_, index) => ({ ...POST, permlink: 'p' + index }))
    expect(trimPostsForSnapshot(posts, { limit: 3 })).toHaveLength(3)
  })

  it('ignores malformed metadata and invalid posts', () => {
    expect(trimJsonMetadata('{oops')).toEqual({})
    expect(trimPost({ author: '', permlink: 'x' })).toBeNull()
  })
})
