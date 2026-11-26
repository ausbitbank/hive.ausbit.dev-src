import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearFeedState,
  loadFeedState,
  resetFeedStates,
  saveFeedState
} from '../../src/services/feedState'

function postsFor (label, count = 2) {
  return Array.from({ length: count }, (_, index) => ({ author: label, permlink: 'post-' + index }))
}

describe('browse feed continuity cache', () => {
  beforeEach(() => resetFeedStates())
  afterEach(() => resetFeedStates())

  it('restores the full loaded tail, not just the first page', () => {
    const posts = postsFor('alice', 80)
    saveFeedState('feed', { posts, hasMore: true, cachedAt: 123 })
    const cached = loadFeedState('feed')
    expect(cached.posts).toHaveLength(80)
    expect(cached.posts[79]).toBe(posts[79])
    expect(cached.hasMore).toBe(true)
    expect(cached.cachedAt).toBe(123)
  })

  it('ignores empty feeds', () => {
    expect(saveFeedState('feed', { posts: [], hasMore: false })).toBe(false)
    expect(loadFeedState('feed')).toBeNull()
  })

  it('expires stale feeds', () => {
    saveFeedState('feed', { posts: postsFor('alice') })
    expect(loadFeedState('feed', { now: Date.now() + 5 * 60 * 1000 + 1 })).toBeNull()
  })

  it('evicts the least recently used feed beyond the cap', () => {
    for (let index = 0; index < 13; index++) {
      saveFeedState('feed-' + index, { posts: postsFor('alice') })
    }
    expect(loadFeedState('feed-0')).toBeNull()
    expect(loadFeedState('feed-12')).not.toBeNull()
  })

  it('clears one feed without touching the others', () => {
    saveFeedState('one', { posts: postsFor('alice') })
    saveFeedState('two', { posts: postsFor('bob') })
    expect(clearFeedState('one')).toBe(true)
    expect(loadFeedState('one')).toBeNull()
    expect(loadFeedState('two')).not.toBeNull()
  })
})
