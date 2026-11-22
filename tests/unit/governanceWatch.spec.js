import { describe, expect, it } from 'vitest'
import { governanceWatchSummary } from '../../src/services/governanceWatch'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-18T12:00:00Z')

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE'
}

function proposal (id, days, overrides = {}) {
  return {
    id,
    subject: 'Proposal ' + id,
    daily_pay: (overrides.dailyPay ?? 0) + '.000 HBD',
    total_votes: String(overrides.votes ?? 0),
    start_date: new Date(NOW).toISOString(),
    end_date: new Date(NOW + days * DAY_MS).toISOString(),
    receiver: overrides.receiver || 'creator' + id,
    ...overrides
  }
}

function fixture () {
  return [
    proposal(0, 365, { subject: 'Return proposal', votes: 100000, receiver: 'return' }),
    proposal(1, 10, { subject: 'Docs refresh', dailyPay: 100, votes: 200000 }),
    proposal(2, 20, { subject: 'Stabilizer', dailyPay: 50, votes: 300000, receiver: 'hbdstabilizer' }),
    proposal(3, 60, { subject: 'Long running dev', dailyPay: 25, votes: 150000 }),
    proposal(4, 5, { subject: 'Meetup', dailyPay: 7, votes: 50000 }),
    {
      ...proposal(5, 12, { subject: 'Upcoming', dailyPay: 10, votes: 999999 }),
      start_date: new Date(NOW + 2 * DAY_MS).toISOString()
    },
    {
      ...proposal(6, 10, { subject: 'Expired', dailyPay: 9, votes: 200000 }),
      start_date: new Date(NOW - 10 * DAY_MS).toISOString(),
      end_date: new Date(NOW - DAY_MS).toISOString()
    }
  ]
}

describe('governanceWatchSummary', () => {
  it('counts active, funded and unfunded proposals', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      account: null,
      globalProps: GLOBAL_PROPS,
      fundHbdBalance: '1000000.000 HBD',
      now: NOW
    })

    // Return proposal is active but is neither a funded nor an unfunded grant.
    expect(summary.activeCount).toBe(5)
    expect(summary.fundedCount).toBe(3)
    expect(summary.unfundedCount).toBe(1)
    expect(summary.expiringSoonCount).toBe(3)
  })

  it('commits daily pay without the return proposal or the HBD stabilizer', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      account: null,
      globalProps: GLOBAL_PROPS,
      fundHbdBalance: '1000000.000 HBD',
      now: NOW
    })

    expect(summary.dailyBudget).toBeCloseTo(10000)
    expect(summary.dailyCommitted).toBeCloseTo(125)
    expect(summary.dailyUnfunded).toBeCloseTo(7)
    expect(summary.dailyGap).toBeCloseTo(9875)
    expect(summary.projected30Days).toBeCloseTo(3750)
    expect(summary.returnVotes).toBe(100000)
    expect(summary.returnHp).toBeCloseTo(0.1)
    expect(summary.hasFund).toBe(true)
    expect(summary.hasProposals).toBe(true)
  })

  it('lists active proposals ending within 30 days, soonest first', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      globalProps: GLOBAL_PROPS,
      fundHbdBalance: 1000000,
      limit: 2,
      now: NOW
    })

    expect(summary.expiring.map(row => row.id)).toEqual([4, 1])
    expect(summary.expiring[0].subject).toBe('Meetup')
    expect(summary.expiring[0].daysLeft).toBe(5)
    expect(summary.expiring[0].dailyPayHbd).toBeCloseTo(7)
    expect(summary.expiring[0].funded).toBe(false)
    expect(summary.expiring[0].url).toBe('/proposals/4')
    expect(summary.expiring[1].funded).toBe(true)
  })

  it('excludes implausible daily requests from funding totals and flags them', () => {
    const proposals = fixture().concat([
      proposal(7, 10, { subject: 'Spam request', dailyPay: 999999999999999 })
    ])
    const summary = governanceWatchSummary({
      proposals,
      globalProps: GLOBAL_PROPS,
      fundHbdBalance: 1000000,
      now: NOW
    })

    expect(summary.outlierCount).toBe(1)
    expect(summary.dailyUnfunded).toBeCloseTo(7)
    expect(summary.unfundedCount).toBe(1)
    const row = summary.expiring.find(entry => entry.id === 7)
    expect(row.outlier).toBe(true)
  })

  it('filters the watchlist by id regardless of expiry', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      globalProps: GLOBAL_PROPS,
      watchlist: [3, 6, 999],
      limit: 4,
      now: NOW
    })

    expect(summary.watchlist.map(row => row.id)).toEqual([3, 6])
    const expired = summary.watchlist.find(row => row.id === 6)
    expect(expired.phase).toBe('expired')
    expect(expired.daysLeft).toBe(0)
  })

  it('marks proposals the account voted for', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      watchlist: [3],
      votedIds: new Set([3]),
      now: NOW
    })

    expect(summary.watchlist[0].voted).toBe(true)
  })

  it('reports a vote expiry that is close', () => {
    const account = {
      name: 'alice',
      governance_vote_expiration_ts: new Date(NOW + 10 * DAY_MS).toISOString()
    }
    const summary = governanceWatchSummary({ proposals: [], account, now: NOW })

    expect(summary.hasAccount).toBe(true)
    expect(summary.voteExpiry.available).toBe(true)
    expect(summary.voteExpiry.daysLeft).toBe(10)
    expect(summary.voteExpiry.expiring).toBe(true)
    expect(summary.voteExpiry.label).toMatch(/expire in 10 days/)
  })

  it('reports an unavailable vote expiry for guests or missing timestamps', () => {
    const guest = governanceWatchSummary({ proposals: [], account: null, now: NOW })
    expect(guest.voteExpiry.available).toBe(false)
    expect(guest.voteExpiry.daysLeft).toBeNull()
    expect(guest.voteExpiry.label).toBe('')

    const accountWithoutTimestamp = governanceWatchSummary({
      account: { name: 'bob' },
      now: NOW
    })
    expect(accountWithoutTimestamp.voteExpiry.available).toBe(false)
  })

  it('handles missing global props and a missing fund without throwing', () => {
    const summary = governanceWatchSummary({
      proposals: fixture(),
      globalProps: null,
      fundHbdBalance: 0,
      now: NOW
    })

    expect(summary.returnHp).toBe(0)
    expect(summary.dailyBudget).toBe(0)
    expect(summary.hasFund).toBe(false)
    expect(summary.dailyCommitted).toBeCloseTo(125)
    expect(summary.expiring).toHaveLength(3)
  })

  it('handles a completely empty input', () => {
    const summary = governanceWatchSummary()

    expect(summary.activeCount).toBe(0)
    expect(summary.fundedCount).toBe(0)
    expect(summary.unfundedCount).toBe(0)
    expect(summary.expiring).toEqual([])
    expect(summary.watchlist).toEqual([])
    expect(summary.hasProposals).toBe(false)
    expect(summary.voteExpiry.available).toBe(false)
    expect(summary.returnVotes).toBe(0)
    expect(summary.returnHp).toBe(0)
  })
})
