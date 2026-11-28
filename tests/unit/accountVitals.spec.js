import { describe, expect, it } from 'vitest'
import { accountVitalsSummary } from '../../src/services/accountVitals'

const NOW = Date.parse('2024-06-01T12:00:00Z')

const GLOBAL_PROPS = {
  total_vesting_fund_hive: '1000000.000 HIVE',
  total_vesting_shares: '350290817133.487929 VESTS'
}

const REWARD_FUND = {
  recent_claims: '1000000000000000',
  reward_balance: '50000.000 HBD'
}

const MEDIAN = {
  current_median_history: {
    base: '0.500 HBD',
    quote: '1.000 HIVE'
  }
}

const PRICES = { hive: { usd: 0.5 } }

function healthyAccount (overrides = {}) {
  return {
    name: 'alice',
    voting_power: 8000,
    last_vote_time: '2024-06-01T00:00:00',
    vesting_shares: '1000000000.000000 VESTS',
    received_vesting_shares: '200000000.000000 VESTS',
    delegated_vesting_shares: '100000000.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    downvote_manabar: {
      current_mana: 2200000000000,
      last_update_time: '2024-06-01T00:00:00'
    },
    ...overrides
  }
}

describe('account vitals summary', () => {
  it('summarises a healthy account', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount(),
      globalProps: GLOBAL_PROPS,
      rc: { max_rc: 1000000000000, rc_manabar: { current_mana: 900000000000 } },
      rewardFund: REWARD_FUND,
      median: MEDIAN,
      prices: PRICES,
      now: NOW
    })

    expect(summary.hasAccount).toBe(true)
    expect(summary.accountName).toBe('alice')

    // 8000 bp plus 12h of regeneration (10000 bp over 5 days) = 90%.
    expect(summary.votingPower.percent).toBeCloseTo(90, 6)
    expect(summary.votingPower.label).toBe('90.00%')
    expect(summary.votingPower.status).toBe('healthy')
    expect(summary.votingPower.fullInSeconds).toBeCloseTo(43200, 0)
    expect(summary.votingPower.fullInLabel).toBe('12h 0m')

    // Canonical downvote power: max mana is vests * 1e6, and the 25% pool
    // scales the stored downvote mana by 4. 2.2e12 / (1.1e9 * 1e6) * 4.
    expect(summary.downvote.percent).toBeCloseTo(0.8, 6)
    expect(summary.downvote.label).toBe('0.80%')

    expect(summary.rc.percent).toBeCloseTo(90, 6)
    expect(summary.rc.label).toBe('90.00%')
    expect(summary.rc.status).toBe('healthy')
    expect(summary.rc.available).toBe(900000000000)
    expect(summary.rc.max).toBe(1000000000000)
    expect(summary.rc.budget.comments).toBe('765')
    expect(summary.rc.budget.votes).toBe('8,218')
    expect(summary.rc.budget.transfers).toBe('1,847')
    expect(summary.rc.budget.claimAccounts).toBe('0')

    expect(summary.voteValue.usd).toBeCloseTo(495, 6)
    expect(summary.voteValue.hive).toBeCloseTo(990, 6)
    expect(summary.voteValue.weight).toBe(10000)
    expect(summary.voteValue.available).toBe(true)
    expect(summary.voteValue.label).toContain('≈')
    expect(summary.voteValue.label).toContain('HIVE')

    expect(summary.hp.owned).toBeCloseTo(2854.771, 2)
    expect(summary.hp.received).toBeCloseTo(570.954, 2)
    expect(summary.hp.delegated).toBeCloseTo(285.477, 2)
    expect(summary.hp.powerdown).toBe(0)
    expect(summary.hp.effective).toBeCloseTo(3140.248, 2)
    expect(summary.hp.label).toMatch(/HP$/)
  })

  it('converts the weekly power-down rate into HP', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount({ vesting_withdraw_rate: '100000000.000000 VESTS' }),
      globalProps: GLOBAL_PROPS,
      now: NOW
    })

    expect(summary.hp.powerdown).toBeCloseTo(285.477, 2)
    // 1b + 200m - 100m - 100m = 1b effective VESTS.
    expect(summary.hp.effective).toBeCloseTo(2854.771, 2)
  })

  it('falls back to the median feed when prices are missing', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount(),
      globalProps: GLOBAL_PROPS,
      rewardFund: REWARD_FUND,
      median: MEDIAN,
      prices: null,
      now: NOW
    })

    expect(summary.voteValue.usd).toBeCloseTo(495, 6)
    expect(summary.voteValue.hive).toBeCloseTo(990, 6)
  })

  it('handles a new account whose manabars are missing', () => {
    const account = {
      name: 'newbie',
      voting_power: 10000,
      last_vote_time: '2024-06-01T12:00:00Z',
      vesting_shares: '500000.000000 VESTS',
      received_vesting_shares: '0.000000 VESTS',
      delegated_vesting_shares: '0.000000 VESTS',
      vesting_withdraw_rate: '0.000000 VESTS'
    }

    const summary = accountVitalsSummary({
      account,
      globalProps: GLOBAL_PROPS,
      rc: null,
      rewardFund: null,
      median: null,
      prices: null,
      now: NOW
    })

    expect(summary.hasAccount).toBe(true)
    expect(summary.votingPower.percent).toBe(100)
    expect(summary.downvote).toEqual({ percent: null, label: '—' })
    expect(summary.rc.percent).toBeNull()
    expect(summary.rc.status).toBe('unavailable')
    expect(summary.rc.budget).toEqual({
      comments: '—',
      votes: '—',
      transfers: '—',
      claimAccounts: '—'
    })
    expect(summary.voteValue.available).toBe(false)
    expect(summary.voteValue.usd).toBe(0)
    expect(summary.hp.owned).toBeCloseTo(1.427, 3)
    expect(summary.hp.effective).toBeCloseTo(1.427, 3)
  })

  it('reports full voting power without a recharge countdown', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount({
        voting_power: 10000,
        last_vote_time: '2024-06-01T12:00:00Z'
      }),
      now: NOW
    })

    expect(summary.votingPower.percent).toBe(100)
    expect(summary.votingPower.status).toBe('full')
    expect(summary.votingPower.fullInSeconds).toBe(0)
    expect(summary.votingPower.fullInLabel).toBe('full')
  })

  it('flags low resource credits', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount(),
      globalProps: GLOBAL_PROPS,
      rc: { max_rc: 1000000000000, rc_manabar: { current_mana: 200000000000 } },
      now: NOW
    })

    expect(summary.rc.percent).toBeCloseTo(20, 6)
    expect(summary.rc.status).toBe('low')
    expect(summary.rc.budget.comments).toBe('170')
  })

  it('degrades safely without global properties or prices', () => {
    const summary = accountVitalsSummary({
      account: healthyAccount(),
      now: NOW
    })

    expect(summary.votingPower.percent).toBeCloseTo(90, 6)
    expect(summary.hp.effective).toBe(0)
    expect(summary.hp.label).toBe('0.00 HP')
    expect(summary.voteValue.available).toBe(false)
    expect(summary.voteValue.usd).toBe(0)
    expect(summary.downvote.percent).toBeCloseTo(0.8, 6)
  })

  it('returns an unavailable summary with no account', () => {
    const summary = accountVitalsSummary()

    expect(summary.hasAccount).toBe(false)
    expect(summary.accountName).toBe('')
    expect(summary.votingPower.status).toBe('unavailable')
    expect(summary.downvote.percent).toBeNull()
    expect(summary.rc.status).toBe('unavailable')
    expect(summary.hp.effective).toBe(0)
    expect(summary.voteValue.available).toBe(false)
  })
})
