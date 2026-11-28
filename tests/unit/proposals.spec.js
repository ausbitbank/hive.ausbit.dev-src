import { describe, expect, it } from 'vitest'
import {
  assetAmount,
  dailyPayHbd,
  daysElapsed,
  daysRemaining,
  daysTotal,
  daysUntilStart,
  filterProposals,
  formatHbd,
  formatHp,
  formatNumber,
  fundingSummary,
  isFunded,
  paidHbd,
  proposalPhase,
  proposalStatus,
  proposalVoteQueueItem,
  sortProposals,
  toPayHbd,
  voteValueHp
} from '../../src/services/proposals'

function proposal (overrides = {}) {
  return {
    id: 1,
    creator: 'alice',
    receiver: 'alice',
    start_date: '2026-01-01T00:00:00',
    end_date: '2026-01-11T00:00:00',
    daily_pay: { amount: '100000', precision: 3, nai: '@@000000013' },
    total_votes: '100',
    status: 'active',
    subject: 'A proposal',
    permlink: 'a-proposal',
    ...overrides
  }
}

describe('proposal helpers', () => {
  it('builds an active-key queue item for update_proposal_votes', () => {
    expect(proposalVoteQueueItem('alice', '373', true)).toEqual([
      'alice',
      'active',
      ['update_proposal_votes', {
        voter: 'alice',
        proposal_ids: [373],
        approve: true,
        extensions: []
      }]
    ])
    expect(proposalVoteQueueItem('alice', 373, false)[2][1].approve).toBe(false)
  })

  it('parses typed and string daily pay', () => {
    expect(dailyPayHbd(proposal())).toBe(100)
    expect(dailyPayHbd({ daily_pay: '12.500 HBD' })).toBe(12.5)
  })

  it('computes whole-day duration and clamps elapsed/remaining', () => {
    const p = proposal()
    expect(daysTotal(p)).toBe(10)
    expect(daysElapsed(p, new Date('2025-12-25T00:00:00Z'))).toBe(0)
    expect(daysElapsed(p, new Date('2026-01-04T00:00:00Z'))).toBe(3)
    expect(daysRemaining(p, new Date('2026-01-04T00:00:00Z'))).toBe(7)
    expect(daysElapsed(p, new Date('2026-02-01T00:00:00Z'))).toBe(10)
    expect(daysRemaining(p, new Date('2026-02-01T00:00:00Z'))).toBe(0)
    // An upcoming proposal reports time until its start, not its window length.
    expect(daysUntilStart(p, new Date('2025-12-25T00:00:00Z'))).toBe(7)
    expect(daysUntilStart(p, new Date('2026-01-04T00:00:00Z'))).toBe(0)
    expect(daysUntilStart(p, new Date('2026-02-01T00:00:00Z'))).toBe(0)
  })

  it('projects paid and remaining payments from the clamped days', () => {
    const p = proposal()
    const now = new Date('2026-01-04T00:00:00Z')
    expect(paidHbd(p, now)).toBe(300)
    expect(toPayHbd(p, now)).toBe(700)
    expect(paidHbd(p, now) + toPayHbd(p, now)).toBe(1000)
  })

  it('classifies funding and phases', () => {
    expect(isFunded(proposal({ id: 0, total_votes: '50' }), 500)).toBe(true)
    expect(isFunded(proposal({ total_votes: '500' }), 500)).toBe(true)
    expect(isFunded(proposal({ total_votes: '499' }), 500)).toBe(false)
    expect(proposalPhase(proposal(), new Date('2026-01-05T00:00:00Z'))).toBe('active')
    expect(proposalPhase(proposal(), new Date('2025-12-01T00:00:00Z'))).toBe('upcoming')
    expect(proposalPhase(proposal(), new Date('2026-02-01T00:00:00Z'))).toBe('expired')
  })

  it('summarises funded daily pay, stabilizer pay and budget', () => {
    const returnProposal = proposal({ id: 0, total_votes: '1000', daily_pay: { amount: '240000000000', precision: 3 } })
    const funded = proposal({ id: 1, total_votes: '1500' })
    const unfunded = proposal({ id: 2, total_votes: '500' })
    const stabilizer = proposal({ id: 3, receiver: 'hbdstabilizer', total_votes: '2000', daily_pay: { amount: '12000000', precision: 3 } })
    const summary = fundingSummary([returnProposal, funded, unfunded, stabilizer], null, {
      fundHbdBalance: '1000.000 HBD',
      returnVotes: 1000,
      now: new Date('2026-01-05T00:00:00Z')
    })

    expect(summary.dailyFunded).toBe(100)
    expect(summary.hbdStabilizerDaily).toBe(12000)
    expect(summary.maxDailyBudget).toBe(10)
    expect(summary.totalBudget).toBe(1000)
    expect(summary.returnVotes).toBe(1000)
  })

  it('filters by tab/search/voted ids and sorts', () => {
    const a = proposal({ id: 1, subject: 'Alpha', total_votes: '300', start_date: '2026-11-01T00:00:00', end_date: '2026-12-01T00:00:00' })
    const b = proposal({ id: 2, subject: 'Beta', daily_pay: { amount: '200000', precision: 3 }, total_votes: '100', start_date: '2026-11-02T00:00:00', end_date: '2026-12-02T00:00:00' })
    const c = proposal({ id: 3, subject: 'Gamma', total_votes: '200', status: 'expired' })
    const now = new Date('2026-01-05T00:00:00Z')

    expect(filterProposals([a, b, c], { search: 'beta', now }).map(p => p.id)).toEqual([2])
    expect(filterProposals([a, b, c], { tab: 'expired', now }).map(p => p.id)).toEqual([3])
    expect(filterProposals([a, b, c], { tab: 'voted', votedIds: new Set([1, 3]), now }).map(p => p.id)).toEqual([1, 3])
    expect(sortProposals([a, b], 'daily').map(p => p.id)).toEqual([2, 1])
    expect(sortProposals([a, b], 'newest').map(p => p.id)).toEqual([2, 1])
    expect(sortProposals([a, b, c], 'votes').map(p => p.id)).toEqual([1, 3, 2])
  })
})

