import { hive } from './hive'

const CACHE_TTL = 60 * 1000
let cache = null

async function fromCoinGecko () {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd,btc&include_24hr_change=true',
      { signal: controller.signal }
    )
    if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status)
    const data = await res.json()
    if (!data?.hive?.usd) throw new Error('CoinGecko returned no HIVE price')
    return data
  } finally {
    clearTimeout(timeout)
  }
}

async function fromHiveMedian () {
  // HBD is pegged to USD, so median price (HBD per HIVE) is a usable USD price.
  const median = await hive.api.getCurrentMedianHistoryPriceAsync()
  const price = parseFloat(median.base) / parseFloat(median.quote)
  return {
    hive: { usd: price, btc: null, usd_24h_change: null },
    hive_dollar: { usd: 1, btc: null, usd_24h_change: null }
  }
}

export async function getHivePrices ({ maxAge = CACHE_TTL } = {}) {
  if (cache && Date.now() - cache.at < maxAge) return cache.value

  let value
  let source
  try {
    value = await fromCoinGecko()
    source = 'coingecko'
  } catch {
    value = await fromHiveMedian()
    source = 'hive-median'
  }

  cache = { at: Date.now(), value, source }
  return value
}
