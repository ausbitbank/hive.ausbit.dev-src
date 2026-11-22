import { describe, expect, it } from 'vitest'
import { creatorStatsSummary } from '../../src/services/creatorStats'

const NOW = Date.parse('2026-11-20T12:00:00Z')
const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000.000 HIVE'
}
// 100000 VESTS of a 1e6 VESTS / 1000 HIVE pool = 100 HP.
const ACCOUNT = { name: 'alice', vesting_shares: '100000.000000 VESTS' }
const PRICES = { hive: { usd: 0.5 }, hive_dollar: { usd: 1 } }

function entry (index, op, timestamp) {
  return [index, { block: index, timestamp, op }]
}

function recent (msAgo = 60 * 60 * 1000) {
  return new Date(NOW - msAgo).toISOString()
}

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    created: recent(),
    pending_payout_value: '0.000 HBD',
    payout: 0,
    is_paidout: true,
    children: 2,
    stats: { total_votes: 5 },
    ...overrides
  }
}

describe('creator stats summary', () => {
  it('parses author, curation and comment rewards from history', () => {
    const history = [
      entry(1, ['author_reward', {
        hive_payout: '1.000 HIVE',
        hbd_payout: '2.000 HBD',
        vesting_payout: '1000.000000 VESTS'
      }], recent()),
      entry(2, ['curation_reward', { reward: '2000.000000 VESTS' }], recent()),
      entry(3, ['comment_reward', { payout: '3.000 HBD' }], recent())
    ]

    const summary = creatorStatsSummary({
      history,
      account: ACCOUNT,
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      now: NOW
    })

    expect(summary.rewards.authorHive).toBeCloseTo(1, 6)
    expect(summary.rewards.authorHbd).toBeCloseTo(2, 6)
    expect(summary.rewards.authorHp).toBeCloseTo(1, 6)
    expect(summary.rewards.curationHive).toBeCloseTo(2, 6)
    expect(summary.rewards.curationHp).toBeCloseTo(2, 6)
    expect(summary.rewards.commentHbd).toBeCloseTo(3, 6)
    // (1 HIVE + 1 HP + 2 HIVE) * $0.50 + (2 HBD + 3 HBD) * $1.
    expect(summary.rewards.totalUsd).toBeCloseTo(7, 6)
    expect(summary.rewards.totalHive).toBeCloseTo(14, 6)
    expect(summary.accountName).toBe('alice')
    expect(summary.hasData).toBe(true)
  })

  it('only counts history inside the window and ignores malformed rows', () => {
    const history = [
      entry(1, ['author_reward', { hive_payout: '9.000 HIVE' }], '2026-10-01T00:00:00'),
      entry(2, ['author_reward', { hive_payout: '1.500 HIVE' }], recent(2 * 24 * 60 * 60 * 1000)),
      entry(3, ['author_reward', { hive_payout: '7.000 HIVE' }], 'not a date'),
      [4, { block: 4, op: 'junk' }],
      null,
      'junk'
    ]

    const summary = creatorStatsSummary({
      history,
      account: ACCOUNT,
      globalProps: GLOBAL_PROPS,
      now: NOW
    })

    expect(summary.rewards.authorHive).toBeCloseTo(1.5, 6)
    expect(summary.truncated).toBe(false)
  })

  it('respects a custom window', () => {
    const history = [
      entry(1, ['author_reward', { hive_payout: '4.000 HIVE' }], recent(10 * 24 * 60 * 60 * 1000)),
      entry(2, ['author_reward', { hive_payout: '2.000 HIVE' }], recent(2 * 24 * 60 * 60 * 1000))
    ]

    expect(creatorStatsSummary({ history, now: NOW, windowDays: 7 }).rewards.authorHive).toBeCloseTo(2, 6)
    expect(creatorStatsSummary({ history, now: NOW, windowDays: 14 }).rewards.authorHive).toBeCloseTo(6, 6)
    expect(creatorStatsSummary({ history, now: NOW, windowDays: 14 }).windowDays).toBe(14)
  })

  it('collects pending payouts and prefers the most valuable one for the top post', () => {
    const posts = [
      post({ permlink: 'paid', title: 'Paid post', payout: 5, is_paidout: true }),
      post({
        permlink: 'pending',
        title: 'Pending post',
        payout: 2.5,
        pending_payout_value: '2.500 HBD',
        is_paidout: false,
        children: 4,
        stats: { total_votes: 9 }
      })
    ]

    const summary = creatorStatsSummary({ posts, prices: PRICES, now: NOW })

    expect(summary.pending.count).toBe(1)
    expect(summary.pending.hbd).toBeCloseTo(2.5, 6)
    expect(summary.pending.usd).toBeCloseTo(2.5, 6)
    expect(summary.pending.posts[0].permlink).toBe('pending')
    expect(summary.counts.posts).toBe(2)
    expect(summary.counts.votes).toBe(14)
    expect(summary.counts.comments).toBe(6)
    expect(summary.topPost.permlink).toBe('pending')
    expect(summary.topPost.pending).toBe(true)
    expect(summary.topPost.payoutHbd).toBeCloseTo(2.5, 6)
    expect(summary.topPost.votes).toBe(9)
  })

  it('falls back to the highest paid post when nothing is pending', () => {
    const posts = [
      post({ permlink: 'small', title: 'Small', payout: 2, is_paidout: true }),
      post({ permlink: 'big', title: 'Big', payout: 6, is_paidout: true })
    ]

    const summary = creatorStatsSummary({ posts, prices: PRICES, now: NOW })

    expect(summary.pending.count).toBe(0)
    expect(summary.topPost.permlink).toBe('big')
    expect(summary.topPost.pending).toBe(false)
    expect(summary.topPost.payoutHbd).toBeCloseTo(6, 6)
    expect(summary.topPost.payoutUsd).toBeCloseTo(6, 6)
  })

  it('annualises curation rewards into an estimated APR', () => {
    const history = [entry(1, ['curation_reward', { reward: '2000.000000 VESTS' }], recent())]
    const summary = creatorStatsSummary({
      history,
      account: ACCOUNT,
      globalProps: GLOBAL_PROPS,
      now: NOW
    })

    // 2 HP over 7 days on 100 HP = 2 * 365 / 7 / 100 * 100 = 104.29%.
    expect(summary.curationApr).toBeCloseTo(104.29, 1)
    expect(summary.curationAprLabel).toContain('estimate')
    expect(summary.curationAprLabel).toContain('104.3')
  })

  it('has no APR estimate without HP', () => {
    const summary = creatorStatsSummary({
      history: [entry(1, ['curation_reward', { reward: '2000.000000 VESTS' }], recent())],
      account: { name: 'alice', vesting_shares: '0.000000 VESTS' },
      globalProps: GLOBAL_PROPS,
      now: NOW
    })

    expect(summary.curationApr).toBeNull()
    expect(summary.curationAprLabel).toBe('')
  })

  it('handles an empty account', () => {
    const summary = creatorStatsSummary({ account: { name: 'nobody' }, now: NOW })

    expect(summary.accountName).toBe('nobody')
    expect(summary.hasData).toBe(false)
    expect(summary.topPost).toBeNull()
    expect(summary.counts).toEqual({ posts: 0, votes: 0, comments: 0 })
    expect(summary.pending).toMatchObject({ count: 0, hbd: 0, usd: 0, posts: [] })
    expect(summary.rewards.totalUsd).toBe(0)
    expect(summary.curationApr).toBeNull()
  })

  it('reports truncated history', () => {
    const summary = creatorStatsSummary({ account: ACCOUNT, now: NOW, historyTruncated: true })
    expect(summary.truncated).toBe(true)
  })

  it('keeps HIVE and HBD rewards when global props or prices are missing', () => {
    const history = [
      entry(1, ['author_reward', {
        hive_payout: '1.000 HIVE',
        hbd_payout: '2.000 HBD',
        vesting_payout: '1000.000000 VESTS'
      }], recent()),
      entry(2, ['curation_reward', { reward: '2000.000000 VESTS' }], recent())
    ]

    const summary = creatorStatsSummary({ history, account: ACCOUNT, now: NOW })

    expect(summary.rewards.authorHive).toBeCloseTo(1, 6)
    expect(summary.rewards.authorHbd).toBeCloseTo(2, 6)
    expect(summary.rewards.authorHp).toBe(0)
    expect(summary.rewards.curationHp).toBe(0)
    expect(summary.rewards.totalUsd).toBe(0)
    // No price feed: HIVE terms plus HBD treated one-to-one for the fallback.
    expect(summary.rewards.totalHive).toBeCloseTo(3, 6)
    expect(summary.curationApr).toBeNull()
  })
})
