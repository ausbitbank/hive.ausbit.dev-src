import { describe, expect, it } from 'vitest'
import { hiveEnginePortfolio } from '../../src/services/hiveEnginePortfolio'

describe('hiveEnginePortfolio', () => {
  it('prices balances from market metrics and totals them in HIVE', () => {
    const result = hiveEnginePortfolio([
      { symbol: 'LEO', balance: '10.00000000' },
      { symbol: 'SWAP.HIVE', balance: '2.50000000' },
      { symbol: 'BEE', balance: '0.00000000' }
    ], [
      { symbol: 'LEO', lastPrice: '0.5', quote: 'SWAP.HIVE' },
      { symbol: 'BEE', lastPrice: '12', quote: 'SWAP.HIVE' }
    ])

    expect(result.tokens.map(token => token.symbol)).toEqual(['LEO', 'SWAP.HIVE'])
    expect(result.tokens[0]).toMatchObject({ balance: 10, priceHive: 0.5, valueHive: 5, usdPegged: false })
    expect(result.tokens[1]).toMatchObject({ priceHive: 1, valueHive: 2.5 })
    expect(result.totalHive).toBe(7.5)
  })

  it('flags HBD-quoted markets and keeps unpriced balances visible', () => {
    const result = hiveEnginePortfolio([
      { symbol: 'HBDTOKEN', balance: '3' },
      { symbol: 'OBSCURE', balance: '4' }
    ], [
      { symbol: 'HBDTOKEN', lastPrice: '1.02', quote: 'SWAP.HBD' }
    ])

    expect(result.tokens[0]).toMatchObject({ symbol: 'HBDTOKEN', usdPegged: true, valueHive: 3.06 })
    expect(result.tokens[1]).toMatchObject({ symbol: 'OBSCURE', priceHive: 0, valueHive: 0 })
  })

  it('handles empty input', () => {
    expect(hiveEnginePortfolio(null, null)).toEqual({ tokens: [], totalHive: 0 })
    expect(hiveEnginePortfolio([], [])).toEqual({ tokens: [], totalHive: 0 })
  })
})
