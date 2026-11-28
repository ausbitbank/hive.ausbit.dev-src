import { describe, expect, it } from 'vitest'
import {
  coordinationEvidence,
  downvoteContext,
  downvotesFor,
  filterIgnoredVoters,
  groupDownvotes,
  normalizeHistoryVote,
  normalizeHistoryVotes,
  relationshipFor,
  summarizeDownvotes,
  withDownvoteValues
} from '../../src/services/downvotes'

const now = Date.now()
const iso = offsetMs => new Date(now - offsetMs).toISOString().replace('Z', '')

function vote ({ voter = 'voter', author = 'alice', permlink = 'post', weight = -1000, time = iso(3600000), index = 1 } = {}) {
  return [index, {
    op: ['vote', { voter, author, permlink, weight }],
    timestamp: time,
    trx_id: 'trx' + index,
    block: 1
  }]
}

describe('downvote history normalization', () => {
  it('normalizes vote rows and ignores non-votes and zero weights', () => {
    expect(normalizeHistoryVote(vote())).toMatchObject({
      voter: 'voter',
      author: 'alice',
      permlink: 'post',
      weight: -1000,
      direction: 'down',
      target: 'alice/post'
    })
    expect(normalizeHistoryVote([1, { op: ['comment', {}], timestamp: iso(0) }])).toBeNull()
    expect(normalizeHistoryVote(vote({ weight: 0 }))).toBeNull()
    expect(normalizeHistoryVotes([vote(), null, vote({ weight: 1000 })])).toHaveLength(2)
  })

  it('splits received and given downvotes', () => {
    const rows = normalizeHistoryVotes([
      vote({ voter: 'bob', author: 'alice' }),
      vote({ voter: 'alice', author: 'carol' }),
      vote({ voter: 'dave', author: 'alice', weight: 1000 })
    ])
    expect(downvotesFor(rows, 'alice', 'received').map(row => row.voter)).toEqual(['bob'])
    expect(downvotesFor(rows, 'alice', 'given').map(row => row.author)).toEqual(['carol'])
  })

  it('summarizes counts, voters, targets and weight', () => {
    const rows = normalizeHistoryVotes([
      vote({ voter: 'bob', weight: -1000, index: 1 }),
      vote({ voter: 'bob', weight: -500, index: 2 }),
      vote({ voter: 'carol', weight: -200, index: 3, permlink: 'other' })
    ])
    const summary = summarizeDownvotes(rows)
    expect(summary.count).toBe(3)
    expect(summary.distinctVoters).toBe(2)
    expect(summary.distinctTargets).toBe(2)
    expect(summary.totalWeight).toBe(1700)
    expect(summary.largestWeight).toBe(1000)
    expect(summary.totalValueUsd).toBe(0)
    expect(summary.totalRshares).toBe(0)
  })

  it('adds estimated dollar values without changing the chain weight', () => {
    const account = {
      vesting_shares: '1000000.000000 VESTS',
      voting_manabar: { current_mana: 1000000000000 },
      downvote_manabar: { current_mana: 250000000000 }
    }
    const rewardFund = { recent_claims: '1000000000000000', reward_balance: '50000.000 HIVE' }
    const medianHistory = { base: '0.500 HBD', quote: '1.000 HIVE' }
    const rows = normalizeHistoryVotes([
      vote({ voter: 'bob', weight: -1000, index: 1 }),
      vote({ voter: 'carol', weight: -500, index: 2, permlink: 'other' })
    ])
    const valued = withDownvoteValues(rows, {
      accounts: { bob: account, carol: account },
      rewardFund,
      medianHistory
    })

    expect(valued[0].weight).toBe(-1000)
    expect(valued[0].valueRshares).toBe(2e9)
    expect(valued[0].valueUsd).toBeCloseTo(0.05, 6)
    expect(valued[1].valueRshares).toBe(1e9)
    expect(valued[1].valueUsd).toBeCloseTo(0.025, 6)

    const summary = summarizeDownvotes(valued)
    expect(summary.totalWeight).toBe(1500)
    expect(summary.totalRshares).toBe(3e9)
    expect(summary.totalValueUsd).toBeCloseTo(0.075, 6)
    expect(summary.largestValueUsd).toBeCloseTo(0.05, 6)
    expect(summary.topValueShare).toBeCloseTo(0.05 / 0.075, 6)

    const grouped = groupDownvotes(valued, 'voter')
    const bob = grouped.find(group => group.key === 'bob')
    expect(bob.totalValueUsd).toBeCloseTo(0.05, 6)
    expect(bob.totalRshares).toBe(2e9)
  })

  it('leaves value estimates empty when the voter account is unknown', () => {
    const rows = normalizeHistoryVotes([vote({ voter: 'bob', weight: -1000 })])
    const valued = withDownvoteValues(rows, { accounts: {}, rewardFund: null, medianHistory: null })
    expect(valued[0].valueUsd).toBe(0)
    expect(valued[0].valueRshares).toBe(0)
  })

  it('groups by voter, target and day', () => {
    const rows = normalizeHistoryVotes([
      vote({ voter: 'bob', index: 1 }),
      vote({ voter: 'bob', index: 2 }),
      vote({ voter: 'carol', author: 'bob', index: 3 })
    ])
    expect(groupDownvotes(rows, 'voter').map(group => group.key)).toContain('bob')
    expect(groupDownvotes(rows, 'target').length).toBeGreaterThan(0)
    expect(groupDownvotes(rows, 'day').length).toBe(1)
  })
})

