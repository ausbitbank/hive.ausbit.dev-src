import { describe, expect, it } from 'vitest'
import {
  VP_REGEN_PERCENT_PER_DAY,
  estimateVoteValueUsd,
  formatRecharge,
  formatVoteValue,
  vpRechargeSeconds
} from '../../src/services/voteValue'

const account = {
  vesting_shares: '1000000.000000 VESTS',
  received_vesting_shares: '0.000000 VESTS',
  delegated_vesting_shares: '0.000000 VESTS',
  vesting_withdraw_rate: '0.000000 VESTS'
}

const rewardFund = {
  recent_claims: '1000000000000000',
  reward_balance: '50000.000 HIVE'
}

const medianHistory = {
  base: '0.500 HBD',
  quote: '1.000 HIVE'
}

describe('vote value', () => {
  it('estimates a full vote from vests, reward fund and the median feed', () => {
    const value = estimateVoteValueUsd({
      account,
      rewardFund,
      medianHistory,
      votingPower: 100
    })
    // 2 × 100 × 1,000,000 rshares against a 50,000 HIVE pool is 0.01 HIVE,
    // priced at $0.50/HIVE.
    expect(value).toBeCloseTo(0.005, 6)
  })

  it('scales with voting power and vote weight', () => {
    const full = estimateVoteValueUsd({ account, rewardFund, medianHistory, votingPower: 100 })
    const half = estimateVoteValueUsd({ account, rewardFund, medianHistory, votingPower: 50 })
    const halfWeight = estimateVoteValueUsd({ account, rewardFund, medianHistory, votingPower: 100, weight: 5000 })
    expect(half).toBeCloseTo(full / 2, 6)
    expect(halfWeight).toBeCloseTo(full / 2, 6)
  })

  it('returns zero without the data needed to price a vote', () => {
    expect(estimateVoteValueUsd({ account: null, rewardFund, medianHistory })).toBe(0)
    expect(estimateVoteValueUsd({ account, rewardFund: null, medianHistory })).toBe(0)
    expect(estimateVoteValueUsd({ account, rewardFund, medianHistory: null })).toBe(0)
  })

  it('reports recharge time at the 20%-per-day rate', () => {
    expect(VP_REGEN_PERCENT_PER_DAY).toBe(20)
    expect(vpRechargeSeconds(100)).toBe(0)
    expect(vpRechargeSeconds(80)).toBe(86400)
    expect(vpRechargeSeconds(0)).toBe(5 * 86400)
  })

  it('formats recharge durations and small vote values', () => {
    expect(formatRecharge(0)).toBe('full')
    expect(formatRecharge(90)).toBe('2m')
    expect(formatRecharge(3700)).toBe('1h 1m')
    expect(formatRecharge(90000)).toBe('1d 1h')
    expect(formatVoteValue(0)).toBe('—')
    expect(formatVoteValue(0.004)).toBe('<$0.01')
    expect(formatVoteValue(0.1234)).toBe('$0.123')
    expect(formatVoteValue(1.234)).toBe('$1.23')
  })
})
