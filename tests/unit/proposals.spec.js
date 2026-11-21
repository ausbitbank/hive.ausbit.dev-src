import { describe, expect, it } from 'vitest'
import {
  dailyPayHbd,
  daysElapsed,
  daysRemaining,
  daysTotal,
  filterProposals,
  fundingSummary,
  isFunded,
  paidHbd,
  proposalPhase,
  proposalVoteQueueItem,
  sortProposals,
  toPayHbd
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
