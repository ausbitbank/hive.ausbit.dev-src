import { describe, expect, it } from 'vitest'
import { hbdPegSummary } from '../../src/services/hbdPeg'

const GLOBAL_PROPS = {
  current_supply: '100000000.000 HIVE',
  current_hbd_supply: '25000000.000 HBD',
  hbd_interest_rate: 1500,
  hbd_print_rate: 5000
}

const MEDIAN = { base: '0.400 HBD', quote: '1.000 HIVE' }

function ticker (latest) {
  return { latest: String(latest) }
}

describe('hbdPegSummary', () => {
  it('reports a peg when the internal price matches the median', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })

    expect(summary.internalHiveUsd).toBeCloseTo(0.4)
    expect(summary.medianHiveUsd).toBeCloseTo(0.4)
    expect(summary.premiumPercent).toBeCloseTo(0)
    expect(summary.premiumDirection).toBe('par')
    expect(summary.premiumLabel).toBe('At par')
    expect(summary.hbdPriceUsd).toBeCloseTo(1)
    expect(summary.hbdLabel).toBe('$1.0000')
    expect(summary.hasData).toBe(true)
  })

  it('reports a premium when HBD buys more than the median implies', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.38'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })

    // 0.40 / 0.38 = 1.0526 HBD per $1, i.e. a 5.26% premium.
    expect(summary.hbdPriceUsd).toBeCloseTo(0.4 / 0.38, 5)
    expect(summary.premiumPercent).toBeCloseTo((0.4 / 0.38 - 1) * 100, 5)
    expect(summary.premiumDirection).toBe('premium')
    expect(summary.premiumLabel).toBe('+5.26% premium')
  })

  it('reports a discount when the internal price is above the median', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.42'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })

    expect(summary.premiumPercent).toBeCloseTo((0.4 / 0.42 - 1) * 100, 5)
    expect(summary.premiumDirection).toBe('discount')
    expect(summary.premiumLabel).toBe('-4.76% discount')
  })

  it('handles missing ticker and median data', () => {
    const summary = hbdPegSummary({ ticker: null, median: null, globalProps: null })

    expect(summary.internalHiveUsd).toBeNull()
    expect(summary.medianHiveUsd).toBeNull()
    expect(summary.premiumPercent).toBeNull()
    expect(summary.premiumDirection).toBe('unknown')
    expect(summary.hbdPriceUsd).toBeNull()
    expect(summary.internalLabel).toBe('—')
    expect(summary.hasData).toBe(false)
  })

  it('derives the savings APR and a 1,000 HBD projection', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS,
      amount: 1000
    })

    expect(summary.savingsApr).toBeCloseTo(15)
    expect(summary.projection).toEqual({
      amount: 1000,
      annualHbd: 150,
      monthlyHbd: 12.5,
      apr: 15
    })
  })

  it('keeps a zero amount valid', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS,
      amount: 0
    })

    expect(summary.projection.amount).toBe(0)
    expect(summary.projection.annualHbd).toBe(0)
    expect(summary.projection.monthlyHbd).toBe(0)
    expect(summary.projection.apr).toBe(15)
  })

  it('computes the debt ratio, status and haircut distance', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })

    // 25M HBD / (25M HBD + 40M HBD of HIVE) = 38.46%, above the 30% hard limit.
    expect(summary.debt.ratio).toBeCloseTo(38.4615, 3)
    expect(summary.debt.label).toBe('38.46%')
    expect(summary.debt.status.key).toBe('critical')
    expect(summary.debt.status.label).toBe('Above hard limit')
    expect(summary.debt.softLimit).toBe(20)
    expect(summary.debt.hardLimit).toBe(30)
    expect(summary.debt.distanceToSoft).toBe(0)
    expect(summary.debt.distanceToHard).toBe(0)
  })

  it('excludes the DHF treasury HBD from the debt ratio', () => {
    const base = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })
    const withTreasury = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS,
      treasuryHbd: '5000000.000 HBD'
    })

    expect(withTreasury.debt.ratio).toBeLessThan(base.debt.ratio)
    // 20M non-treasury HBD / (20M + 40M) = 33.33%, still above the hard limit
    // but materially lower than the 38.46% with the treasury included.
    expect(withTreasury.debt.ratio).toBeCloseTo(33.3333, 3)
  })

  it('reports a healthy debt ratio and the distance to the limits', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: { ...GLOBAL_PROPS, current_hbd_supply: '2000000.000 HBD' }
    })

    // 2M HBD / (2M HBD + 40M HBD of HIVE) = 4.76%.
    expect(summary.debt.ratio).toBeCloseTo(4.7619, 3)
    expect(summary.debt.status.key).toBe('ok')
    expect(summary.debt.distanceToSoft).toBeCloseTo(15.2381, 3)
    expect(summary.debt.distanceToHard).toBeCloseTo(25.2381, 3)
  })

  it('reports the print rate', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: GLOBAL_PROPS
    })

    expect(summary.printRate).toBeCloseTo(50)
    expect(summary.printRateLabel).toBe('50.00%')
  })

  it('leaves chain-dependent fields unavailable without global props', () => {
    const summary = hbdPegSummary({
      ticker: ticker('0.4'),
      median: MEDIAN,
      globalProps: null
    })

    expect(summary.savingsApr).toBeNull()
    expect(summary.debt.ratio).toBeNull()
    expect(summary.debt.status.key).toBe('unknown')
    expect(summary.debt.distanceToSoft).toBeNull()
    expect(summary.printRate).toBeNull()
    expect(summary.printRateLabel).toBe('—')
    expect(summary.projection.annualHbd).toBeNull()
    expect(summary.projection.monthlyHbd).toBeNull()
    expect(summary.hasData).toBe(true)
  })
})
