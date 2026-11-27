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
      row('comment_benefactor_reward', { hbd_payout: '0.500 HBD', vesting_payout: '100.000000 VESTS' }),
      row('producer_reward', { vesting_shares: '300.000000 VESTS' }),
      row('interest', { interest: '0.250 HBD' }),
      row('proposal_pay', { payment: '10.000 HBD' })
    ]
    const breakdown = keRewardBreakdown({
      history,
      windowStart: NOW - 30 * DAY_MS,
      globalProps: GLOBAL_PROPS
    })
    expect(breakdown.author.hive).toBeCloseTo(1.5, 6) // 1 HIVE + 500 VESTS = 0.5 HP
    expect(breakdown.author.hbd).toBe(2)
    expect(breakdown.curation.hive).toBeCloseTo(0.25, 6)
    expect(breakdown.beneficiary.hbd).toBe(0.5)
    expect(breakdown.beneficiary.hive).toBeCloseTo(0.1, 6)
    expect(breakdown.witness.hive).toBeCloseTo(0.3, 6)
    expect(breakdown.interest.hbd).toBe(0.25)
    expect(breakdown.proposal.hbd).toBe(10)
  })

  it('does not count the comment payout summary alongside its breakdown', () => {
    // `comment_reward` reports the post's total payout. Author, curation and
    // beneficiary rewards are the same money, so counting all four double pays.
    const breakdown = keRewardBreakdown({
      history: [
        row('comment_reward', { payout: '3.000 HBD' }),
        row('author_reward', { hbd_payout: '2.000 HBD' }),
        row('curation_reward', { reward: '250.000000 VESTS' })
      ],
      windowStart: NOW - 30 * DAY_MS,
      globalProps: GLOBAL_PROPS
    })
    expect(breakdown.comment).toBeUndefined()
    expect(breakdown.author.hbd).toBe(2)
    expect(breakdown.curation.hive).toBeCloseTo(0.25, 6)
  })

  it('reads both legacy and current proposal/benefactor field names', () => {
    const breakdown = keRewardBreakdown({
      history: [
        row('proposal_pay', { daily_pay: '9.000 HBD' }),
        row('comment_benefactor_reward', { reward: '100.000000 VESTS' })
      ],
      windowStart: NOW - 30 * DAY_MS,
      globalProps: GLOBAL_PROPS
    })
    expect(breakdown.proposal.hbd).toBe(9)
    expect(breakdown.beneficiary.hive).toBeCloseTo(0.1, 6)
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
      history: [row('interest', { interest: '2.000 HBD' })],
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 30,
      now: NOW
    })
    expect(summary.totalHiveValue).toBe(2)
    expect(summary.sources[0].hiveValue).toBe(2)
  })

  it('annualises a complete read over the account age, not just the newest reward', () => {
    const summary = keRatioSummary({
      history: [row('author_reward', { hive_payout: '1.000 HIVE' })],
      account: account({ created: new Date(NOW - 10 * DAY_MS).toISOString() }),
      globalProps: GLOBAL_PROPS,
      windowDays: 30,
      now: NOW
    })
    // 1 HIVE / 1000 HP = 0.1% over 10 days of account age.
    expect(summary.coverageDays).toBe(10)
    expect(summary.annualised).toBeCloseTo(3.65, 2)
    expect(summary.estimated).toBe(false)
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
    expect(summary.coverageDays).toBe(30)
    expect(summary.limitations.join(' ')).toMatch(/none found/)
  })

  it('estimates a truncated high-frequency read from the covered span', () => {
    // A top witness earns every minute. Ten pages cover ten days of a 365-day
    // request; the window totals must be scaled instead of reporting minutes.
    const history = [
      row('producer_reward', { vesting_shares: '1000.000000 VESTS' }, NOW - 10 * DAY_MS),
      row('producer_reward', { vesting_shares: '1000.000000 VESTS' }, NOW - 1 * DAY_MS)
    ]
    const summary = keRatioSummary({
      history,
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 365,
      historyTruncated: true,
      now: NOW
    })
    // Two 1 HP rewards over 10 days -> 2 HP observed, scaled to 73 HP.
    expect(summary.estimated).toBe(true)
    expect(summary.coverageDays).toBe(10)
    expect(summary.coveragePercent).toBeCloseTo(2.7, 1)
    expect(summary.totalHiveValue).toBeCloseTo(73, 6)
    expect(summary.ratio).toBeCloseTo(7.3, 4)
    // The annualised rate uses the observed part, not the requested window.
    expect(summary.annualised).toBeCloseTo(7.3, 1)
    expect(summary.limitations.join(' ')).toMatch(/estimated from the last 10 of 365 days/)
  })

  it('mentions truncation when no coverage can be measured', () => {
    const summary = keRatioSummary({
      history: [],
      account: account(),
      globalProps: GLOBAL_PROPS,
      windowDays: 90,
      historyTruncated: true,
      now: NOW
    })
    expect(summary.truncated).toBe(true)
    expect(summary.estimated).toBe(false)
    expect(summary.limitations.join(' ')).toMatch(/history was capped/)
  })
})
