import { describe, expect, it } from 'vitest'
import { hiveEngineWatchlistSummary } from '../../src/services/hiveEngineWatchlist'

describe('Hive-Engine watchlist summary', () => {
  const metrics = [
    { symbol: 'DEC', lastPrice: '0.5123', volume: '12000.5', priceChangePercent: '3.25' },
    { symbol: 'LEO', lastPrice: '0.245', volume: '450', lastDayPrice: '0.25' }
  ]
  const balances = [
    { symbol: 'DEC', balance: '100.5' },
    { symbol: 'LEO', balance: '4' }
  ]

  it('joins metrics and balances in the requested order', () => {
    const summary = hiveEngineWatchlistSummary({
      metrics,
      balances,
      symbols: ['DEC', 'LEO', 'MISSING'],
      limit: 6
    })

    expect(summary.requestedSymbols).toEqual(['DEC', 'LEO', 'MISSING'])
    expect(summary.rows.map(row => row.symbol)).toEqual(['DEC', 'LEO', 'MISSING'])

    const [dec, leo, missing] = summary.rows
    expect(dec.priceHive).toBeCloseTo(0.5123, 6)
    expect(dec.change24h).toBeCloseTo(3.25, 6)
    expect(dec.volume).toBeCloseTo(12000.5, 6)
    expect(dec.balance).toBeCloseTo(100.5, 6)
    expect(dec.valueHive).toBeCloseTo(51.48615, 6)
    expect(dec.hasMarket).toBe(true)
    expect(dec.link).toBe('/token/DEC')

    expect(leo.priceHive).toBeCloseTo(0.245, 6)
    expect(leo.change24h).toBeCloseTo(-2, 6)
    expect(leo.valueHive).toBeCloseTo(0.98, 6)

    expect(missing.priceHive).toBeNull()
    expect(missing.change24h).toBeNull()
    expect(missing.volume).toBeNull()
    expect(missing.balance).toBeNull()
    expect(missing.valueHive).toBeNull()
    expect(missing.hasMarket).toBe(false)
    expect(missing.link).toBe('/token/MISSING')

    expect(summary.totalValueHive).toBeCloseTo(52.46615, 6)
    expect(summary.hasBalances).toBe(true)
    expect(summary.hasData).toBe(true)
  })

  it('shows a balance for a token without a market but leaves its price null', () => {
    const summary = hiveEngineWatchlistSummary({
      metrics: [],
      balances: [{ symbol: 'FOO', balance: '12' }],
      symbols: ['FOO']
    })

    const [row] = summary.rows
    expect(row.priceHive).toBeNull()
    expect(row.change24h).toBeNull()
    expect(row.volume).toBeNull()
    expect(row.balance).toBe(12)
    expect(row.valueHive).toBeNull()
    expect(row.hasMarket).toBe(false)
    expect(summary.totalValueHive).toBe(0)
    expect(summary.hasBalances).toBe(true)
    expect(summary.hasData).toBe(true)
  })

  it('dedupes, uppercases and caps the requested symbols', () => {
    const summary = hiveEngineWatchlistSummary({
      symbols: ['leo', 'DEC', ' leo ', 'LEO', 'SWAP.HIVE'],
      limit: 2
    })

    expect(summary.requestedSymbols).toEqual(['LEO', 'DEC', 'SWAP.HIVE'])
    expect(summary.rows.map(row => row.symbol)).toEqual(['LEO', 'DEC'])
  })

  it('keeps a zero balance as zero rather than missing', () => {
    const summary = hiveEngineWatchlistSummary({
      metrics: [{ symbol: 'DEC', lastPrice: '0.5' }],
      balances: [{ symbol: 'DEC', balance: '0' }],
      symbols: ['DEC']
    })

    const [row] = summary.rows
    expect(row.balance).toBe(0)
    expect(row.valueHive).toBe(0)
    expect(summary.totalValueHive).toBe(0)
    expect(summary.hasBalances).toBe(true)
    expect(summary.hasData).toBe(true)
  })

  it('handles empty data', () => {
    const summary = hiveEngineWatchlistSummary()

    expect(summary.rows).toEqual([])
    expect(summary.totalValueHive).toBe(0)
    expect(summary.hasBalances).toBe(false)
    expect(summary.hasData).toBe(false)
    expect(summary.requestedSymbols).toEqual([])
  })

  it('keeps requested rows even when neither market nor balance data arrives', () => {
    const summary = hiveEngineWatchlistSummary({ symbols: ['DEC'] })

    expect(summary.rows).toHaveLength(1)
    expect(summary.rows[0].symbol).toBe('DEC')
    expect(summary.rows[0].balance).toBeNull()
    expect(summary.hasData).toBe(false)
  })

  it('parses the 24h change from either a percent field or last-day price', () => {
    const summary = hiveEngineWatchlistSummary({
      symbols: ['A', 'B', 'C', 'D', 'E'],
      metrics: [
        { symbol: 'A', lastPrice: '1', priceChangePercent: '5.5%' },
        { symbol: 'B', lastPrice: '1', change24h: '-2.25' },
        { symbol: 'C', lastPrice: '110', lastDayPrice: '100' },
        { symbol: 'D', lastPrice: '1' },
        { symbol: 'E', lastPrice: '1', priceChangePercent: 'bad', lastDayPrice: '0' }
      ]
    })

    expect(summary.rows.map(row => row.change24h)).toEqual([5.5, -2.25, 10, null, null])
  })
})
