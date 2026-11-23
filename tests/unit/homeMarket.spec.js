import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_MARKET_PREFS,
  HOME_MARKET_CURRENCIES,
  HOME_MARKET_FX_URL,
  HOME_MARKET_PREFS_KEY,
  MAX_HOME_MARKET_COINS,
  buildMarketUrl,
  convertCoinPrices,
  currencySymbol,
  defaultHomeMarketPrefs,
  forexRateFromCoinGecko,
  homeMarketSnapshotKey,
  isForexCurrency,
  loadForexRate,
  loadHomeMarketPrefs,
  normaliseCoinIds,
  orderCoinIds,
  resetForexCache,
  saveHomeMarketPrefs,
  satsPerHiveFromCoins,
  searchCoins,
  toggleCoinId
} from '../../src/services/homeMarket'

function memoryStorage (initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: key => { data.delete(key) }
  }
}

describe('home market preferences', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('defaults to the four Hive-era coins quoted in USD', () => {
    expect(defaultHomeMarketPrefs()).toEqual(DEFAULT_HOME_MARKET_PREFS)
    expect(loadHomeMarketPrefs(storage)).toEqual(DEFAULT_HOME_MARKET_PREFS)
  })

  it('round-trips saved preferences and keeps Hive assets first', () => {
    saveHomeMarketPrefs({ coinIds: ['bitcoin', 'hive', 'solana'], currency: 'eur' }, storage)
    const loaded = loadHomeMarketPrefs(storage)
    expect(loaded).toEqual({ coinIds: ['hive', 'bitcoin', 'solana'], currency: 'eur' })
    expect(JSON.parse(storage.getItem(HOME_MARKET_PREFS_KEY)).currency).toBe('eur')
  })

  it('falls back to defaults for corrupt or unsupported values', () => {
    storage.setItem(HOME_MARKET_PREFS_KEY, 'not json')
    expect(loadHomeMarketPrefs(storage)).toEqual(DEFAULT_HOME_MARKET_PREFS)

    storage.setItem(HOME_MARKET_PREFS_KEY, JSON.stringify({ coinIds: [], currency: 'xyz' }))
    expect(loadHomeMarketPrefs(storage)).toEqual(DEFAULT_HOME_MARKET_PREFS)
  })

  it('de-duplicates, lowercases and caps the coin list', () => {
    const ids = ['HIVE', 'hive', ' ', 'bitcoin', 'eth', 'monero', 'litecoin', 'solana', 'cardano', 'polkadot']
    const normalised = normaliseCoinIds(ids)
    expect(normalised.length).toBe(MAX_HOME_MARKET_COINS)
    expect(normalised[0]).toBe('hive')
    expect(normalised.filter(id => id === 'hive').length).toBe(1)
  })

  it('toggles coins but never removes the last one', () => {
    expect(toggleCoinId(['hive', 'bitcoin'], 'bitcoin')).toEqual(['hive'])
    expect(toggleCoinId(['hive'], 'hive')).toEqual(['hive'])
    expect(toggleCoinId(['hive'], 'monero')).toEqual(['hive', 'monero'])
    expect(orderCoinIds(['solana', 'hive_dollar', 'hive'])).toEqual(['hive', 'hive_dollar', 'solana'])
  })

  it('accepts any coin id, not just the quick picks', () => {
    const saved = toggleCoinId(['hive'], 'some-obscure-coin')
    expect(saved).toEqual(['hive', 'some-obscure-coin'])
    saveHomeMarketPrefs({ coinIds: ['hive', 'pepe', 'bonk'], currency: 'usd' }, storage)
    expect(loadHomeMarketPrefs(storage).coinIds).toEqual(['hive', 'pepe', 'bonk'])
  })

  it('searches the full CoinGecko catalogue and ranks by market cap', async () => {
    const calls = []
    globalThis.fetch = url => {
      calls.push(url)
      return Promise.resolve({
        ok: true,
        json: async () => ({
          coins: [
            { id: 'low-rank', name: 'Low Rank', symbol: 'low', market_cap_rank: 900 },
            { id: 'cardano', name: 'Cardano', symbol: 'ada', market_cap_rank: 18 },
            { id: 'no-rank', name: 'No Rank', symbol: 'nr', market_cap_rank: null }
          ]
        })
      })
    }
    try {
      const results = await searchCoins('card')
      expect(calls[0]).toContain('api.coingecko.com/api/v3/search?query=card')
      expect(results.map(coin => coin.id)).toEqual(['cardano', 'low-rank', 'no-rank'])
      expect(results[0]).toEqual({ id: 'cardano', name: 'Cardano', symbol: 'ADA', rank: 18 })
      expect(await searchCoins('c')).toEqual([])
      expect(calls.length).toBe(1)
    } finally {
      delete globalThis.fetch
    }
  })

  it('builds a CoinGecko URL and snapshot key from the preferences', () => {
    const prefs = { coinIds: ['bitcoin', 'hive'], currency: 'gbp' }
    const url = buildMarketUrl(prefs)
    expect(url).toContain('vs_currency=gbp')
    expect(url).toContain('ids=hive%2Cbitcoin')
    expect(url).toContain('sparkline=true')
    expect(homeMarketSnapshotKey(prefs)).toBe('home:market:hive,bitcoin:gbp')
    expect(currencySymbol('gbp')).toBe('£')
    expect(currencySymbol('aud')).toBe('A$')
    expect(currencySymbol('unknown')).toBe('$')
  })
})

