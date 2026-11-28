import { describe, expect, it } from 'vitest'
import {
  availableDelegationVests,
  delegationHp,
  delegationVests,
  extractDelegationEvents,
  summarizeDelegations
} from '../../src/services/delegations'

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE'
}

function historyEntry (index, operation, data, timestamp = '2026-11-18T12:00:00') {
  return [index, {
    op: [operation, data],
    timestamp,
    trx_id: 'tx-' + index
  }]
}

describe('extractDelegationEvents', () => {
  it('resolves inbound and outbound delegation operations', () => {
    const history = [
      historyEntry(1, 'delegate_vesting_shares', {
        delegator: 'alice',
        delegatee: 'bob',
        vesting_shares: '1000000.000000 VESTS'
      }, '2026-11-01T00:00:00'),
      historyEntry(2, 'delegate_vesting_shares', {
        delegator: 'bob',
        delegatee: 'carol',
        vesting_shares: '250000.000000 VESTS'
      }, '2026-11-02T00:00:00'),
      historyEntry(3, 'return_vesting_delegation', {
        account: 'bob',
        vesting_shares: '50000.000000 VESTS'
      }, '2026-11-03T00:00:00')
    ]

    const events = extractDelegationEvents(history, 'bob')
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ direction: 'return', vests: 50000, trxId: 'tx-3' })
    expect(events[1]).toMatchObject({ direction: 'out', counterparty: 'carol', vests: 250000 })
    expect(events[2]).toMatchObject({ direction: 'in', counterparty: 'alice', vests: 1000000 })
  })

  it('ignores unrelated operations and missing accounts', () => {
    const history = [historyEntry(1, 'vote', { voter: 'bob', author: 'alice' })]
    expect(extractDelegationEvents(history, 'bob')).toEqual([])
    expect(extractDelegationEvents(history, '')).toEqual([])
  })
})

describe('delegation amounts', () => {
  it('parses vests and converts to HP', () => {
    expect(delegationVests({ vesting_shares: '1500000.000000 VESTS' })).toBe(1500000)
    expect(delegationHp({ vesting_shares: '1500000.000000 VESTS' }, GLOBAL_PROPS)).toBeCloseTo(1500000)
  })

  it('reserves outgoing delegations and an active powerdown', () => {
    const account = {
      vesting_shares: '1000000.000000 VESTS',
      delegated_vesting_shares: '200000.000000 VESTS',
      to_withdraw: '150000000000',
      withdrawn: '30000000000'
    }
    // 1,000,000 - 200,000 - ((150,000,000,000 - 30,000,000,000) / 1e6)
    expect(availableDelegationVests(account)).toBeCloseTo(680000)
    expect(availableDelegationVests({ vesting_shares: '10.000000 VESTS', delegated_vesting_shares: '20.000000 VESTS' })).toBe(0)
    expect(availableDelegationVests(null)).toBe(0)
  })
})

describe('summarizeDelegations', () => {
  it('totals outbound, inbound and net HP', () => {
    const account = {
      vesting_shares: '5000000.000000 VESTS',
      received_vesting_shares: '2000000.000000 VESTS',
      delegated_vesting_shares: '1000000.000000 VESTS',
      vesting_withdraw_rate: '0.000000 VESTS'
    }
    const result = summarizeDelegations(
      [{ delegatee: 'alice', vesting_shares: '1000000.000000 VESTS', min_delegation_time: '2026-10-01T00:00:00' }],
      [{ delegator: 'carol', vesting_shares: '2000000.000000 VESTS', min_delegation_time: '2026-10-02T00:00:00' }],
      GLOBAL_PROPS,
      account
    )

    expect(result.outgoingCount).toBe(1)
    expect(result.inboundCount).toBe(1)
    expect(result.outgoingHp).toBeCloseTo(1000000)
    expect(result.inboundHp).toBeCloseTo(2000000)
    expect(result.netHp).toBeCloseTo(1000000)
    expect(result.outgoingShare).toBeCloseTo(0.2)
    expect(result.inboundShare).toBeCloseTo(2 / 6)
    expect(result.topOutgoing.delegatee).toBe('alice')
    expect(result.topInbound.delegator).toBe('carol')
  })

  it('handles empty input', () => {
    const result = summarizeDelegations([], [], GLOBAL_PROPS, null)
    expect(result.outgoingHp).toBe(0)
    expect(result.inboundHp).toBe(0)
    expect(result.netHp).toBe(0)
    expect(result.topOutgoing).toBeNull()
  })
})
