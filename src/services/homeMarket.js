// Preferences and helpers for the home dashboard "Coin prices" widget.
//
// Coins and the quote currency live in their own localStorage entry so they
// survive settings saves and never touch account data.

export const HOME_MARKET_PREFS_KEY = 'homeMarketPrefs'
export const MAX_HOME_MARKET_COINS = 8
export const MIN_HOME_MARKET_COINS = 1

export const DEFAULT_HOME_MARKET_PREFS = {
  coinIds: ['hive', 'hive_dollar', 'bitcoin', 'ethereum'],
  currency: 'usd'
}

/** Coin ids offered in the customise picker. `hive` and `hive_dollar` are always kept. */
export const HOME_MARKET_COIN_CHOICES = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'hive', symbol: 'HIVE', name: 'Hive' },
  { id: 'hive_dollar', symbol: 'HBD', name: 'Hive Dollar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' }
]

/** Currencies with no native CoinGecko market; prices are quoted in USD then
 * converted with a forex rate so the widget never depends on a thin market. */
export const HOME_MARKET_FOREX_CURRENCY_IDS = ['aud']

/** Supported quote currencies with their display symbols. */
export const HOME_MARKET_CURRENCIES = [
  { id: 'usd', label: 'US Dollar', symbol: '$' },
  { id: 'aud', label: 'Australian Dollar', symbol: 'A$' },
  { id: 'eur', label: 'Euro', symbol: '€' },
  { id: 'gbp', label: 'British Pound', symbol: '£' },
  { id: 'btc', label: 'Bitcoin', symbol: '₿' },
  { id: 'eth', label: 'Ether', symbol: 'Ξ' }
]

export const HOME_MARKET_FX_URL = 'https://api.coingecko.com/api/v3/exchange_rates'
export const HOME_MARKET_FOREX_TTL_MS = 15 * 60 * 1000

export function isForexCurrency (currency) {
  return HOME_MARKET_FOREX_CURRENCY_IDS.includes(currency)
}

/** Convert an AUD-per-BTC / USD-per-BTC pair into AUD per USD. */
export function forexRateFromCoinGecko (payload, currency = 'aud') {
  const btc = Number(payload?.rates?.btc?.value)
  const target = Number(payload?.rates?.[currency]?.value)
  if (!Number.isFinite(btc) || btc <= 0 || !Number.isFinite(target) || target <= 0) return null
  return target / btc
}

let forexCache = null

/** Fetch the live forex rate (units of `currency` per USD), cached briefly. */
export async function loadForexRate (currency = 'aud', { now = Date.now(), ttlMs = HOME_MARKET_FOREX_TTL_MS } = {}) {
  if (forexCache && forexCache.currency === currency && now - forexCache.at < ttlMs) {
    return forexCache.rate
  }
  const response = await fetch(HOME_MARKET_FX_URL)
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const rate = forexRateFromCoinGecko(await response.json(), currency)
  if (!rate) throw new Error('Missing forex rate for ' + currency)
  forexCache = { currency, rate, at: now }
  return rate
}

/** Test helper: drop the memoised forex rate. */
export function resetForexCache () {
  forexCache = null
}

/** Apply a forex rate to a USD market row, leaving the USD change intact. */
export function convertCoinPrices (coins, rate) {
  if (!Number.isFinite(rate) || rate <= 0) return Array.isArray(coins) ? coins : []
  return (Array.isArray(coins) ? coins : []).map(coin => ({
    ...coin,
    current_price: Number.isFinite(Number(coin.current_price)) ? Number(coin.current_price) * rate : coin.current_price,
    market_cap: Number.isFinite(Number(coin.market_cap)) ? Number(coin.market_cap) * rate : coin.market_cap,
    total_volume: Number.isFinite(Number(coin.total_volume)) ? Number(coin.total_volume) * rate : coin.total_volume
  }))
}

const PREFERRED_ORDER = ['hive', 'hive_dollar']

