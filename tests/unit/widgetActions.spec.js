import { describe, expect, it } from 'vitest'
import {
  cancelOrderAction,
  cancelPowerdownAction,
  cancelSavingsWithdrawalAction,
  claimInterestAction,
  claimRewardsAction,
  operationLabel
} from '../../src/services/widgetActions'

const account = 'ausbitbank'

function rewardRecord (overrides = {}) {
  return {
    name: account,
    reward_hive_balance: '1.500 HIVE',
    reward_hbd_balance: '2.000 HBD',
    reward_vesting_balance: '3.000000 VESTS',
    ...overrides
  }
}

describe('dashboard widget actions', () => {
  it('builds a posting-authority claim for every pending reward', () => {
    const action = claimRewardsAction(account, rewardRecord())
    expect(action.id).toBe('claimRewards')
    expect(action.authority.key).toBe('posting')
    expect(action.authority.label).toBe('Posting key')
    expect(action.operations).toHaveLength(1)
    const [type, data] = action.operations[0]
    expect(type).toBe('claim_reward_balance')
    expect(data).toEqual({
      account,
      reward_hive: '1.500 HIVE',
      reward_hbd: '2.000 HBD',
      reward_vests: '3.000000 VESTS'
    })
    expect(action.details).toEqual(['1.500 HIVE', '2.000 HBD', '3.000000 VESTS (Hive Power)'])
  })

  it('does not build a no-op reward claim', () => {
    expect(claimRewardsAction(account, rewardRecord({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS'
    }))).toBeNull()
    expect(claimRewardsAction('', rewardRecord())).toBeNull()
    expect(claimRewardsAction(account, null)).toBeNull()
  })

  it('claims HBD interest with the same transfer/cancel pair as the wallet', () => {
    const action = claimInterestAction(account)
    expect(action.authority.key).toBe('active')
    expect(action.operations.map(op => op[0])).toEqual([
      'transfer_from_savings',
      'cancel_transfer_from_savings'
    ])
    expect(action.operations[0][1]).toMatchObject({
      from: account,
      to: account,
      request_id: 42069420,
      amount: '0.001 HBD'
    })
    expect(action.operations[1][1]).toEqual({ from: account, request_id: 42069420 })
  })

  it('cancels a power-down by withdrawing zero VESTS', () => {
    const action = cancelPowerdownAction(account)
    expect(action.authority.key).toBe('active')
    expect(action.operations).toEqual([['withdraw_vesting', {
      account,
      vesting_shares: '0.000000 VESTS'
    }]])
  })

  it('cancels a savings withdrawal by request id', () => {
    const action = cancelSavingsWithdrawalAction(account, '42')
    expect(action.id).toBe('cancelSavings-42')
    expect(action.operations).toEqual([['cancel_transfer_from_savings', { from: account, request_id: 42 }]])
    expect(cancelSavingsWithdrawalAction(account, 'nope')).toBeNull()
    expect(cancelSavingsWithdrawalAction(account, -1)).toBeNull()
  })

  it('cancels an open order by order id', () => {
    const action = cancelOrderAction(account, 99)
    expect(action.id).toBe('cancelOrder-99')
    expect(action.operations).toEqual([['limit_order_cancel', { owner: account, orderid: 99 }]])
    expect(cancelOrderAction(account, null)).toBeNull()
  })

  it('normalises an @ prefix and rejects an invalid account', () => {
    expect(claimInterestAction('@' + account).operations[0][1].from).toBe(account)
    expect(cancelPowerdownAction('not a name')).toBeNull()
    expect(cancelPowerdownAction('')).toBeNull()
  })

  it('labels operations for the confirmation dialog', () => {
    expect(operationLabel(['claim_reward_balance', {}])).toBe('claim reward balance')
    expect(operationLabel(null)).toBe('operation')
  })
})
