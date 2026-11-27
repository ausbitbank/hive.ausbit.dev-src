import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// prices.js imports the named `hive` export from ../services/hive.
const { getCurrentMedianHistoryPriceAsync } = vi.hoisted(() => ({
  getCurrentMedianHistoryPriceAsync: vi.fn()
}))

vi.mock('../../src/services/hive', () => ({
  hive: {
    api: { getCurrentMedianHistoryPriceAsync }
  }
}))

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd,btc&include_24hr_change=true'

function coinGeckoResponse (data) {
  return {
    ok: true,
    status: 200,
    json: async () => data
  }
}

describe('getHivePrices', () => {
  let originalFetch

  beforeEach(() => {
    // Each test gets a fresh module instance so the module-level cache is empty.
    vi.resetModules()
    getCurrentMedianHistoryPriceAsync.mockReset()
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('maps HIVE and HBD prices from a successful CoinGecko response', async () => {
    const coinGeckoData = {
      hive: { usd: 0.42, btc: 0.0000061, usd_24h_change: 2.5 },
      hive_dollar: { usd: 1.01, btc: 0.0000147, usd_24h_change: 0.1 }
    }
    globalThis.fetch.mockResolvedValue(coinGeckoResponse(coinGeckoData))

    const { getHivePrices } = await import('../../src/services/prices')
    const prices = await getHivePrices()

    expect(globalThis.fetch).toHaveBeenCalledWith(COINGECKO_URL, expect.objectContaining({
      signal: expect.any(AbortSignal)
    }))
    expect(prices).toEqual(coinGeckoData)
    expect(prices.hive.usd).toBe(0.42)
    expect(prices.hive_dollar.usd).toBe(1.01)
    expect(getCurrentMedianHistoryPriceAsync).not.toHaveBeenCalled()
  })

  it('falls back to the Hive median price when CoinGecko fails', async () => {
    globalThis.fetch.mockRejectedValue(new Error('network down'))
    getCurrentMedianHistoryPriceAsync.mockResolvedValue({
      base: '0.500 HBD',
      quote: '1.000 HIVE'
    })

    const { getHivePrices } = await import('../../src/services/prices')
    const prices = await getHivePrices()

    expect(getCurrentMedianHistoryPriceAsync).toHaveBeenCalledTimes(1)
    expect(prices.hive.usd).toBeCloseTo(0.5, 10)
    expect(prices.hive.btc).toBeNull()
    expect(prices.hive.usd_24h_change).toBeNull()
    // HBD is treated as a USD peg in the fallback.
    expect(prices.hive_dollar.usd).toBe(1)
  })

  it('falls back when CoinGecko returns a non-OK response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({})
    })
    getCurrentMedianHistoryPriceAsync.mockResolvedValue({
      base: '0.25 HBD',
      quote: '1.000 HIVE'
    })

    const { getHivePrices } = await import('../../src/services/prices')
    const prices = await getHivePrices()

    expect(prices.hive.usd).toBeCloseTo(0.25, 10)
  })

  it('returns the cached value for calls within the TTL', async () => {
    const coinGeckoData = {
      hive: { usd: 0.42, btc: null, usd_24h_change: null },
      hive_dollar: { usd: 1.01, btc: null, usd_24h_change: null }
    }
    globalThis.fetch.mockResolvedValue(coinGeckoResponse(coinGeckoData))

    const { getHivePrices } = await import('../../src/services/prices')
    const first = await getHivePrices()
    const second = await getHivePrices()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(getCurrentMedianHistoryPriceAsync).not.toHaveBeenCalled()
    expect(second).toBe(first)
    expect(second).toEqual(coinGeckoData)
  })

  it('shares one request between concurrent callers', async () => {
    const coinGeckoData = {
      hive: { usd: 0.42, btc: null, usd_24h_change: null },
      hive_dollar: { usd: 1.01, btc: null, usd_24h_change: null }
    }
    let resolveFetch
    globalThis.fetch.mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))

    const { getHivePrices, resetHivePricesCache } = await import('../../src/services/prices')
    resetHivePricesCache()
    const calls = [getHivePrices(), getHivePrices(), getHivePrices()]
    resolveFetch(coinGeckoResponse(coinGeckoData))

    const results = await Promise.all(calls)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(results.every(value => value === results[0])).toBe(true)
  })

  it('shares one market-chart request between concurrent callers', async () => {
    globalThis.fetch.mockResolvedValue(coinGeckoResponse({
      prices: [[1_700_000_000_000, 0.4], [1_700_086_400_000, 0.5]]
    }))

    const { getHivePriceHistory, resetPriceHistoryCache } = await import('../../src/services/prices')
    resetPriceHistoryCache()
    const [first, second, third] = await Promise.all([
      getHivePriceHistory({ days: 30 }),
      getHivePriceHistory({ days: 30 }),
      getHivePriceHistory({ days: 30 })
    ])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
    expect(second).toBe(third)
    expect(first.points).toHaveLength(2)
  })
})
