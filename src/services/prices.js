import { hive } from './hive'

const CACHE_TTL = 60 * 1000
let cache = null
let inflight = null

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
  // Dashboard widgets mount together and each asks for prices. Share one
  // request instead of hitting CoinGecko (and its per-IP rate limit) N times.
  if (!inflight) {
    inflight = (async () => {
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
    })().finally(() => { inflight = null })
  }
  return inflight
}

/** Test helper: drop the memoised price cache. */
export function resetHivePricesCache () {
  cache = null
  inflight = null
}

const CHART_TTL = 10 * 60 * 1000
const CHART_DAYS = [7, 30, 90]
const chartCache = new Map()

/** Clamp a requested history window to a CoinGecko daily bucket. */
export function normaliseChartDays (days) {
  const number = Number(days)
  if (CHART_DAYS.includes(number)) return number
  return number > 30 ? 90 : number > 7 ? 30 : 7
}

/**
 * Normalise CoinGecko's `market_chart` response into `{ at, usd }` points.
 * Bad rows are dropped rather than interpolated; callers can decide whether
 * an empty series is still useful.
 */
export function normaliseMarketChart (payload) {
  const rows = Array.isArray(payload?.prices) ? payload.prices : []
  const points = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue
    const at = Number(row[0])
    const usd = Number(row[1])
    if (!Number.isFinite(at) || at <= 0 || !Number.isFinite(usd) || usd <= 0) continue
    points.push({ at, usd })
  }
  return points.sort((a, b) => a.at - b.at)
}

/**
 * Daily HIVE price history for the portfolio-trend widget. Cached per window
 * for ten minutes so switching dashboards does not re-hit CoinGecko. Throws on
 * failure; the caller keeps its local snapshots and shows a degraded state.
 */
export async function getHivePriceHistory ({ days = 30, force = false } = {}) {
  const windowDays = normaliseChartDays(days)
  const cached = chartCache.get(windowDays)
  if (!force && cached && Date.now() - cached.at < CHART_TTL) return cached.value

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/hive/market_chart?vs_currency=usd&days=' +
        encodeURIComponent(windowDays),
      { signal: controller.signal }
    )
    if (!res.ok) throw new Error('CoinGecko HTTP ' + res.status)
    const points = normaliseMarketChart(await res.json())
    if (points.length < 2) throw new Error('CoinGecko returned no usable history')
    const value = { days: windowDays, points, source: 'coingecko' }
    chartCache.set(windowDays, { at: Date.now(), value })
    return value
  } finally {
    clearTimeout(timeout)
  }
}

/** Test helper: drop the memoised chart cache. */
export function resetPriceHistoryCache () {
  chartCache.clear()
}
