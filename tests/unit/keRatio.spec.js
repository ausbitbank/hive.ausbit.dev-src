import { describe, expect, it } from 'vitest'
import { keRatioSummary, keRewardBreakdown } from '../../src/services/keRatio'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

// 1,000,000 VESTS of a 1e9 VESTS / 1e9 HIVE pool is 1,000 HP.
const GLOBAL_PROPS = {
  total_vesting_shares: '1000000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000000 HIVE'
}

function account (overrides = {}) {
  return {
    name: 'ausbitbank',
    vesting_shares: '1000000.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    ...overrides
  }
}

function row (type, data, at = NOW - 10 * DAY_MS) {
  return [0, {
    op: [type, data],
    timestamp: new Date(at).toISOString().replace('T', ' ').replace('Z', '')
  }]
}

describe('KE reward breakdown', () => {
  it('collects every reward stream with its paid units', () => {
    const history = [
      row('author_reward', { hive_payout: '1.000 HIVE', hbd_payout: '2.000 HBD', vesting_payout: '500.000000 VESTS' }),
      row('curation_reward', { reward: '250.000000 VESTS' }),
      row('comment_reward', { payout: '3.000 HBD' }),
      row('comment_benefactor_reward', { hbd_payout: '0.500 HBD', vesting_payout: '100.000000 VESTS' }),
      row('producer_reward', { vesting_shares: '300.000000 VESTS' }),
      row('interest', { interest: '0.250 HBD' }),
      row('proposal_pay', { daily_pay: '10.000 HBD' })
    ]
    const breakdown = keRewardBreakdown({
      history,
      windowStart: NOW - 30 * DAY_MS,
      globalProps: GLOBAL_PROPS
    })
    expect(breakdown.author.hive).toBeCloseTo(1.5, 6) // 1 HIVE + 500 VESTS = 0.5 HP
    expect(breakdown.author.hbd).toBe(2)
    expect(breakdown.curation.hive).toBeCloseTo(0.25, 6)
    expect(breakdown.comment.hbd).toBe(3)
    expect(breakdown.beneficiary.hbd).toBe(0.5)
    expect(breakdown.beneficiary.hive).toBeCloseTo(0.1, 6)
    expect(breakdown.witness.hive).toBeCloseTo(0.3, 6)
    expect(breakdown.interest.hbd).toBe(0.25)
    expect(breakdown.proposal.hbd).toBe(10)
  })

  it('ignores rows outside the window and malformed rows', () => {
    const breakdown = keRewardBreakdown({
      history: [
        row('author_reward', { hive_payout: '1.000 HIVE' }, NOW - 60 * DAY_MS),
        [0, { op: ['curation_reward'] }],
        null,
        [0, { op: ['curation_reward', { reward: '10.000000 VESTS' }], timestamp: 'not a date' }]
      ],
      windowStart: NOW - 30 * DAY_MS,
      globalProps: GLOBAL_PROPS
    })
    expect(breakdown.author.hive).toBe(0)
    expect(breakdown.curation.hive).toBe(0)
  })
})

describe('KE ratio summary', () => {
  it('computes the ratio from every counted source', () => {
    const history = [
      row('author_reward', { hive_payout: '1.000 HIVE', hbd_payout: '2.000 HBD', vesting_payout: '500.000000 VESTS' }),
      row('curation_reward', { reward: '250.000000 VESTS' })
    ]
    const summary = keRatioSummary({
      history,
      account: account(),
      globalProps: GLOBAL_PROPS,
      prices: { hive: { usd: 0.5 }, hive_dollar: { usd: 1 } },
      windowDays: 30,
      now: NOW
    })
    // At $1 HBD / $0.50 HIVE: 1 HIVE + 0.5 HP + 2 HBD (4 HIVE) + 0.25 HP = 5.75 HIVE.
    expect(summary.stakedHp).toBeCloseTo(1000, 6)
    expect(summary.totalHiveValue).toBeCloseTo(5.75, 6)
    expect(summary.ratio).toBeCloseTo(0.575, 6)
    expect(summary.ratioLabel).toBe('0.57%')
    expect(summary.annualised).toBeCloseTo(7, 2)
    expect(summary.included).toEqual(['Author rewards', 'Curation rewards'])
    expect(summary.limitations.length).toBeGreaterThan(2)
    expect(summary.limitations.join(' ')).toMatch(/not a score/)
  })

  it('returns no ratio without staked HP', () => {
    const summary = keRatioSummary({
      history: [row('author_reward', { hive_payout: '1.000 HIVE' })],
      account: account({ vesting_shares: '0.000000 VESTS' }),
      globalProps: GLOBAL_PROPS,
      windowDays: 30,
      now: NOW
    })
    expect(summary.stakedHp).toBe(0)
    expect(summary.ratio).toBeNull()
    expect(summary.ratioLabel).toBe('—')
    expect(summary.annualised).toBeNull()
  })

  it('falls back to HBD-as-HIVE when no price feed is available', () => {
    const summary = keRatioSummary({
      history: [row('comment_reward', { payout: '2.000 HBD' })],
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 30,
      now: NOW
    })
    expect(summary.totalHiveValue).toBe(2)
    expect(summary.sources[0].hiveValue).toBe(2)
  })

  it('reports an empty window honestly', () => {
    const summary = keRatioSummary({
      history: [],
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 30,
      now: NOW
    })
    expect(summary.hasRewards).toBe(false)
    expect(summary.sources).toEqual([])
    expect(summary.ratio).toBe(0)
    expect(summary.limitations.join(' ')).toMatch(/none found/)
  })

  it('mentions truncation when the history page is capped', () => {
    const summary = keRatioSummary({
      history: [],
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 90,
      historyTruncated: true,
      now: NOW
    })
    expect(summary.truncated).toBe(true)
    expect(summary.limitations.join(' ')).toMatch(/1,000 operations/)
  })
})
