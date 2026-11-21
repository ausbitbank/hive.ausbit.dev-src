// Pure helpers for the market pages and the Hive internal market.
//
// The internal market always quotes HIVE in HBD: `real_price` and the ticker
// values are HBD per 1 HIVE. Order-book and open-order payloads are converted
// into one shape here so components never have to parse chain strings.

export const MARKET_ASSET = 'HIVE'
export const MARKET_QUOTE = 'HBD'
export const MARKET_FEE_PERCENT = 0
export const ORDER_EXPIRY_DAYS = 27

export const TRADING_PAIRS = [
  { value: 'BINANCE:HIVEUSDT', label: 'HIVE / USDT', venue: 'Binance' },
  { value: 'BINANCE:HIVEBTC', label: 'HIVE / BTC', venue: 'Binance' },
  { value: 'UPBIT:HIVEBTC', label: 'HIVE / BTC', venue: 'Upbit' },
  { value: 'BITHUMB:HIVEKRW', label: 'HIVE / KRW', venue: 'Bithumb' }
]

export const CHART_INTERVALS = [
  { value: '60', label: '1H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' }
]

export const DEFAULT_TRADING_PAIR = TRADING_PAIRS[0].value
export const DEFAULT_CHART_INTERVAL = '240'

export const CONVERSION_DIRECTIONS = [
  { value: 'hive-to-hbd', label: 'HIVE → HBD' },
  { value: 'hbd-to-hive', label: 'HBD → HIVE' }
]

export const CONVERSION_SOURCES = [
  { value: 'market', label: 'Internal market price' },
  { value: 'median', label: 'Blockchain median price' }
]

