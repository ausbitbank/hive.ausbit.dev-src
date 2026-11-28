import { describe, expect, it } from 'vitest'
import {
  assetSymbol,
  buildCancelOrder,
  buildLimitOrder,
  conversionQuote,
  formatAmount,
  formatConversionRate,
  formatPrice,
  formatSignedPercent,
  hbdPeg,
  marketStats,
  normalizeOpenOrder,
  normalizeOpenOrders,
  normalizeOrderBook,
  normalizeTrade,
  normalizeTrades,
  parseAssetAmount,
  resolveChartInterval,
  resolveTradingPair,
  roundAmount,
  savingsApr,
  savingsProjection,
  validateOrder
} from '../../src/services/market'

const orderBook = {
  asks: [
    { real_price: '0.03895047', hive: 29499, hbd: 1149, created: '2026-11-17T14:36:39' },
    { real_price: '0.03893850', hive: 27659, hbd: 1077, created: '2026-11-17T14:58:09' }
  ],
  bids: [
    { real_price: '0.03880000', hive: 100000, hbd: 3880, created: '2026-11-17T13:02:27' },
    { real_price: '0.03880407', hive: 22008, hbd: 854, created: '2026-11-17T14:51:54' }
  ]
}

describe('market helpers', () => {
  it('parses assets and formats market values', () => {
    expect(parseAssetAmount('27.659 HIVE')).toBe(27.659)
    expect(parseAssetAmount(null)).toBe(0)
    expect(assetSymbol('1.078 HBD')).toBe('HBD')
    expect(assetSymbol('')).toBe('')
    expect(roundAmount(1.23456)).toBe(1.235)
    expect(formatAmount(1234.5)).toBe('1,234.500')
    expect(formatAmount(null)).toBe('—')
    expect(formatPrice(0.038805)).toBe('0.038805')
    expect(formatPrice(0.5)).toBe('0.500000')
    expect(formatPrice(1234.5)).toBe('1,234.50')
    expect(formatSignedPercent(2.4427)).toBe('+2.44%')
    expect(formatSignedPercent(-2.4427)).toBe('-2.44%')
  })

  it('resolves supported pairs and intervals with safe defaults', () => {
    expect(resolveTradingPair('BINANCE:HIVEBTC')).toBe('BINANCE:HIVEBTC')
    expect(resolveTradingPair('NOPE')).toBe('BINANCE:HIVEUSDT')
    expect(resolveChartInterval('D')).toBe('D')
    expect(resolveChartInterval('999')).toBe('240')
  })

  it('normalises the order book and accumulates depth', () => {
    const book = normalizeOrderBook(orderBook)
    expect(book.asks).toHaveLength(2)
    expect(book.asks[0].price).toBeCloseTo(0.0389385, 7)
    expect(book.asks[0].hive).toBeCloseTo(27.659, 6)
    expect(book.asks[0].hbd).toBeCloseTo(1.077, 6)
    expect(book.asks[1].cumulativeHive).toBeCloseTo(57.158, 6)
    expect(book.asks[1].cumulativeHbd).toBeCloseTo(2.226, 6)

    // Bids are sorted best-first and skip malformed rows.
    expect(book.bids[0].price).toBeCloseTo(0.03880407, 8)
    expect(book.bids[1].price).toBeCloseTo(0.0388, 8)
    expect(book.bids[1].cumulativeHive).toBeCloseTo(122.008, 6)
  })

  it('computes stats, spread and 24 hour volume', () => {
    const book = normalizeOrderBook(orderBook)
    const stats = marketStats({
      latest: '0.03800000',
      lowest_ask: '0.03893850',
      highest_bid: '0.03880407',
      percent_change: '-2.44273256',
      hive_volume: '87944.524 HIVE',
      hbd_volume: '3424.020 HBD'
    }, book)

    expect(stats.latest).toBe(0.038)
    expect(stats.change).toBeCloseTo(-2.4427, 4)
    expect(stats.bestAsk).toBeCloseTo(0.0389385, 7)
    expect(stats.bestBid).toBeCloseTo(0.0388041, 7)
    expect(stats.mid).toBeCloseTo(0.0388713, 7)
    expect(stats.spread).toBeCloseTo(0.0001344, 7)
    expect(stats.spreadPercent).toBeGreaterThan(0)
    expect(stats.hiveVolume).toBe(87944.524)
    expect(stats.hbdVolume).toBe(3424.02)
  })

  it('normalises both sides of a trade relative to HIVE', () => {
    const sell = normalizeTrade({
      date: '2026-11-17T14:59:06',
      current_pays: '61.270 HIVE',
      open_pays: '2.377 HBD',
      taker: 'yeni82',
      maker: 'coquicoin'
    })
    expect(sell.side).toBe('sell')
    expect(sell.hive).toBe(61.27)
    expect(sell.hbd).toBe(2.377)
    expect(sell.price).toBeCloseTo(0.0387955, 7)

    const buy = normalizeTrade({
      date: '2026-11-17T14:49:12',
      current_pays: '1.078 HBD',
      open_pays: '27.659 HIVE',
      taker: 'buyer',
      maker: 'seller'
    })
    expect(buy.side).toBe('buy')
    expect(buy.price).toBeCloseTo(1.078 / 27.659, 8)

    expect(normalizeTrade({ current_pays: '1 HIVE', open_pays: '1 HIVE' })).toBeNull()
    expect(normalizeTrades([{
      current_pays: '1.000 HIVE',
      open_pays: '0.040 HBD',
      taker: 'a',
      maker: 'b',
      date: '2026-11-17T14:00:00'
    }])).toHaveLength(1)
  })

  it('normalises open orders in both directions', () => {
    const sell = normalizeOpenOrder({
      id: 1,
      orderid: 611116525,
      created: '2026-11-17T14:57:54',
      expiration: '2026-11-24T14:57:48',
      for_sale: 27659,
      sell_price: { base: '27.659 HIVE', quote: '1.078 HBD' }
    })
    expect(sell.side).toBe('sell')
    expect(sell.asset).toBe('HIVE')
    expect(sell.amount).toBe(27.659)
    expect(sell.price).toBeCloseTo(1.078 / 27.659, 8)
    expect(sell.totalHbd).toBe(1.078)
    expect(sell.hiveAmount).toBe(27.659)

    const buy = normalizeOpenOrder({
      id: 2,
      orderid: 3,
      created: '2026-11-17T14:00:00',
      sell_price: { base: '5.000 HBD', quote: '128.205 HIVE' }
    })
    expect(buy.side).toBe('buy')
    expect(buy.asset).toBe('HBD')
    expect(buy.amount).toBe(5)
    expect(buy.receive).toBe(128.205)
    expect(buy.price).toBeCloseTo(5 / 128.205, 8)
    expect(buy.totalHbd).toBe(5)
    expect(buy.hiveAmount).toBe(128.205)

    expect(normalizeOpenOrder(null)).toBeNull()
    expect(normalizeOpenOrders([
      {
        id: 2,
        orderid: 3,
        created: '2026-11-17T14:00:00',
        sell_price: { base: '5.000 HBD', quote: '128.205 HIVE' }
      },
      {
        id: 1,
        orderid: 611116525,
        created: '2026-11-17T14:57:54',
        sell_price: { base: '27.659 HIVE', quote: '1.078 HBD' }
      }
    ]).map(order => order.id)).toEqual([2, 1])
  })

  it('validates price, amount and available balances', () => {
    expect(validateOrder({
      side: 'buy',
      price: 0.04,
      amount: 100,
      total: 4,
      balanceHbd: 10,
      balanceHive: 0
    }).valid).toBe(true)

    const overBudget = validateOrder({
      side: 'buy',
      price: 0.04,
      amount: 100,
      total: 4,
      balanceHbd: 1
    })
    expect(overBudget.valid).toBe(false)
    expect(overBudget.errors).toContain('Not enough HBD for this buy order.')

    const noHive = validateOrder({
      side: 'sell',
      price: 0.04,
      amount: 100,
      total: 4,
      balanceHive: 10
    })
    expect(noHive.errors).toContain('Not enough HIVE for this sell order.')

    const loggedOut = validateOrder({ side: 'buy', price: 1, amount: 1, total: 1, loggedIn: false })
    expect(loggedOut.errors[0]).toBe('Log in to trade.')
    expect(validateOrder({ side: 'nope', price: 0, amount: 0, total: 0 }).valid).toBe(false)
  })

  it('builds active-authority limit order and cancel queue entries', () => {
    const now = Date.UTC(2026, 10, 18, 12, 0, 0)
    const buy = buildLimitOrder({
      owner: 'alice',
      side: 'buy',
      price: 0.04,
      amount: 100,
      total: 4,
      now
    })
    expect(buy[0]).toBe('alice')
    expect(buy[1]).toBe('active')
    expect(buy[2][0]).toBe('limit_order_create')
    expect(buy[2][1]).toMatchObject({
      owner: 'alice',
      amount_to_sell: '4.000 HBD',
      min_to_receive: '100.000 HIVE',
      fill_or_kill: false
    })
    expect(Number.isInteger(buy[2][1].orderid)).toBe(true)
    expect(buy[2][1].orderid).toBeGreaterThan(0)
    expect(buy[2][1].expiration).toBe('2026-12-15T12:00:00')

    const sell = buildLimitOrder({
      owner: 'alice',
      side: 'sell',
      price: 0.04,
      amount: 100,
      total: 4,
      fillOrKill: true,
      now
    })
    expect(sell[2][1]).toMatchObject({
      amount_to_sell: '100.000 HIVE',
      min_to_receive: '4.000 HBD',
      fill_or_kill: true
    })

    expect(buildCancelOrder('alice', 123)).toEqual([
      'alice',
      'active',
      ['limit_order_cancel', { owner: 'alice', orderid: 123 }]
    ])
  })

  it('gives same-second orders distinct ids and rounds amounts down', () => {
    const now = Date.UTC(2026, 10, 18, 12, 0, 0)
    const first = buildLimitOrder({ owner: 'alice', side: 'sell', price: 0.04, amount: 1.2349, total: 0.049396, now })
    const second = buildLimitOrder({ owner: 'alice', side: 'sell', price: 0.04, amount: 1.2349, total: 0.049396, now })
    expect(first[2][1].orderid).not.toBe(second[2][1].orderid)
    expect(first[2][1].amount_to_sell).toBe('1.234 HIVE')
    expect(first[2][1].min_to_receive).toBe('0.049 HBD')
  })

  it('reads savings APR and projects interest', () => {
    expect(savingsApr({ hbd_interest_rate: 1000 })).toBe(10)
    expect(savingsApr({ empty: true })).toBeNull()
    expect(savingsApr(null)).toBeNull()
    expect(savingsProjection({ apr: 10, balance: 1000 })).toEqual({ annual: 100, monthly: 100 / 12 })
    expect(savingsProjection({ apr: null, balance: 1000 })).toEqual({ annual: null, monthly: null })
  })

  it('computes the HBD peg from external, internal and median prices', () => {
    const peg = hbdPeg({
      hbdUsd: 1.01,
      hiveUsd: 0.5,
      internalHivePrice: 0.5,
      medianHivePrice: 0.49
    })
    expect(peg.external.price).toBe(1.01)
    expect(peg.external.premium).toBeCloseTo(1, 8)
    expect(peg.external.label).toBe('Small premium')
    expect(peg.internal.price).toBeCloseTo(1, 8)
    expect(peg.internal.label).toBe('At peg')
    expect(peg.median.premium).toBeCloseTo((1 / 0.98 - 1) * 100, 8)
    expect(peg.primary).toBe(peg.external)

    const discount = hbdPeg({ hbdUsd: 0.95 })
    expect(discount.primary.label).toBe('Discount')
    expect(discount.primary.color).toBe('red')

    expect(hbdPeg({}).primary).toBeNull()
  })

  it('quotes conversions in both directions', () => {
    const hiveToHbd = conversionQuote({ amount: 1000, direction: 'hive-to-hbd', price: 0.04 })
    expect(hiveToHbd.output).toBe(40)
    expect(hiveToHbd.valid).toBe(true)

    const hbdToHive = conversionQuote({ amount: 40, direction: 'hbd-to-hive', price: 0.04 })
    expect(hbdToHive.output).toBe(1000)
    expect(hbdToHive.inverse).toBe(25)

    expect(conversionQuote({ amount: 10, direction: 'hive-to-hbd', price: 0 }).valid).toBe(false)
    expect(formatConversionRate('hive-to-hbd', 0.04)).toBe('1 HIVE = 0.040000 HBD')
    expect(formatConversionRate('hbd-to-hive', 0.04)).toBe('1 HBD = 25.0000 HIVE')
    expect(formatConversionRate('hive-to-hbd', null)).toBe('—')
  })
})
