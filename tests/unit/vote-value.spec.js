import { describe, expect, it } from 'vitest'
import {
  DOWNVOTE_POOL_PERCENT,
  VP_REGEN_PERCENT_PER_DAY,
  downvotePowerPercent,
  estimateDownvoteValueUsd,
  estimateVoteRshares,
  estimateVoteValueUsd,
  formatRecharge,
  formatVoteValue,
  rsharesToUsd,
  vpRechargeSeconds
} from '../../src/services/voteValue'

const account = {
  vesting_shares: '1000000.000000 VESTS',
  received_vesting_shares: '0.000000 VESTS',
  delegated_vesting_shares: '0.000000 VESTS',
  vesting_withdraw_rate: '0.000000 VESTS',
  voting_manabar: { current_mana: 1000000000000 },
  downvote_manabar: { current_mana: 250000000000 }
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
  it('estimates a full vote from micro-VESTS, reward fund and the median feed', () => {
    const value = estimateVoteValueUsd({
      account,
      rewardFund,
      medianHistory,
      votingPower: 100
    })
    // 1,000,000 VESTS is 1e12 micro-VESTS. A 100% vote spends 2% of that at
    // 100% voting power, so 2e10 rshares against the 50,000 HIVE pool is 1
    // HIVE, priced at $0.50/HIVE.
    expect(value).toBeCloseTo(0.5, 6)
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

  it('converts rshares only when the fund and price feed are usable', () => {
    expect(estimateVoteRshares({ account, votingPower: 100, weight: 10000 })).toBe(2e10)
    expect(rsharesToUsd(2e10, rewardFund, medianHistory)).toBeCloseTo(0.5, 6)
    expect(rsharesToUsd(0, rewardFund, medianHistory)).toBe(0)
    expect(rsharesToUsd(-2e10, rewardFund, medianHistory)).toBeCloseTo(0.5, 6)
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

describe('downvote power', () => {
  it('uses the 25% downvote pool as a full-manabar equivalent', () => {
    expect(DOWNVOTE_POOL_PERCENT).toBe(25)
    expect(downvotePowerPercent(account)).toBe(100)
    expect(downvotePowerPercent({
      ...account,
      downvote_manabar: { current_mana: 125000000000 },
      voting_manabar: { current_mana: 0 }
    })).toBe(50)
  })

  it('uses the upvote manabar when it is larger than the scaled downvote pool', () => {
    const lowDownvoteMana = {
      ...account,
      downvote_manabar: { current_mana: 0 },
      voting_manabar: { current_mana: 1000000000000 }
    }
    expect(downvotePowerPercent(lowDownvoteMana)).toBe(100)
    expect(downvotePowerPercent({ ...account, downvote_manabar: { current_mana: 0 }, voting_manabar: { current_mana: 0 } })).toBe(0)
  })

  it('estimates downvote rshares and USD value at the current mana', () => {
    const full = estimateDownvoteValueUsd({ account, rewardFund, medianHistory, weight: 10000 })
    expect(full.rshares).toBe(2e10)
    expect(full.usd).toBeCloseTo(0.5, 6)

    const halfMana = {
      ...account,
      downvote_manabar: { current_mana: 125000000000 },
      voting_manabar: { current_mana: 0 }
    }
    const half = estimateDownvoteValueUsd({ account: halfMana, rewardFund, medianHistory, weight: 10000 })
    expect(half.rshares).toBe(1e10)
    expect(half.usd).toBeCloseTo(0.25, 6)
    expect(estimateDownvoteValueUsd({ account: null, rewardFund, medianHistory }).usd).toBe(0)
  })
})
