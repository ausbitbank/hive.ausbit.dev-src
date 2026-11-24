// Pure shaping for the portfolio-trend dashboard widget.
//
// Hive has no historical balance index, so portfolio history is a bounded
// local snapshot series saved by the widget. Price history is public and comes
// from CoinGecko. Keeping the two series separate means the card never implies
// that a price line is a balance line.

import { buildPortfolio, formatUsd, tidyNumber } from './wallet'

export const MAX_PORTFOLIO_POINTS = 90
export const MIN_SNAPSHOT_GAP_MS = 6 * 60 * 60 * 1000

function numberValue (value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function timestampValue (value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function percentLabel (value) {
  if (value === null) return '—'
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%'
}

function percent (first, last) {
  if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(last)) return null
  return ((last - first) / first) * 100
}

/** Keep only finite, positive, time-ordered points and cap the series. */
export function normalisePortfolioPoints (points, { max = MAX_PORTFOLIO_POINTS } = {}) {
  const rows = []
  for (const point of Array.isArray(points) ? points : []) {
    const at = timestampValue(point?.at)
    const usd = numberValue(point?.usd ?? point?.value)
    if (at === null || usd === null) continue
    rows.push({ at, usd })
  }
  return rows
    .sort((a, b) => a.at - b.at)
    .slice(-Math.max(2, Number(max) || MAX_PORTFOLIO_POINTS))
}

/**
 * Append one local snapshot. A value inside the minimum gap replaces the last
 * point (so opening the dashboard repeatedly does not crowd the chart); older
 * points are eventually trimmed to `max`.
 */
export function appendPortfolioSnapshot (snapshots, point, {
  max = MAX_PORTFOLIO_POINTS,
  minGapMs = MIN_SNAPSHOT_GAP_MS
} = {}) {
  const at = timestampValue(point?.at) ?? Date.now()
  const usd = numberValue(point?.usd)
  const existing = normalisePortfolioPoints(snapshots, { max })
  if (usd === null) return existing
  const last = existing[existing.length - 1]
  if (last && at - last.at < Math.max(0, Number(minGapMs) || 0)) {
    return existing.slice(0, -1).concat([{ at, usd }])
  }
  return existing.concat([{ at, usd }]).slice(-Math.max(2, Number(max) || MAX_PORTFOLIO_POINTS))
}

function priceChangeValue (prices, id) {
  const entry = prices?.[id]
  const value = entry?.usd_24h_change ?? entry?.change
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Summarise the current portfolio, the local balance history and the public
 * HIVE price history for the card. Missing inputs never throw; the caller gets
 * `hasPriceHistory` / `hasPortfolioHistory` flags to pick the honest state.
 */
export function portfolioTrendSummary ({
  account = null,
  globalProps = null,
  prices = null,
  priceHistory = null,
  snapshots = [],
  windowDays = 30,
  now = Date.now()
} = {}) {
  const portfolio = buildPortfolio({
    account,
    globalProps,
    hivePriceUsd: prices?.hive?.usd || 0,
    hbdPriceUsd: prices?.hive_dollar?.usd || 0,
    hiveChange: priceChangeValue(prices, 'hive'),
    hbdChange: priceChangeValue(prices, 'hive_dollar')
  })
  const currentUsd = Number.isFinite(portfolio.totalUsd) ? portfolio.totalUsd : 0
  const points = normalisePortfolioPoints(snapshots)
  const pricePoints = normalisePortfolioPoints(priceHistory?.points || [])
  const window = Number(windowDays) === 7 ? 7 : 30

  const priceChangePct = pricePoints.length >= 2
    ? percent(pricePoints[0].usd, pricePoints[pricePoints.length - 1].usd)
    : null
  const portfolioChange = points.length >= 2
    ? percent(points[0].usd, points[points.length - 1].usd)
    : null

  const firstAt = points[0]?.at || null
  const trackedDays = firstAt
    ? Number(((Number(now) - firstAt) / (24 * 60 * 60 * 1000)).toFixed(1))
    : 0

  return {
    hasAccount: Boolean(account),
    currentUsd,
    currentLabel: formatUsd(currentUsd),
    windowDays: window,
    windowLabel: 'Last ' + window + ' days',
    hasPriceHistory: pricePoints.length >= 2,
    hasPortfolioHistory: points.length >= 2,
    isNew: points.length < 2,
    pricePoints,
    portfolioPoints: points,
    priceSeries: pricePoints.map(point => point.usd),
    portfolioSeries: points.map(point => point.usd),
    priceChange: priceChangePct,
    portfolioChange,
    priceChangeLabel: percentLabel(priceChangePct),
    portfolioChangeLabel: percentLabel(portfolioChange),
    priceDirection: priceChangePct === null ? 'flat' : priceChangePct > 0 ? 'up' : priceChangePct < 0 ? 'down' : 'flat',
    portfolioDirection: portfolioChange === null ? 'flat' : portfolioChange > 0 ? 'up' : portfolioChange < 0 ? 'down' : 'flat',
    trackedDays,
    trackedLabel: points.length
      ? 'Local baseline: ' + points.length + ' point' + (points.length === 1 ? '' : 's') +
        (trackedDays >= 1 ? ' over ' + tidyNumber(trackedDays, 1) + ' days' : '')
      : 'No local portfolio baseline yet',
    lastPriceLabel: pricePoints.length
      ? formatUsd(pricePoints[pricePoints.length - 1].usd)
      : '—'
  }
}

export default portfolioTrendSummary
