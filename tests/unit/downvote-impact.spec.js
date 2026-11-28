import { describe, expect, it } from 'vitest'
import {
  annotateDownvoteImpact,
  buildTimeline,
  compareLossToRewards,
  detectBursts,
  hourBuckets,
  newVoterAccounts,
  postAgeBuckets,
  postPayoutSignals,
  repeatTargeting,
  sumAccountRewards,
  summarizeImpact,
  voteChanges,
  voterWeekMatrix,
  weightEscalation
} from '../../src/services/downvoteImpact'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-11-28T12:00:00Z')

function row ({
  voter = 'bob',
  target = 'alice/post',
  author = 'alice',
  permlink = 'post',
  weight = -10000,
  time = NOW - 2 * HOUR,
  index = 1,
  valueUsd = 0.25
} = {}) {
  return {
    voter,
    author,
    permlink,
    target,
    weight,
    index,
    time,
    timestamp: new Date(time).toISOString().replace('Z', ''),
    valueUsd
  }
}

function post ({
  created = '2026-11-26T10:00:00',
  cashout = '2026-12-03T10:00:00',
  pending = '10.000 HBD',
  authorPayout = '0.000 HBD',
  curatorPayout = '0.000 HBD',
  netRshares = 1000,
  votes = [{ voter: 'bob', rshares: -200 }]
} = {}) {
  return {
    author: 'alice',
    permlink: 'post',
    created,
    cashout_time: cashout,
    pending_payout_value: pending,
    total_payout_value: authorPayout,
    curator_payout_value: curatorPayout,
    net_rshares: netRshares,
    active_votes: votes,
    beneficiaries: []
  }
}

describe('downvote impact', () => {
  it('uses the target post payout for an exact pending impact', () => {
    const [annotated] = annotateDownvoteImpact([row()], { 'alice/post': post() }, { now: NOW })
    expect(annotated.impactConfidence).toBe('exact')
    expect(annotated.impactSource).toBe('chain')
    expect(annotated.impactHbd).toBeCloseTo(2, 6)
    expect(annotated.payoutState).toBe('pending')
    expect(annotated.postAgeHours).toBeCloseTo(48, 6)
    expect(annotated.effective).toBe(true)
  })

  it('uses settled payouts for paid posts', () => {
    const [annotated] = annotateDownvoteImpact([row()], {
      'alice/post': post({ pending: '0.000 HBD', authorPayout: '8.000 HBD', curatorPayout: '2.000 HBD' })
    }, { now: NOW })
    expect(annotated.payoutState).toBe('paid')
    expect(annotated.impactHbd).toBeCloseTo(2, 6)
    expect(annotated.authorImpactUsd).toBeCloseTo(1.6, 6)
    expect(annotated.curatorImpactUsd).toBeCloseTo(0.4, 6)
  })

  it('recovers net rshares from the vote list when a paid post clears it', () => {
    const [annotated] = annotateDownvoteImpact([row()], {
      'alice/post': post({
        pending: '0.000 HBD',
        authorPayout: '8.000 HBD',
        curatorPayout: '2.000 HBD',
        netRshares: 0,
        votes: [
          { voter: 'bob', rshares: -200 },
          { voter: 'carol', rshares: 1200 }
        ]
      })
    }, { now: NOW })
    expect(annotated.netRshares).toBe(1000)
    expect(annotated.impactConfidence).toBe('exact')
    expect(annotated.impactHbd).toBeCloseTo(2, 6)
  })

  it('marks votes after the payout window as signals with no reward impact', () => {
    const [annotated] = annotateDownvoteImpact([
      row({ time: Date.parse('2026-12-04T10:00:00Z') })
    ], { 'alice/post': post() }, { now: NOW })
    expect(annotated.afterPayout).toBe(true)
    expect(annotated.impactSource).toBe('signal')
    expect(annotated.impactHbd).toBe(0)
    expect(annotated.effective).toBe(false)
  })

  it('does not let a post-payout vote supersede the vote that set the payout', () => {
    const before = row({ time: Date.parse('2026-11-28T10:00:00Z'), index: 1 })
    const after = row({ time: Date.parse('2026-12-04T11:00:00Z'), index: 2 })
    const annotated = annotateDownvoteImpact([before, after], {
      'alice/post': post({
        cashout: '2026-12-03T10:00:00',
        pending: '0.000 HBD',
        authorPayout: '8.000 HBD',
        curatorPayout: '2.000 HBD'
      })
    }, { now: Date.parse('2026-12-05T00:00:00Z') })
    expect(annotated[0].superseded).toBe(false)
    expect(annotated[0].impactHbd).toBeCloseTo(2, 6)
    expect(annotated[1].afterPayout).toBe(true)
    expect(annotated[1].impactSource).toBe('signal')
  })

  it('counts only the last downvote per voter and target', () => {
    const earlier = row({ time: NOW - 3 * HOUR, index: 1 })
    const later = row({ time: NOW - 2 * HOUR, index: 2 })
    const annotated = annotateDownvoteImpact([earlier, later], { 'alice/post': post() }, { now: NOW })
    expect(annotated[0].superseded).toBe(true)
    expect(annotated[0].impactHbd).toBe(0)
    expect(annotated[1].superseded).toBe(false)
    expect(annotated[1].impactHbd).toBeCloseTo(2, 6)
  })

  it('marks a downvote replaced by an upvote as offset', () => {
    const [annotated] = annotateDownvoteImpact([row()], {
      'alice/post': post({ votes: [{ voter: 'bob', rshares: 500 }] })
    }, { now: NOW })
    expect(annotated.offset).toBe(true)
    expect(annotated.impactSource).toBe('offset')
    expect(annotated.impactHbd).toBe(0)
  })

  it('marks a vote that is no longer on the post as inactive', () => {
    const [annotated] = annotateDownvoteImpact([row()], {
      'alice/post': post({ votes: [{ voter: 'carol', rshares: -100 }] })
    }, { now: NOW })
    expect(annotated.inactive).toBe(true)
    expect(annotated.impactSource).toBe('inactive')
    expect(annotated.impactHbd).toBe(0)
  })

  it('falls back to the current-stake estimate when the target is unavailable', () => {
    const [annotated] = annotateDownvoteImpact([row({ valueUsd: 0.42 })], {}, { now: NOW })
    expect(annotated.impactSource).toBe('estimate')
    expect(annotated.impactConfidence).toBe('estimated')
    expect(annotated.impactUsd).toBeCloseTo(0.42, 6)
    expect(annotated.effective).toBe(true)
  })

  it('summarises finalized, pending, exact and after-payout coverage', () => {
    const rows = [
      row({ voter: 'bob', index: 1 }),
      row({ voter: 'carol', index: 2, target: 'alice/paid' }),
      row({ voter: 'dave', index: 3, target: 'alice/signal', time: Date.parse('2026-12-04T10:00:00Z') })
    ]
    const posts = {
      'alice/post': post(),
      'alice/paid': post({ pending: '0.000 HBD', authorPayout: '6.000 HBD', curatorPayout: '4.000 HBD', votes: [{ voter: 'carol', rshares: -250 }] }),
      'alice/signal': post()
    }
    const summary = summarizeImpact(annotateDownvoteImpact(rows, posts, { now: NOW }))
    expect(summary.count).toBe(3)
    expect(summary.effectiveCount).toBe(2)
    expect(summary.exactCount).toBe(2)
    expect(summary.afterPayoutCount).toBe(1)
    expect(summary.finalizedUsd).toBeCloseTo(2.5, 6)
    expect(summary.pendingUsd).toBeCloseTo(2, 6)
    expect(summary.totalUsd).toBeCloseTo(4.5, 6)
    expect(summary.exactCoverage).toBe(1)
    expect(summary.topVoters[0].key).toBe('carol')
  })
})

