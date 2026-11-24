import { describe, expect, it } from 'vitest'
import {
  appendPortfolioSnapshot,
  MAX_PORTFOLIO_POINTS,
  normalisePortfolioPoints,
  portfolioTrendSummary
} from '../../src/services/portfolioTrend'
import { normaliseChartDays, normaliseMarketChart } from '../../src/services/prices'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const NOW = 1_800_000_000_000

function account (overrides = {}) {
  return {
    name: 'ausbitbank',
    balance: '100.000 HIVE',
    vesting_shares: '0.000000 VESTS',
    hbd_balance: '50.000 HBD',
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '0.000 HBD',
    ...overrides
  }
}

function snapshots () {
  return [
    { at: NOW - 10 * DAY_MS, usd: 100 },
    { at: NOW - 5 * DAY_MS, usd: 120 },
    { at: NOW, usd: 150 }
  ]
}

function priceHistory () {
  return {
    days: 30,
    points: [
      { at: NOW - 30 * DAY_MS, usd: 0.2 },
      { at: NOW - 15 * DAY_MS, usd: 0.25 },
      { at: NOW, usd: 0.3 }
    ]
  }
}

describe('portfolio trend summary', () => {
  it('summarises the current value and both series', () => {
    const summary = portfolioTrendSummary({
      account: account(),
      prices: { hive: { usd: 0.3 }, hive_dollar: { usd: 1 } },
      priceHistory: priceHistory(),
      snapshots: snapshots(),
      windowDays: 30,
      now: NOW
    })
    expect(summary.hasAccount).toBe(true)
    expect(summary.currentUsd).toBeCloseTo(80, 6) // 100 HIVE * 0.3 + 50 HBD
    expect(summary.currentLabel).toBe('$80.00')
    expect(summary.hasPortfolioHistory).toBe(true)
    expect(summary.hasPriceHistory).toBe(true)
    expect(summary.portfolioChange).toBeCloseTo(50, 6)
    expect(summary.portfolioChangeLabel).toBe('+50.00%')
    expect(summary.portfolioDirection).toBe('up')
    expect(summary.priceChange).toBeCloseTo(50, 6)
    expect(summary.priceSeries).toHaveLength(3)
    expect(summary.portfolioSeries).toEqual([100, 120, 150])
    expect(summary.trackedDays).toBe(10)
    expect(summary.lastPriceLabel).toBe('$0.30')
  })

  it('treats fewer than two local points as a new baseline', () => {
    const summary = portfolioTrendSummary({
      account: account(),
      prices: { hive: { usd: 0.3 }, hive_dollar: { usd: 1 } },
      snapshots: [{ at: NOW, usd: 80 }],
      now: NOW
    })
    expect(summary.isNew).toBe(true)
    expect(summary.hasPortfolioHistory).toBe(false)
    expect(summary.portfolioChange).toBeNull()
    expect(summary.portfolioChangeLabel).toBe('—')
  })

  it('keeps working without any price or snapshot history', () => {
    const summary = portfolioTrendSummary({ account: account(), now: NOW })
    expect(summary.currentUsd).toBe(0)
    expect(summary.hasPriceHistory).toBe(false)
    expect(summary.priceChangeLabel).toBe('—')
    expect(summary.trackedLabel).toBe('No local portfolio baseline yet')
  })

  it('labels a falling series', () => {
    const summary = portfolioTrendSummary({
      priceHistory: { points: [{ at: NOW - DAY_MS, usd: 0.4 }, { at: NOW, usd: 0.2 }] },
      now: NOW
    })
    expect(summary.priceChange).toBeCloseTo(-50, 6)
    expect(summary.priceChangeLabel).toBe('-50.00%')
    expect(summary.priceDirection).toBe('down')
  })
})

describe('portfolio snapshot series', () => {
  it('drops malformed rows and sorts by time', () => {
    const points = normalisePortfolioPoints([
      { at: 2, usd: 20 },
      { at: 1, usd: 10 },
      { at: 'nope', usd: 5 },
      { at: 3, usd: 0 },
      { at: 4, usd: 40 }
    ])
    expect(points).toEqual([{ at: 1, usd: 10 }, { at: 2, usd: 20 }, { at: 4, usd: 40 }])
  })

  it('replaces the last point inside the minimum gap', () => {
    const next = appendPortfolioSnapshot(
      [{ at: NOW - HOUR_MS, usd: 10 }],
      { at: NOW, usd: 12 },
      { minGapMs: 6 * HOUR_MS }
    )
    expect(next).toEqual([{ at: NOW, usd: 12 }])
  })

  it('appends a point after the minimum gap', () => {
    const next = appendPortfolioSnapshot(
      [{ at: NOW - 7 * HOUR_MS, usd: 10 }],
      { at: NOW, usd: 12 },
      { minGapMs: 6 * HOUR_MS }
    )
    expect(next).toEqual([
      { at: NOW - 7 * HOUR_MS, usd: 10 },
      { at: NOW, usd: 12 }
    ])
  })

  it('caps the series', () => {
    const points = []
    for (let index = 0; index < MAX_PORTFOLIO_POINTS + 10; index++) {
      points.push({ at: NOW - (MAX_PORTFOLIO_POINTS + 10 - index) * DAY_MS, usd: 1 + index })
    }
    const next = appendPortfolioSnapshot(points, { at: NOW, usd: 999 })
    expect(next).toHaveLength(MAX_PORTFOLIO_POINTS)
    expect(next[next.length - 1].usd).toBe(999)
  })

  it('ignores a snapshot without a usable value', () => {
    expect(appendPortfolioSnapshot([{ at: NOW, usd: 10 }], { at: NOW, usd: 0 })).toEqual([{ at: NOW, usd: 10 }])
  })
})

describe('price history normalisation', () => {
  it('clamps windows to the supported buckets', () => {
    expect(normaliseChartDays(7)).toBe(7)
    expect(normaliseChartDays(30)).toBe(30)
    expect(normaliseChartDays(90)).toBe(90)
    expect(normaliseChartDays(14)).toBe(30)
    expect(normaliseChartDays(120)).toBe(90)
    expect(normaliseChartDays()).toBe(7)
  })

  it('keeps usable CoinGecko rows only', () => {
    const points = normaliseMarketChart({
      prices: [
        [2000, 0.3],
        [1000, 0.2],
        [1500, '0.25'],
        [1700, 0],
        ['bad', 0.1],
        [1800]
      ]
    })
    expect(points).toEqual([
      { at: 1000, usd: 0.2 },
      { at: 1500, usd: 0.25 },
      { at: 2000, usd: 0.3 }
    ])
    expect(normaliseMarketChart(null)).toEqual([])
  })
})