describe('home market forex conversion', () => {
  beforeEach(() => {
    resetForexCache()
  })

  it('gives every currency a display label and symbol', () => {
    const ids = HOME_MARKET_CURRENCIES.map(entry => entry.id)
    expect(ids).toEqual(['usd', 'aud', 'eur', 'gbp', 'btc', 'eth'])
    for (const entry of HOME_MARKET_CURRENCIES) {
      expect(typeof entry.label).toBe('string')
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.label).not.toBe('undefined')
      expect(entry.symbol.length).toBeGreaterThan(0)
    }
  })

  it('recognises AUD and requests USD prices for it', () => {
    expect(isForexCurrency('aud')).toBe(true)
    expect(isForexCurrency('gbp')).toBe(false)
    expect(buildMarketUrl({ coinIds: ['hive'], currency: 'aud' })).toContain('vs_currency=usd')
    expect(buildMarketUrl({ coinIds: ['hive'], currency: 'eur' })).toContain('vs_currency=eur')
  })

  it('derives AUD per USD from the USD pivot entry', () => {
    // Real shape: the `btc` entry is the unit (value 1), so USD is the pivot.
    const payload = { rates: { btc: { value: 1 }, usd: { value: 63294.297 }, aud: { value: 94686.243 } } }
    expect(forexRateFromCoinGecko(payload, 'aud')).toBeCloseTo(1.4959, 3)
    expect(forexRateFromCoinGecko({ rates: {} }, 'aud')).toBeNull()
    expect(forexRateFromCoinGecko(null)).toBeNull()
  })

  it('never produces a nonsense rate when only the btc unit is present', () => {
    const payload = { rates: { btc: { value: 1 }, aud: { value: 94686.243 } } }
    expect(forexRateFromCoinGecko(payload, 'aud')).toBeNull()
  })

  it('converts coin prices and keeps percentage change untouched', () => {
    const coins = [{ id: 'hive', current_price: 0.2, market_cap: 100, total_volume: 10, price_change_percentage_24h: -2.4 }]
    const [converted] = convertCoinPrices(coins, 1.5)
    expect(converted.current_price).toBeCloseTo(0.3, 10)
    expect(converted.market_cap).toBeCloseTo(150, 10)
    expect(converted.total_volume).toBeCloseTo(15, 10)
    expect(converted.price_change_percentage_24h).toBe(-2.4)
    expect(coins[0].current_price).toBe(0.2)
    expect(convertCoinPrices(coins, null)).toBe(coins)
  })

  it('caches forex rates within the TTL', async () => {
    const calls = []
    let payload = { rates: { btc: { value: 1 }, usd: { value: 100 }, aud: { value: 150 } } }
    globalThis.fetch = url => {
      calls.push(url)
      return Promise.resolve({ ok: true, json: async () => payload })
    }
    try {
      const first = await loadForexRate('aud', { now: 1000 })
      payload = { rates: { btc: { value: 1 }, usd: { value: 100 }, aud: { value: 200 } } }
      const second = await loadForexRate('aud', { now: 1000 + 1000 })
      const third = await loadForexRate('aud', { now: 1000 + 60 * 60 * 1000 })
      expect(first).toBe(1.5)
      expect(second).toBe(1.5)
      expect(third).toBe(2)
      expect(calls).toEqual([HOME_MARKET_FX_URL, HOME_MARKET_FX_URL])
    } finally {
      delete globalThis.fetch
    }
  })
})

describe('sats per HIVE from market rows', () => {
  it('uses an explicit BTC price when present', () => {
    expect(satsPerHiveFromCoins([
      { id: 'hive', current_price: 0.31, price_btc: 0.0000041 },
      { id: 'bitcoin', current_price: 75000 }
    ])).toBeCloseTo(410)
  })

  it('derives the ratio from same-currency rows', () => {
    expect(satsPerHiveFromCoins([
      { id: 'hive', current_price: 0.3 },
      { id: 'bitcoin', current_price: 60000 }
    ])).toBeCloseTo(500)
  })

  it('returns null when either row is missing or unusable', () => {
    expect(satsPerHiveFromCoins([{ id: 'hive', current_price: 0.3 }])).toBeNull()
    expect(satsPerHiveFromCoins([
      { id: 'hive', current_price: 0 },
      { id: 'bitcoin', current_price: 60000 }
    ])).toBeNull()
    expect(satsPerHiveFromCoins(null)).toBeNull()
  })
})