describe('downvote timing', () => {
  it('builds daily buckets with a cumulative total and respects the range', () => {
    const rows = [
      row({ time: NOW - 1 * HOUR, index: 1 }),
      row({ time: NOW - 2 * DAY, index: 2, voter: 'carol' })
    ]
    const annotated = annotateDownvoteImpact(rows, {
      'alice/post': post({ votes: [{ voter: 'bob', rshares: -200 }, { voter: 'carol', rshares: -200 }] })
    }, { now: NOW })
    const timeline = buildTimeline(annotated, { days: 3, now: NOW })
    expect(timeline.buckets).toHaveLength(3)
    expect(timeline.totalCount).toBe(2)
    expect(timeline.buckets[2].count).toBe(1)
    expect(timeline.buckets[2].cumulativeUsd).toBeCloseTo(4, 6)
  })

  it('buckets post age and hour of day', () => {
    const rows = annotateDownvoteImpact([
      row({ time: Date.parse('2026-11-26T10:30:00Z'), index: 1 }),
      row({ voter: 'carol', time: Date.parse('2026-11-28T09:00:00Z'), index: 2 })
    ], { 'alice/post': post() }, { now: NOW })
    const ages = postAgeBuckets(rows)
    expect(ages.find(bucket => bucket.key === 'under-1h')?.count).toBe(1)
    expect(ages.find(bucket => bucket.key === '1-3d')?.count).toBe(1)
    const hours = hourBuckets(rows)
    expect(hours[9].count).toBe(1)
    expect(hours[10].count).toBe(1)
  })

  it('detects same-target and same-voter bursts', () => {
    const rows = [
      row({ voter: 'bob', time: NOW - 50 * 60 * 1000, index: 1 }),
      row({ voter: 'carol', time: NOW - 40 * 60 * 1000, index: 2 }),
      row({ voter: 'dave', time: NOW - 30 * 60 * 1000, index: 3, target: 'alice/two' }),
      row({ voter: 'dave', time: NOW - 20 * 60 * 1000, index: 4, target: 'alice/three' })
    ]
    const annotated = annotateDownvoteImpact(rows, {}, { now: NOW })
    const bursts = detectBursts(annotated, { windowMinutes: 60, minVotes: 2 })
    expect(bursts.targetBursts[0]).toMatchObject({ target: 'alice/post', count: 2 })
    expect(bursts.voterBursts).toEqual([])
  })

  it('ranks repeat targeting and vote changes', () => {
    const rows = annotateDownvoteImpact([
      row({ voter: 'bob', index: 1 }),
      row({ voter: 'bob', index: 2, target: 'alice/two' }),
      row({ voter: 'bob', index: 3, target: 'alice/three' }),
      row({ voter: 'carol', index: 4, target: 'alice/four' })
    ], {}, { now: NOW })
    const repeat = repeatTargeting(rows, { minVotes: 3 })
    expect(repeat[0]).toMatchObject({ key: 'bob', count: 3 })
    expect(repeat[0].share).toBe(0.75)

    const changes = voteChanges(annotateDownvoteImpact([
      row({ voter: 'bob', target: 'alice/post', index: 1, weight: -10000 }),
      row({ voter: 'bob', target: 'alice/post', index: 2, weight: -5000, time: NOW - 1 * HOUR })
    ], {}, { now: NOW }))
    expect(changes[0]).toMatchObject({ voter: 'bob', count: 2, firstWeight: 10000, lastWeight: 5000 })
  })

  it('builds a voter-by-week activity matrix for top voters', () => {
    const rows = annotateDownvoteImpact([
      row({ voter: 'bob', index: 1, time: Date.parse('2026-11-24T10:00:00Z') }),
      row({ voter: 'bob', index: 2, time: Date.parse('2026-11-17T10:00:00Z') }),
      row({ voter: 'bob', index: 3, time: Date.parse('2026-11-10T10:00:00Z') }),
      row({ voter: 'carol', index: 4, time: Date.parse('2026-11-25T10:00:00Z') }),
      row({ voter: 'bob', index: 5, time: Date.parse('2026-10-01T10:00:00Z') })
    ], {}, { now: NOW })
    const matrix = voterWeekMatrix(rows, { weeks: 3, voters: 2, now: NOW })
    expect(matrix.weeks).toHaveLength(3)
    expect(matrix.voters[0].voter).toBe('bob')
    expect(matrix.voters[0].cells.map(cell => cell.count)).toEqual([1, 1, 1])
    expect(matrix.voters[1].voter).toBe('carol')
    expect(matrix.voters[1].cells[2].count).toBe(1)
    expect(matrix.maxCount).toBe(1)
    expect(matrix.maxUsd).toBeGreaterThan(0)
  })

  it('flags weight escalation and post-payout signals', () => {    const escalation = weightEscalation([
      row({ voter: 'bob', index: 1, weight: -1000, time: NOW - 3 * DAY }),
      row({ voter: 'bob', index: 2, weight: -3000, time: NOW - 2 * DAY }),
      row({ voter: 'bob', index: 3, weight: -10000, time: NOW - 1 * DAY })
    ])
    expect(escalation[0]).toMatchObject({ voter: 'bob', delta: 9000 })

    const rows = annotateDownvoteImpact([
      row({ voter: 'bob', index: 1, time: Date.parse('2026-12-04T10:00:00Z') })
    ], { 'alice/post': post() }, { now: NOW })
    expect(postPayoutSignals(rows)).toMatchObject({ count: 1, voterCount: 1 })
  })

  it('flags accounts created shortly before the downvote', () => {
    const rows = annotateDownvoteImpact([row({ time: NOW - DAY })], {}, { now: NOW })
    const flagged = newVoterAccounts(rows, {
      bob: { created: '2026-11-26T12:00:00' }
    }, { maxAgeDays: 30 })
    expect(flagged[0]).toMatchObject({ voter: 'bob' })
    expect(flagged[0].ageDays).toBeGreaterThan(0)
  })
})