export function defaultHomeMarketPrefs () {
  return {
    coinIds: [...DEFAULT_HOME_MARKET_PREFS.coinIds],
    currency: DEFAULT_HOME_MARKET_PREFS.currency
  }
}

export function isSupportedCurrency (currency) {
  return HOME_MARKET_CURRENCIES.some(entry => entry.id === currency)
}

export function currencySymbol (currency) {
  const match = HOME_MARKET_CURRENCIES.find(entry => entry.id === currency)
  return match ? match.symbol : '$'
}

/** Normalise arbitrary input into a valid, de-duplicated coin id list. */
export function normaliseCoinIds (coinIds) {
  const seen = new Set()
  const result = []
  for (const id of Array.isArray(coinIds) ? coinIds : []) {
    const value = String(id || '').trim().toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
    if (result.length >= MAX_HOME_MARKET_COINS) break
  }
  if (result.length < MIN_HOME_MARKET_COINS) return defaultHomeMarketPrefs().coinIds
  return result
}

/** Always keep Hive assets first, then the user's chosen order. */
export function orderCoinIds (coinIds) {
  const list = normaliseCoinIds(coinIds)
  const preferred = PREFERRED_ORDER.filter(id => list.includes(id))
  const rest = list.filter(id => !PREFERRED_ORDER.includes(id))
  return preferred.concat(rest)
}

export function buildMarketUrl ({ coinIds, currency } = {}) {
  const ids = orderCoinIds(coinIds).join(',')
  const requested = isSupportedCurrency(currency) ? currency : DEFAULT_HOME_MARKET_PREFS.currency
  // Forex-only currencies have no reliable native market, so convert from USD.
  const vs = isForexCurrency(requested) ? 'usd' : requested
  return 'https://api.coingecko.com/api/v3/coins/markets' +
    '?vs_currency=' + encodeURIComponent(vs) +
    '&ids=' + encodeURIComponent(ids) +
    '&order=market_cap_desc' +
    '&per_page=' + MAX_HOME_MARKET_COINS +
    '&page=1' +
    '&sparkline=true' +
    '&price_change_percentage=24h'
}

/** Snapshot keys must change with the settings so stale mixes never show. */
export function homeMarketSnapshotKey ({ coinIds, currency } = {}) {
  return 'home:market:' + orderCoinIds(coinIds).join(',') + ':' +
    (isSupportedCurrency(currency) ? currency : DEFAULT_HOME_MARKET_PREFS.currency)
}

function getStorage (storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or a blocked storage implementation.
  }
  return null
}

export function loadHomeMarketPrefs (storage) {
  const target = getStorage(storage)
  if (!target) return defaultHomeMarketPrefs()
  try {
    const parsed = JSON.parse(target.getItem(HOME_MARKET_PREFS_KEY) || '{}')
    return {
      coinIds: orderCoinIds(parsed.coinIds),
      currency: isSupportedCurrency(parsed.currency)
        ? parsed.currency
        : DEFAULT_HOME_MARKET_PREFS.currency
    }
  } catch {
    return defaultHomeMarketPrefs()
  }
}

export function saveHomeMarketPrefs (prefs, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.setItem(HOME_MARKET_PREFS_KEY, JSON.stringify({
      coinIds: orderCoinIds(prefs?.coinIds),
      currency: isSupportedCurrency(prefs?.currency)
        ? prefs.currency
        : DEFAULT_HOME_MARKET_PREFS.currency
    }))
    return true
  } catch {
    return false
  }
}

/** Toggle a coin while enforcing at least one selection. */
export function toggleCoinId (coinIds, id) {
  const list = normaliseCoinIds(coinIds)
  if (list.includes(id)) {
    if (list.length <= MIN_HOME_MARKET_COINS) return list
    return orderCoinIds(list.filter(entry => entry !== id))
  }
  return orderCoinIds(list.concat(id))
}