describe('proposal formatting and status helpers', () => {
  it('reads typed and string assets without losing precision', () => {
    expect(assetAmount(null)).toBe(0)
    expect(assetAmount(12.5)).toBe(12.5)
    expect(assetAmount('12.345 HBD')).toBe(12.345)
    expect(assetAmount({ amount: '12345', precision: 3 })).toBe(12.345)
    expect(assetAmount({ amount: 'nope', precision: 3 })).toBe(0)
    expect(assetAmount({ amount: '12345' })).toBe(12.345)
    expect(assetAmount({})).toBe(0)
  })

  it('converts micro-VESTS to HP only when global props are usable', () => {
    const globalProps = {
      total_vesting_shares: '1000000.000000 VESTS',
      total_vesting_fund_hive: '1000000.000000 HIVE'
    }
    expect(voteValueHp({ total_votes: 1_000_000 }, globalProps)).toBe(1)
    expect(voteValueHp({ total_votes: 0 }, globalProps)).toBe(0)
    expect(voteValueHp({ total_votes: 1_000_000 }, null)).toBe(0)
    expect(voteValueHp({ total_votes: 1_000_000 }, { total_vesting_shares: '0' })).toBe(0)
  })

  it('labels the return proposal, phases and funding state', () => {
    const now = new Date('2026-01-05T00:00:00Z')
    expect(proposalStatus({ id: 0 }, 100, now)).toEqual({ label: 'Return proposal', color: 'purple' })
    expect(proposalStatus({ id: 1, status: 'expired' }, 100, now)).toEqual({ label: 'Expired', color: 'grey' })
    expect(proposalStatus({ id: 1, start_date: '2026-02-01T00:00:00', end_date: '2026-03-01T00:00:00' }, 100, now)).toEqual({ label: 'Upcoming', color: 'blue' })
    expect(proposalStatus({ id: 1, total_votes: '200', start_date: '2026-01-01T00:00:00', end_date: '2026-02-01T00:00:00' }, 100, now)).toEqual({ label: 'Funded', color: 'green' })
    expect(proposalStatus({ id: 1, total_votes: '50', start_date: '2026-01-01T00:00:00', end_date: '2026-02-01T00:00:00' }, 100, now)).toEqual({ label: 'Active', color: 'orange' })
  })

  it('formats numbers, HBD and HP with honest fallbacks', () => {
    expect(formatNumber(12.3456, 2)).toBe('12.35')
    expect(formatNumber(12.3456, 0)).toBe('12')
    expect(formatNumber('nope')).toBe('0')
    expect(formatHbd(1234.5)).toBe('1,234.5')
    expect(formatHp(99.9)).toBe('99.9')
    expect(formatHp(1234.5)).toBe('1,235')
    expect(formatHp('nope')).toBe('0')
  })
})
