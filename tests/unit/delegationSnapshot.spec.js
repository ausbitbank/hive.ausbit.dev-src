import { describe, expect, it } from 'vitest'
import { delegationSnapshotSummary } from '../../src/services/delegationSnapshot'

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE'
}

function account (overrides = {}) {
  return {
    name: 'alice',
    vesting_shares: '5000000.000000 VESTS',
    received_vesting_shares: '2000000.000000 VESTS',
    delegated_vesting_shares: '1000000.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    ...overrides
  }
}

function outgoing (delegatee, vests) {
  return { delegatee, vesting_shares: vests + '.000000 VESTS' }
}

function incoming (delegator, vests) {
  // Real inbound rows carry both delegator and delegatee; the widget must show
  // the delegator, never the account the delegation is going to.
  return { delegator, delegatee: 'alice', vesting_shares: vests + '.000000 VESTS' }
}

describe('delegationSnapshotSummary', () => {
  it('totals and sorts outgoing and incoming delegations high to low', () => {
    const summary = delegationSnapshotSummary({
      account: account(),
      globalProps: GLOBAL_PROPS,
      outgoing: [outgoing('bob', 300000), outgoing('carol', 700000)],
      incoming: [incoming('dave', 400000), incoming('erin', 600000)]
    })

    expect(summary.accountName).toBe('alice')
    expect(summary.outgoing.map(row => row.name)).toEqual(['carol', 'bob'])
    expect(summary.incoming.map(row => row.name)).toEqual(['erin', 'dave'])
    expect(summary.outgoing[0]).toMatchObject({ vests: 700000 })
    expect(summary.outgoing[0].hp).toBeCloseTo(700000)
    expect(summary.outgoing[0].label).toBe('700,000.00 HP')
    expect(summary.outgoingHp).toBeCloseTo(1000000)
    expect(summary.incomingHp).toBeCloseTo(1000000)
    expect(summary.hasOutgoing).toBe(true)
    expect(summary.hasIncoming).toBe(true)
    expect(summary.hasData).toBe(true)
  })

  it('caps top rows by limit without truncating the totals', () => {
    const summary = delegationSnapshotSummary({
      account: account(),
      globalProps: GLOBAL_PROPS,
      outgoing: [
        outgoing('bob', 100000),
        outgoing('carol', 200000),
        outgoing('dave', 300000)
      ],
      incoming: [
        incoming('erin', 100000),
        incoming('frank', 200000)
      ],
      limit: 1
    })

    expect(summary.outgoing).toHaveLength(3)
    expect(summary.topOutgoing).toHaveLength(1)
    expect(summary.topOutgoing[0].name).toBe('dave')
    expect(summary.topIncoming).toHaveLength(1)
    expect(summary.topIncoming[0].name).toBe('frank')
    expect(summary.outgoingHp).toBeCloseTo(600000)
    expect(summary.incomingHp).toBeCloseTo(300000)
  })

  it('uses the account record for effective HP without double counting lists', () => {
    const summary = delegationSnapshotSummary({
      account: account({ vesting_withdraw_rate: '500000.000000 VESTS' }),
      globalProps: GLOBAL_PROPS,
      outgoing: [outgoing('bob', 1000000)],
      incoming: [incoming('carol', 2000000)]
    })

    // 5M owned + 2M received - 1M delegated - 0.5M powering down = 5.5M HP.
    // The lists already appear in the account fields and must not be added again.
    expect(summary.effectiveHp).toBeCloseTo(5500000)
  })

  it('accepts already-shaped delegation rows that only carry numeric vests', () => {
    const summary = delegationSnapshotSummary({
      account: account(),
      globalProps: GLOBAL_PROPS,
      outgoing: [{ delegatee: 'bob', vests: 500000 }],
      incoming: [{ delegator: 'carol', vests: 250000 }]
    })

    expect(summary.outgoing[0]).toMatchObject({ name: 'bob', vests: 500000 })
    expect(summary.outgoing[0].hp).toBeCloseTo(500000)
    expect(summary.incoming[0].hp).toBeCloseTo(250000)
    expect(summary.outgoingHp).toBeCloseTo(500000)
    expect(summary.incomingHp).toBeCloseTo(250000)
  })

  it('handles missing global properties by keeping vests totals', () => {
    const summary = delegationSnapshotSummary({
      account: account(),
      outgoing: [outgoing('bob', 300000)],
      incoming: [incoming('carol', 200000)]
    })

    expect(summary.outgoingHp).toBe(0)
    expect(summary.incomingHp).toBe(0)
    expect(summary.effectiveHp).toBe(0)
    expect(summary.outgoing[0].vests).toBe(300000)
    expect(summary.outgoing[0].hp).toBe(0)
  })

  it('handles a missing account and missing lists', () => {
    const summary = delegationSnapshotSummary({
      globalProps: GLOBAL_PROPS,
      outgoing: [outgoing('bob', 300000)]
    })

    expect(summary.accountName).toBe('')
    expect(summary.effectiveHp).toBe(0)
    expect(summary.hasOutgoing).toBe(true)
    expect(summary.hasIncoming).toBe(false)
    expect(summary.incoming).toEqual([])
    expect(summary.topIncoming).toEqual([])
  })

  it('reports an empty account with no delegations', () => {
    const summary = delegationSnapshotSummary({
      account: { name: 'alice' },
      globalProps: GLOBAL_PROPS
    })

    expect(summary.accountName).toBe('alice')
    expect(summary.outgoing).toEqual([])
    expect(summary.incoming).toEqual([])
    expect(summary.outgoingHp).toBe(0)
    expect(summary.incomingHp).toBe(0)
    expect(summary.effectiveHp).toBe(0)
    expect(summary.hasOutgoing).toBe(false)
    expect(summary.hasIncoming).toBe(false)
    expect(summary.hasData).toBe(true)
  })

  it('returns a fully empty summary when nothing is supplied', () => {
    const summary = delegationSnapshotSummary()

    expect(summary.accountName).toBe('')
    expect(summary.outgoing).toEqual([])
    expect(summary.incoming).toEqual([])
    expect(summary.topOutgoing).toEqual([])
    expect(summary.topIncoming).toEqual([])
    expect(summary.hasOutgoing).toBe(false)
    expect(summary.hasIncoming).toBe(false)
    expect(summary.hasData).toBe(false)
  })

  it('ignores delegations without a counterparty name', () => {
    const summary = delegationSnapshotSummary({
      account: account(),
      globalProps: GLOBAL_PROPS,
      outgoing: [outgoing('', 100000), outgoing('bob', 200000), null],
      incoming: [{ vesting_shares: '50000.000000 VESTS' }, incoming('carol', 200000)]
    })

    expect(summary.outgoing.map(row => row.name)).toEqual(['bob'])
    expect(summary.incoming.map(row => row.name)).toEqual(['carol'])
    expect(summary.outgoingHp).toBeCloseTo(200000)
    expect(summary.incomingHp).toBeCloseTo(200000)
  })
})
