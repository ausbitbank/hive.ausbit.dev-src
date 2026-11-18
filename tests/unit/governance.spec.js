import { describe, expect, it } from 'vitest'
import {
  feedFreshness,
  governanceVoteExpiry,
  inferTopics,
  missedBlockLeaders,
  proposalFundingAnalytics,
  versionDrift,
  voteOverlap,
  voterConcentration,
  witnessVoteConcentration
} from '../../src/services/governance'

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE'
}

const NOW = Date.parse('2026-11-18T12:00:00Z')

function witness (owner, votes, overrides = {}) {
  return {
    owner,
    votes: String(votes),
    rank: overrides.rank || 1,
    total_missed: 0,
    last_confirmed_block_num: 1000,
    last_hbd_exchange_update: '2026-11-18T09:00:00',
    running_version: '1.28.8',
    ...overrides
  }
}

describe('witnessVoteConcentration', () => {
  it('computes stake shares, HHI and the consensus cutoff', () => {
    const rows = [
      witness('alice', 1000000, { rank: 1 }),
      witness('bob', 500000, { rank: 2 }),
      witness('carol', 250000, { rank: 3 })
    ]
    const result = witnessVoteConcentration(rows, GLOBAL_PROPS)

    expect(result.totalHp).toBeCloseTo(1.75)
    expect(result.topConsensusHp).toBeCloseTo(1.75)
    expect(result.topConsensusShare).toBeCloseTo(1)
    expect(result.consensusCount).toBe(3)
    expect(result.witnessCount).toBe(3)
    expect(result.cutoffHp).toBeCloseTo(0.25)
    expect(result.hhi).toBeCloseTo(10000 * ((1 / 1.75) ** 2 + (0.5 / 1.75) ** 2 + (0.25 / 1.75) ** 2), 5)
    expect(result.rows[0].share).toBeCloseTo(1 / 1.75)
  })

  it('returns a safe empty model without witnesses', () => {
    const result = witnessVoteConcentration([], GLOBAL_PROPS)
    expect(result.totalHp).toBe(0)
    expect(result.topConsensusShare).toBe(0)
    expect(result.gini).toBe(0)
  })
})

describe('feedFreshness', () => {
  it('buckets fresh, aging, stale and missing feeds', () => {
    const result = feedFreshness([
      witness('fresh', 1, { last_hbd_exchange_update: '2026-11-18T09:00:00' }),
      witness('aging', 1, { last_hbd_exchange_update: '2026-11-18T00:00:00' }),
      witness('stale', 1, { last_hbd_exchange_update: '2026-11-15T12:00:00' }),
      witness('missing', 1, { last_hbd_exchange_update: null })
    ], NOW)

    expect(result.fresh).toBe(1)
    expect(result.aging).toBe(1)
    expect(result.stale).toBe(1)
    expect(result.missing).toBe(1)
    expect(result.total).toBe(4)
    expect(result.rows[0].bucket).toBe('missing')
  })
})

describe('versionDrift', () => {
  it('groups versions and lists witnesses that trail consensus', () => {
    const result = versionDrift([
      witness('alice', 1, { running_version: '1.28.8' }),
      witness('bob', 1, { running_version: '1.28.8' }),
      witness('carol', 1, { running_version: '1.27.0' })
    ], '1.28.8')

    expect(result.total).toBe(3)
    expect(result.matching).toBe(2)
    expect(result.mismatched.map(row => row.owner)).toEqual(['carol'])
    expect(result.groups[0]).toMatchObject({ version: '1.28.8', count: 2 })
  })
})

describe('missedBlockLeaders', () => {
  it('orders by cumulative missed blocks', () => {
    const result = missedBlockLeaders([
      witness('alice', 1, { total_missed: 2 }),
      witness('bob', 1, { total_missed: 20 }),
      witness('carol', 1, { total_missed: 9 })
    ], 2)

    expect(result.map(row => row.owner)).toEqual(['bob', 'carol'])
  })
})

describe('inferTopics', () => {
  it('maps keywords to coarse topics', () => {
    expect(inferTopics('Hive API development and node infrastructure')).toEqual(['development', 'infrastructure'])
    expect(inferTopics('Marketing campaign for community onboarding')).toEqual(['marketing', 'community'])
    expect(inferTopics('')).toEqual([])
  })
})