describe('coordination evidence', () => {
  it('labels a conservative shared-target pattern with evidence', () => {
    const rows = normalizeHistoryVotes([
      ...['a', 'b', 'c'].flatMap((voter, voterIndex) => [
        vote({ voter, permlink: 'one', index: voterIndex * 10 + 1 }),
        vote({ voter, permlink: 'two', index: voterIndex * 10 + 2 }),
        vote({ voter, permlink: 'three', index: voterIndex * 10 + 3 })
      ])
    ])
    const evidence = coordinationEvidence(rows)
    expect(evidence).toMatchObject({
      kind: 'possible-coordinated-downvotes',
      voterCount: 3,
      targetCount: 3
    })
    expect(evidence.voters).toEqual(['a', 'b', 'c'])
  })

  it('does not label two voters or an old pattern', () => {
    const twoVoters = normalizeHistoryVotes([
      vote({ voter: 'a', permlink: 'one', index: 1 }),
      vote({ voter: 'b', permlink: 'one', index: 2 }),
      vote({ voter: 'a', permlink: 'two', index: 3 }),
      vote({ voter: 'b', permlink: 'two', index: 4 })
    ])
    expect(coordinationEvidence(twoVoters)).toBeNull()

    const old = normalizeHistoryVotes([
      ...['a', 'b', 'c'].flatMap((voter, index) => [
        vote({ voter, permlink: 'one', index: index * 10 + 1, time: iso(10 * 24 * 3600000) }),
        vote({ voter, permlink: 'two', index: index * 10 + 2, time: iso(10 * 24 * 3600000) }),
        vote({ voter, permlink: 'three', index: index * 10 + 3, time: iso(10 * 24 * 3600000) })
      ])
    ])
    expect(coordinationEvidence(old)).toBeNull()
  })
})

describe('post vote context', () => {
  it('summarizes distinct up/down voters, stake concentration and net direction', () => {
    const context = downvoteContext([
      { voter: 'a', rshares: 100, percent: 10000, reputation: 1, time: '' },
      { voter: 'b', rshares: 100, percent: 10000, reputation: 1, time: '' },
      { voter: 'c', rshares: -50, percent: -10000, reputation: 1, time: '' },
      { voter: 'd', rshares: -50, percent: -10000, reputation: 1, time: '' }
    ])
    expect(context).toMatchObject({
      upCount: 2,
      downCount: 2,
      distinctUp: 2,
      distinctDown: 2,
      totalUp: 200,
      totalDown: 100,
      net: 100,
      netDirection: 'up'
    })
    expect(context.topVoterShare).toBeCloseTo(1 / 3)
  })
})

describe('relationship and ignored voters', () => {
  it('labels follows, mutes, blacklists and lists', () => {
    const context = {
      following: ['a'],
      muted: ['b'],
      blacklisted: ['c'],
      followedMuteLists: [{ owner: 'list', members: ['d'] }],
      followedBlacklistLists: [{ owner: 'warn', members: ['e'] }]
    }
    expect(relationshipFor('a', context)).toBe('follows')
    expect(relationshipFor('b', context)).toBe('muted')
    expect(relationshipFor('c', context)).toBe('blacklist')
    expect(relationshipFor('d', context)).toBe('followed list')
    expect(relationshipFor('e', context)).toBe('followed blacklist')
    expect(relationshipFor('z', context)).toBe('unknown')
  })

  it('filters ignored voters without changing the raw rows', () => {
    const rows = normalizeHistoryVotes([
      vote({ voter: 'bob', index: 1 }),
      vote({ voter: 'carol', index: 2 })
    ])
    const filtered = filterIgnoredVoters(rows, ['bob'])
    expect(filtered.map(row => row.voter)).toEqual(['carol'])
    expect(rows).toHaveLength(2)
  })
})