export function numberOrNull (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseAssetAmount (value) {
  const amount = parseFloat(String(value ?? ''))
  return Number.isFinite(amount) ? amount : 0
}

export function assetSymbol (value) {
  const parts = String(value ?? '').trim().split(/\s+/)
  return (parts[parts.length - 1] || '').toUpperCase()
}

export function roundAmount (value, digits = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Number(number.toFixed(digits))
}

export function formatAmount (value, digits = 3) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function formatPrice (value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const abs = Math.abs(number)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function formatSignedPercent (value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const sign = number > 0 ? '+' : ''
  return sign + number.toFixed(digits) + '%'
}

export function formatVolume (value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function resolveTradingPair (value) {
  const match = TRADING_PAIRS.find(pair => pair.value === value)
  return match ? match.value : DEFAULT_TRADING_PAIR
}

export function resolveChartInterval (value) {
  const match = CHART_INTERVALS.find(interval => interval.value === String(value))
  return match ? match.value : DEFAULT_CHART_INTERVAL
}

export function tradingPair (value) {
  const resolved = resolveTradingPair(value)
  return TRADING_PAIRS.find(pair => pair.value === resolved)
}

export function tradingViewChartUrl (symbol) {
  return 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(symbol || DEFAULT_TRADING_PAIR)
}

function withDepth (orders) {
  let hive = 0
  let hbd = 0
  return orders.map(order => {
    hive += order.hive
    hbd += order.hbd
    return { ...order, cumulativeHive: hive, cumulativeHbd: hbd }
  })
}

/** Normalise get_order_book into HBD-per-HIVE rows with cumulative depth. */
export function normalizeOrderBook (book) {
  const asks = (Array.isArray(book?.asks) ? book.asks : [])
    .map(raw => ({
      price: numberOrNull(raw?.real_price),
      hive: (numberOrNull(raw?.hive) || 0) / 1000,
      hbd: (numberOrNull(raw?.hbd) || 0) / 1000,
      created: raw?.created || ''
    }))
    .filter(order => order.price !== null && order.price > 0)
    .sort((a, b) => a.price - b.price)

  const bids = (Array.isArray(book?.bids) ? book.bids : [])
    .map(raw => ({
      price: numberOrNull(raw?.real_price),
      hive: (numberOrNull(raw?.hive) || 0) / 1000,
      hbd: (numberOrNull(raw?.hbd) || 0) / 1000,
      created: raw?.created || ''
    }))
    .filter(order => order.price !== null && order.price > 0)
    .sort((a, b) => b.price - a.price)

  return { asks: withDepth(asks), bids: withDepth(bids) }
}

/** Best bid/ask, spread, change and volume from the ticker and order book. */
export function marketStats (ticker = {}, book = { asks: [], bids: [] }) {
  const latest = numberOrNull(ticker.latest)
  const bestAsk = book?.asks?.[0]?.price ?? numberOrNull(ticker.lowest_ask)
  const bestBid = book?.bids?.[0]?.price ?? numberOrNull(ticker.highest_bid)
  const mid = bestAsk !== null && bestBid !== null ? (bestAsk + bestBid) / 2 : latest
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null
  const spreadPercent = spread !== null && mid ? (spread / mid) * 100 : null

  return {
    latest,
    change: numberOrNull(ticker.percent_change),
    bestAsk,
    bestBid,
    mid,
    spread: spread !== null ? Math.max(0, spread) : null,
    spreadPercent: spreadPercent !== null ? Math.max(0, spreadPercent) : null,
    hiveVolume: parseAssetAmount(ticker.hive_volume),
    hbdVolume: parseAssetAmount(ticker.hbd_volume)
  }
}

/**
 * Normalise a recent-trade row. `current_pays` is what the taker paid, so it
 * identifies the taker's side; price is always HBD per HIVE.
 */
export function normalizeTrade (trade) {
  if (!trade) return null
  const current = parseAssetAmount(trade.current_pays)
  const open = parseAssetAmount(trade.open_pays)
  const currentSymbol = assetSymbol(trade.current_pays)
  const openSymbol = assetSymbol(trade.open_pays)

  let hive
  let hbd
  let side
  if (currentSymbol === MARKET_ASSET && openSymbol === MARKET_QUOTE) {
    hive = current
    hbd = open
    side = 'sell'
  } else if (currentSymbol === MARKET_QUOTE && openSymbol === MARKET_ASSET) {
    hive = open
    hbd = current
    side = 'buy'
  } else {
    return null
  }

  return {
    date: trade.date || '',
    taker: trade.taker || '',
    maker: trade.maker || '',
    side,
    hive,
    hbd,
    price: hive > 0 ? hbd / hive : 0
  }
}

export function normalizeTrades (trades) {
  return (Array.isArray(trades) ? trades : [])
    .map(normalizeTrade)
    .filter(Boolean)
}

/** Normalise an open limit order. `side` is relative to HIVE. */
export function normalizeOpenOrder (order) {
  if (!order || !order.sell_price) return null
  const base = parseAssetAmount(order.sell_price.base)
  const quote = parseAssetAmount(order.sell_price.quote)
  const baseSymbol = assetSymbol(order.sell_price.base)
  const quoteSymbol = assetSymbol(order.sell_price.quote)
  if (base <= 0 || quote <= 0) return null

  const sellingHive = baseSymbol === MARKET_ASSET
  const price = sellingHive ? quote / base : base / quote

  return {
    id: order.id ?? order.orderid,
    orderid: order.orderid,
    created: order.created || '',
    expiration: order.expiration || '',
    side: sellingHive ? 'sell' : 'buy',
    amount: base,
    asset: baseSymbol,
    receive: quote,
    receiveAsset: quoteSymbol,
    price,
    hiveAmount: sellingHive ? base : quote,
    totalHbd: sellingHive ? quote : base
  }
}

export function normalizeOpenOrders (orders) {
  return (Array.isArray(orders) ? orders : [])
    .map(normalizeOpenOrder)
    .filter(Boolean)
    .sort((a, b) => String(a.created).localeCompare(String(b.created)))
}

/** Validate a limit order before it is queued. */
export function validateOrder ({
  side,
  price,
  amount,
  total,
  balanceHive = 0,
  balanceHbd = 0,
  loggedIn = true
} = {}) {
  const errors = []
  const priceValue = Number(price)
  const amountValue = Number(amount)
  const totalValue = Number(total)

  if (!loggedIn) errors.push('Log in to trade.')
  if (!Number.isFinite(priceValue) || priceValue <= 0) errors.push('Enter a price above zero.')
  if (!Number.isFinite(amountValue) || amountValue <= 0) errors.push('Enter an HIVE amount above zero.')
  if (!Number.isFinite(totalValue) || totalValue <= 0) errors.push('Enter a total above zero.')

  if (side === 'buy') {
    if (Number.isFinite(totalValue) && totalValue > Number(balanceHbd) + 1e-9) {
      errors.push('Not enough HBD for this buy order.')
    }
  } else if (side === 'sell') {
    if (Number.isFinite(amountValue) && amountValue > Number(balanceHive) + 1e-9) {
      errors.push('Not enough HIVE for this sell order.')
    }
  } else {
    errors.push('Choose buy or sell.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Build the active-authority queue entry for a limit order. Buy orders sell
 * HBD for HIVE; sell orders sell HIVE for HBD.
 */
export function buildLimitOrder ({
  owner,
  side,
  price,
  amount,
  total,
  fillOrKill = false,
  orderid,
  now = Date.now(),
  expiryDays = ORDER_EXPIRY_DAYS
} = {}) {
  const amountValue = roundAmount(amount, 3)
  const totalValue = roundAmount(total ?? Number(price) * Number(amount), 3)
  const expiration = new Date(
    Math.floor(now / 1000 + 60 * 60 * 24 * expiryDays) * 1000
  ).toISOString().replace(/\.\d{3}Z$/, '')

  const payload = side === 'buy'
    ? { owner, orderid: orderid ?? Math.floor(now / 1000), amount_to_sell: totalValue.toFixed(3) + ' HBD', min_to_receive: amountValue.toFixed(3) + ' HIVE' }
    : { owner, orderid: orderid ?? Math.floor(now / 1000), amount_to_sell: amountValue.toFixed(3) + ' HIVE', min_to_receive: totalValue.toFixed(3) + ' HBD' }

  return [
    owner,
    'active',
    ['limit_order_create', { ...payload, fill_or_kill: Boolean(fillOrKill), expiration }]
  ]
}

export function buildCancelOrder (owner, orderid) {
  return [owner, 'active', ['limit_order_cancel', { owner, orderid }]]
}

/** Savings APR is stored in basis points on the chain (1000 = 10%). */
export function savingsApr (globalProps) {
  const rate = numberOrNull(globalProps?.hbd_interest_rate)
  if (rate === null) return null
  return rate / 100
}

export function savingsProjection ({ apr, balance } = {}) {
  const rate = numberOrNull(apr)
  const principal = numberOrNull(balance) || 0
  if (rate === null) return { annual: null, monthly: null }
  const annual = principal * (rate / 100)
  return { annual, monthly: annual / 12 }
}

function pegState (price) {
  const value = numberOrNull(price)
  if (value === null || value <= 0) return null
  const premium = (value - 1) * 100
  const abs = Math.abs(premium)
  if (abs < 0.25) return { price: value, premium, label: 'At peg', color: 'green' }
  if (abs < 2) return { price: value, premium, label: premium > 0 ? 'Small premium' : 'Small discount', color: 'orange' }
  return { price: value, premium, label: premium > 0 ? 'Premium' : 'Discount', color: 'red' }
}

/**
 * HBD peg information from three angles: the external HBD quote, the implied
 * HBD price on the internal market and the implied price at the chain median.
 */
export function hbdPeg ({ hbdUsd, hiveUsd, internalHivePrice, medianHivePrice } = {}) {
  const hive = numberOrNull(hiveUsd)
  const internal = numberOrNull(internalHivePrice)
  const median = numberOrNull(medianHivePrice)
  const external = pegState(hbdUsd)
  const internalPeg = hive && internal ? pegState(hive / internal) : null
  const medianPeg = hive && median ? pegState(hive / median) : null

  return {
    external,
    internal: internalPeg,
    median: medianPeg,
    primary: external || internalPeg || medianPeg
  }
}

/** Estimate a HIVE/HBD conversion at the selected price source. */
export function conversionQuote ({ amount, direction, price } = {}) {
  const input = Math.max(0, numberOrNull(amount) || 0)
  const rate = numberOrNull(price)
  if (rate === null || rate <= 0) {
    return { input, output: 0, rate: 0, inverse: 0, valid: false }
  }

  const output = direction === 'hbd-to-hive' ? input / rate : input * rate
  return {
    input,
    output,
    rate,
    inverse: 1 / rate,
    valid: input > 0
  }
}

export function formatConversionRate (direction, rate) {
  const value = numberOrNull(rate)
  if (value === null || value <= 0) return '—'
  if (direction === 'hbd-to-hive') {
    return '1 HBD = ' + formatPrice(1 / value) + ' HIVE'
  }
  return '1 HIVE = ' + formatPrice(value) + ' HBD'
}