describe('reward comparison', () => {
  const globalProps = {
    total_vesting_fund_hive: '1000000.000 HIVE',
    total_vesting_shares: '1000000000.000000 VESTS'
  }

  it('sums author, beneficiary and curation rewards', () => {
    const history = [
      [1, { op: ['author_reward', { hbd_payout: '1.000 HBD', hive_payout: '2.000 HIVE', vesting_payout: '10.000000 VESTS' }] }],
      [2, { op: ['comment_benefactor_reward', { hbd_payout: '0.500 HBD', hive_payout: '0.000 HIVE', vesting_payout: '0.000000 VESTS' }] }],
      [3, { op: ['curation_reward', { reward: '5.000000 VESTS' }] }]
    ]
    const rewards = sumAccountRewards(history, { globalProps, hiveUsd: 0.5 })
    expect(rewards.authorUsd).toBeCloseTo(2.505, 6)
    expect(rewards.curationUsd).toBeCloseTo(0.0025, 6)
    expect(rewards.totalUsd).toBeCloseTo(2.5075, 6)
  })

  it('compares finalized loss to the same-period author rewards', () => {
    const comparison = compareLossToRewards(
      { finalizedUsd: 5, totalUsd: 8 },
      { authorUsd: 15 }
    )
    expect(comparison.lossUsd).toBe(5)
    expect(comparison.counterfactualUsd).toBe(20)
    expect(comparison.sharePercent).toBeCloseTo(25, 6)
    expect(comparison.netUsd).toBe(10)
  })
})
