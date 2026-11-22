// Pure data shaping for the Hive-Engine watchlist dashboard widget.
//
// The widget asks `market.metrics` for the requested symbols and, when an
// account is available, `tokens.balances` for the same list. This module joins
// those two rows in the requested symbol order so the widget never has to deal
// with missing metrics, string numbers or duplicate settings.

function numberOrNull (value) {
  if (value === null || value === undefined || value === '') return null
  const raw = typeof value === 'string' ? value.replace(/[,\s%]/g, '') : value
  if (raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function normaliseSymbol (value) {
  return String(value ?? '').trim().toUpperCase()
}

function change24hFor (metric) {
  if (!metric || typeof metric !== 'object') return null
  const direct = numberOrNull(metric.priceChangePercent) ?? numberOrNull(metric.change24h)
  if (direct !== null) return direct
  const last = numberOrNull(metric.lastPrice)
  const previous = numberOrNull(metric.lastDayPrice)
  if (last === null || previous === null || previous <= 0) return null
  return ((last - previous) / previous) * 100
}

export function hiveEngineWatchlistSummary ({ metrics = [], balances = [], symbols = [], limit = 6 } = {}) {
  const requestedSymbols = []
  const seen = new Set()
  for (const raw of Array.isArray(symbols) ? symbols : []) {
    const symbol = normaliseSymbol(raw)
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    requestedSymbols.push(symbol)
  }

  const metricBySymbol = new Map()
  for (const metric of Array.isArray(metrics) ? metrics : []) {
    const symbol = normaliseSymbol(metric?.symbol)
    if (symbol) metricBySymbol.set(symbol, metric)
  }

  const balanceBySymbol = new Map()
  for (const row of Array.isArray(balances) ? balances : []) {
    const symbol = normaliseSymbol(row?.symbol)
    if (symbol) balanceBySymbol.set(symbol, row)
  }

  const parsedLimit = Number(limit)
  const size = Number.isFinite(parsedLimit) ? Math.max(0, Math.floor(parsedLimit)) : 6

  const rows = requestedSymbols.slice(0, size).map(symbol => {
    const metric = metricBySymbol.get(symbol) || null
    const balanceRow = balanceBySymbol.get(symbol) || null
    const priceHive = metric ? numberOrNull(metric.lastPrice) : null
    const balance = balanceRow ? numberOrNull(balanceRow.balance) : null
    return {
      symbol,
      priceHive,
      change24h: change24hFor(metric),
      volume: metric ? numberOrNull(metric.volume) : null,
      balance,
      valueHive: priceHive !== null && balance !== null ? priceHive * balance : null,
      hasMarket: priceHive !== null,
      link: '/token/' + symbol
    }
  })

  return {
    rows,
    totalValueHive: rows.reduce((sum, row) => sum + (row.valueHive ?? 0), 0),
    hasBalances: rows.some(row => row.balance !== null),
    hasData: rows.some(row => row.hasMarket || row.balance !== null),
    requestedSymbols
  }
}

export default hiveEngineWatchlistSummary
