import { describe, expect, it } from 'vitest'
import { priceAlertSummary } from '../../src/services/priceAlert'

const PRICES = {
  hive: { usd: 0.5, btc: 0.0000123, usd_24h_change: 2.5 },
  hive_dollar: { usd: 1, btc: null }
}

describe('price alert summary', () => {
  it('marks an above target as reached with the overshoot distance', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: 0.4 })
    expect(summary.available).toBe(true)
    expect(summary.hasTarget).toBe(true)
    expect(summary.currentUsd).toBe(0.5)
    expect(summary.currentLabel).toBe('US$0.5000')
    expect(summary.targetLabel).toBe('US$0.4000')
    expect(summary.triggered).toBe(true)
    expect(summary.statusLabel).toBe('Target reached')
    expect(summary.distance).toBeCloseTo(0.1, 6)
    expect(summary.distancePercent).toBeCloseTo(25, 2)
    expect(summary.distanceLabel).toBe('US$0.1000')
  })

  it('reports the remaining distance for an above target', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: 0.75, direction: 'above' })
    expect(summary.triggered).toBe(false)
    expect(summary.statusLabel).toBe('US$0.2500 to go')
    expect(summary.distance).toBeCloseTo(0.25, 6)
    expect(summary.distancePercent).toBeCloseTo(33.33, 2)
  })

  it('marks a below target as reached when the price is at or under it', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: 0.6, direction: 'below' })
    expect(summary.direction).toBe('below')
    expect(summary.triggered).toBe(true)
    expect(summary.statusLabel).toBe('Target reached')
  })

  it('reports the remaining distance for a below target', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: 0.25, direction: 'below' })
    expect(summary.triggered).toBe(false)
    expect(summary.statusLabel).toBe('US$0.2500 to go')
    expect(summary.distance).toBeCloseTo(0.25, 6)
  })

  it('treats a missing target as unset and keeps the current price visible', () => {
    const summary = priceAlertSummary({ prices: PRICES })
    expect(summary.available).toBe(true)
    expect(summary.hasTarget).toBe(false)
    expect(summary.target).toBeNull()
    expect(summary.targetLabel).toBe('—')
    expect(summary.distance).toBeNull()
    expect(summary.distancePercent).toBeNull()
    expect(summary.triggered).toBe(false)
    expect(summary.statusLabel).toBe('No target set')
    expect(summary.currentLabel).toBe('US$0.5000')
  })

  it('treats a negative target as unset', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: -0.25 })
    expect(summary.hasTarget).toBe(false)
    expect(summary.target).toBeNull()
    expect(summary.triggered).toBe(false)
    expect(summary.statusLabel).toBe('No target set')
  })

  it('stays unavailable when prices are missing', () => {
    const summary = priceAlertSummary({ target: 0.5 })
    expect(summary.available).toBe(false)
    expect(summary.currentUsd).toBeNull()
    expect(summary.currentBtc).toBeNull()
    expect(summary.currentLabel).toBe('—')
    expect(summary.hasTarget).toBe(true)
    expect(summary.distance).toBeNull()
    expect(summary.distanceLabel).toBe('—')
    expect(summary.triggered).toBe(false)
    expect(summary.statusLabel).toBe('Price unavailable')
  })

  it('rejects non-finite prices and keeps BTC when it is available', () => {
    const withBtc = priceAlertSummary({ prices: PRICES, target: 0.5 })
    expect(withBtc.currentBtc).toBeCloseTo(0.0000123, 10)

    const summary = priceAlertSummary({ prices: { hive: { usd: 'nope', btc: Infinity } }, target: 0.5 })
    expect(summary.available).toBe(false)
    expect(summary.currentBtc).toBeNull()
    expect(summary.statusLabel).toBe('Price unavailable')
  })

  it('triggers on an exact match in both directions', () => {
    const above = priceAlertSummary({ prices: PRICES, target: 0.5, direction: 'above' })
    const below = priceAlertSummary({ prices: PRICES, target: 0.5, direction: 'below' })
    expect(above.triggered).toBe(true)
    expect(below.triggered).toBe(true)
    expect(above.distance).toBe(0)
    expect(above.distancePercent).toBe(0)
    expect(above.statusLabel).toBe('Target reached')
  })

  it('normalises an unknown direction to above', () => {
    const summary = priceAlertSummary({ prices: PRICES, target: 0.4, direction: 'sideways' })
    expect(summary.direction).toBe('above')
    expect(summary.triggered).toBe(true)
  })
})
