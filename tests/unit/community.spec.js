import { describe, expect, it } from 'vitest'
import { communityInsights } from '../../src/services/community'

const NOW = Date.parse('2026-11-18T12:00:00Z')

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'post-' + Math.random().toString(36).slice(2),
    parent_author: '',
    created: '2026-11-18T10:00:00',
    payout: 5,
    children: 2,
    active_votes: [{ voter: 'bob' }],
    ...overrides
  }
}

describe('communityInsights', () => {
  it('aggregates authors, payouts, cadence and moderation signals', () => {
    const posts = [
      post({ author: 'alice', payout: 5 }),
      post({ author: 'alice', payout: 15, created: '2026-11-17T10:00:00' }),
      post({ author: 'bob', payout: 10, created: '2026-11-10T10:00:00' }),
      post({ author: 'carol', payout: 99, parent_author: 'alice' })
    ]
    const result = communityInsights(posts, {
      now: NOW,
      communityInfo: {
        subscribers: 120,
        sum_pending: 12.5,
        num_pending: 7,
        settings: { flag_text: 'Be kind', nsfw: false, restricted: true }
      },
      mutedPosts: [post({ author: 'muted' })]
    })

    expect(result.postCount).toBe(3)
    expect(result.totalAuthors).toBe(2)
    expect(result.posts7d).toBe(2)
    expect(result.posts30d).toBe(3)
    expect(result.activeAuthors7d).toBe(1)
    expect(result.totalPayout).toBe(30)
    expect(result.medianPayout).toBe(10)
    expect(result.averagePayout).toBe(10)
    expect(result.topTenShare).toBeCloseTo(0.5)
    expect(result.authors[0]).toMatchObject({ author: 'alice', posts: 2, payout: 20 })
    expect(result.cadence).toHaveLength(14)
    expect(result.cadence[result.cadence.length - 1].count).toBe(1)
    expect(result.cadence[result.cadence.length - 2].count).toBe(1)
    expect(result.cadence[result.cadence.length - 9].count).toBe(1)
    expect(result.subscribers).toBe(120)
    expect(result.pendingRewards).toBe(12.5)
    expect(result.weeklyInteractions).toBe(7)
    expect(result.mutedCount).toBe(1)
    expect(result.flagText).toBe('Be kind')
    expect(result.restricted).toBe(true)
    expect(result.moderationSignals).toBe(3)
  })

  it('handles an empty community', () => {
    const result = communityInsights([], { now: NOW })
    expect(result.postCount).toBe(0)
    expect(result.totalPayout).toBe(0)
    expect(result.medianPayout).toBe(0)
    expect(result.peakCadence).toBe(0)
    expect(result.cadence).toHaveLength(14)
    expect(result.authors).toEqual([])
  })

  it('accepts string payouts and missing children data', () => {
    const result = communityInsights([
      post({ payout: '7.500 HBD', children: undefined, active_votes: undefined })
    ], { now: NOW })

    expect(result.totalPayout).toBeCloseTo(7.5)
    expect(result.authors[0].replies).toBe(0)
    expect(result.authors[0].votes).toBe(0)
  })
})
