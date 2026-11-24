import { describe, expect, it } from 'vitest'
import {
  MAX_NEWS_ACCOUNTS,
  newsDigestSummary,
  normaliseNewsAccounts
} from '../../src/services/newsDigest'

function post (overrides = {}) {
  return {
    author: 'hiveio',
    permlink: 'update',
    title: 'Hive update',
    created: '2026-11-20T10:00:00',
    pending_payout_value: '10.000 HBD',
    is_paidout: false,
    children: 3,
    net_votes: 7,
    active_votes: [{ voter: 'a' }, { voter: 'b' }],
    ...overrides
  }
}

describe('news digest shaping', () => {
  it('merges, deduplicates and sorts newest first', () => {
    const summary = newsDigestSummary({
      accounts: ['hiveio', 'ecency'],
      feeds: [
        { account: 'hiveio', posts: [post(), post({ permlink: 'older', title: 'Older', created: '2026-11-18T10:00:00' })] },
        { account: 'ecency', posts: [post({ author: 'ecency', permlink: 'app' }), post()] }
      ],
      limit: 3
    })
    expect(summary.hasData).toBe(true)
    expect(summary.total).toBe(3)
    expect(summary.posts.map(row => row.permlink)).toEqual(['update', 'app', 'older'])
    expect(summary.posts[0].source).toBe('hiveio')
    expect(summary.posts[1].source).toBe('ecency')
  })

  it('reports a failed source without dropping the rest', () => {
    const summary = newsDigestSummary({
      accounts: ['hiveio', 'ecency'],
      feeds: [
        { account: 'hiveio', posts: [post()] },
        { account: 'ecency', error: 'timeout' }
      ]
    })
    expect(summary.hasData).toBe(true)
    expect(summary.partial).toBe(true)
    expect(summary.failures).toEqual([{ account: 'ecency', error: 'timeout' }])
  })

  it('returns a clean empty state when every feed fails', () => {
    const summary = newsDigestSummary({
      accounts: ['hiveio'],
      feeds: [{ account: 'hiveio', error: 'timeout' }]
    })
    expect(summary.hasData).toBe(false)
    expect(summary.partial).toBe(true)
    expect(summary.posts).toEqual([])
  })

  it('drops malformed posts', () => {
    const summary = newsDigestSummary({
      accounts: ['hiveio'],
      feeds: [{
        account: 'hiveio',
        posts: [null, {}, { author: 'x' }, post()]
      }]
    })
    expect(summary.posts).toHaveLength(1)
  })

  it('caps the rendered list but reports the merged total', () => {
    const posts = []
    for (let index = 0; index < 20; index++) {
      posts.push(post({
        permlink: 'p' + index,
        created: '2026-11-' + String(10 + index).padStart(2, '0') + 'T10:00:00'
      }))
    }
    const summary = newsDigestSummary({ accounts: ['hiveio'], feeds: [{ account: 'hiveio', posts }], limit: 6 })
    expect(summary.posts).toHaveLength(6)
    expect(summary.total).toBe(20)
  })

  it('reads payout, votes and comments defensively', () => {
    const summary = newsDigestSummary({
      accounts: ['hiveio'],
      feeds: [{
        account: 'hiveio',
        posts: [post({ pending_payout_value: '2.500 HBD', children: '4', net_votes: '0', active_votes: [] })]
      }]
    })
    const row = summary.posts[0]
    expect(row.payoutHbd).toBe(2.5)
    expect(row.comments).toBe(4)
    expect(row.votes).toBe(0)
    expect(row.pending).toBe(true)
  })
})

describe('news account normalisation', () => {
  it('normalises, deduplicates and bounds the list', () => {
    expect(normaliseNewsAccounts(['@HiveIO', 'ecency', 'hiveio', 'not a name', 'peakd', 'leofinance', 'extra']))
      .toEqual(['hiveio', 'ecency', 'peakd', 'leofinance', 'extra'])
    expect(normaliseNewsAccounts(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']).length).toBe(MAX_NEWS_ACCOUNTS)
    expect(normaliseNewsAccounts(null)).toEqual([])
  })
})