describe('proposalFundingAnalytics', () => {
  const proposals = [
    {
      id: 0,
      creator: 'hive.fund',
      receiver: 'hive.fund',
      subject: 'Return proposal',
      total_votes: 1000,
      daily_pay: '0.000 HBD',
      start_date: '2026-01-01T00:00:00',
      end_date: '2027-01-01T00:00:00',
      status: 'active'
    },
    {
      id: 1,
      creator: 'alice',
      receiver: 'devs',
      subject: 'Hive API development',
      total_votes: 1500,
      daily_pay: '10.000 HBD',
      start_date: '2026-11-01T00:00:00',
      end_date: '2026-12-01T00:00:00',
      status: 'active'
    },
    {
      id: 2,
      creator: 'bob',
      receiver: 'bob',
      subject: 'Marketing campaign',
      total_votes: 500,
      daily_pay: '5.000 HBD',
      start_date: '2026-11-01T00:00:00',
      end_date: '2026-12-01T00:00:00',
      status: 'active'
    },
    {
      id: 3,
      creator: 'carol',
      receiver: 'carol',
      subject: 'Old documentation',
      total_votes: 5000,
      daily_pay: '3.000 HBD',
      start_date: '2026-01-01T00:00:00',
      end_date: '2026-10-01T00:00:00',
      status: 'expired'
    }
  ]

  it('summarises funding, creators and the monthly outlook', () => {
    const result = proposalFundingAnalytics(proposals, GLOBAL_PROPS, { now: new Date(NOW), months: 12 })

    expect(result.totalProposals).toBe(4)
    expect(result.activeCount).toBe(3)
    expect(result.fundedCount).toBe(1)
    expect(result.expiredCount).toBe(1)
    expect(result.dailyCommitted).toBeCloseTo(10)
    expect(result.dailyRequested).toBeCloseTo(15)
    expect(result.dailyUnfunded).toBeCloseTo(5)
    expect(result.monthlyOutlook).toHaveLength(12)
    expect(result.monthlyOutlook[0].daily).toBeCloseTo(10)
    expect(result.creators[0]).toMatchObject({ name: 'alice' })
    expect(result.topics.map(row => row.topic)).toContain('development')
    expect(result.topics.map(row => row.topic)).toContain('marketing')
    expect(result.returnVotes).toBe(1000)
    expect(result.estimatedPaid).toBeGreaterThan(0)
  })

  it('honours an explicit return threshold override', () => {
    const result = proposalFundingAnalytics(proposals.slice(0, 2), GLOBAL_PROPS, {
      now: new Date(NOW),
      returnVotes: 100000
    })
    expect(result.fundedCount).toBe(0)
    expect(result.dailyCommitted).toBe(0)
  })
})

describe('voteOverlap', () => {
  it('compares voter sets and reports the intersection', () => {
    const result = voteOverlap(['alice', 'bob', 'carol'], ['bob', 'carol', 'dave'])

    expect(result.countA).toBe(3)
    expect(result.countB).toBe(3)
    expect(result.sharedCount).toBe(2)
    expect(result.unionCount).toBe(4)
    expect(result.jaccard).toBeCloseTo(0.5)
    expect(result.overlapOfA).toBeCloseTo(2 / 3)
    expect(result.shared).toEqual(['bob', 'carol'])
    expect(result.onlyA).toEqual(['alice'])
    expect(result.onlyB).toEqual(['dave'])
  })

  it('accepts vote objects and tolerates empty input', () => {
    const result = voteOverlap([{ voter: 'a' }, { voter: 'b' }], [])
    expect(result.sharedCount).toBe(0)
    expect(result.jaccard).toBe(0)
    expect(result.onlyA).toEqual(['a', 'b'])
  })
})

describe('voterConcentration', () => {
  it('ranks voters by effective HP and reports the top share', () => {
    const result = voterConcentration(
      [{ voter: 'alice' }, { voter: 'bob' }],
      [
        { name: 'alice', vesting_shares: '1000000.000000 VESTS', received_vesting_shares: '0.000000 VESTS', delegated_vesting_shares: '0.000000 VESTS', vesting_withdraw_rate: '0.000000 VESTS' },
        { name: 'bob', vesting_shares: '3000000.000000 VESTS', received_vesting_shares: '0.000000 VESTS', delegated_vesting_shares: '0.000000 VESTS', vesting_withdraw_rate: '0.000000 VESTS' }
      ],
      GLOBAL_PROPS,
      10
    )

    expect(result.totalHp).toBeCloseTo(4000000)
    expect(result.top[0].voter).toBe('bob')
    expect(result.top[0].share).toBeCloseTo(0.75)
    expect(result.topShare).toBeCloseTo(1)
    expect(result.known).toBe(2)
  })
})

describe('governanceVoteExpiry', () => {
  it('flags votes inside the warning window', () => {
    const result = governanceVoteExpiry({ governance_vote_expiration_ts: '2026-12-01T00:00:00' }, NOW)
    expect(result.daysLeft).toBeGreaterThan(0)
    expect(result.expiring).toBe(true)
  })

  it('returns a neutral model when the timestamp is missing', () => {
    expect(governanceVoteExpiry({}, NOW)).toEqual({ expiresAt: null, daysLeft: null, expiring: false })
  })
})
