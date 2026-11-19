// Hive-Engine balances priced in HIVE for the portfolio widget.
//
// Metrics are quoted in the market's quote token. Almost every Hive-Engine
// token trades against SWAP.HIVE; SWAP.HBD pairs are converted with the caller's
// HBD/HIVE ratio. Tokens without a market are returned with a zero value so the
// UI can show the balance without inventing a price.

import { getHiveEngine } from './hiveEngine'

function number (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Join `tokens.balances` with `market.metrics`.
 * Returns `{ tokens, totalHive }`, sorted by value.
 */
export function hiveEnginePortfolio (balances, metrics) {
  const bySymbol = new Map()
  for (const metric of Array.isArray(metrics) ? metrics : []) {
    if (metric?.symbol) bySymbol.set(metric.symbol, metric)
  }

  const tokens = (Array.isArray(balances) ? balances : [])
    .filter(balance => balance?.symbol)
    .map(balance => {
      const symbol = String(balance.symbol)
      const amount = number(balance.balance)
      const metric = bySymbol.get(symbol)
      let priceHive = metric ? number(metric.lastPrice) : 0
      if (symbol === 'SWAP.HIVE') priceHive = 1
      const quote = String(metric?.quote || 'SWAP.HIVE').toUpperCase()
      return {
        symbol,
        balance: amount,
        priceHive,
        quote,
        // The widget converts SWAP.HBD quotes with the live HBD/HIVE ratio.
        usdPegged: quote.includes('HBD'),
        valueHive: symbol === 'SWAP.HIVE' ? amount : amount * priceHive
      }
    })
    .filter(token => token.balance > 0)
    .sort((a, b) => b.valueHive - a.valueHive)

  return {
    tokens,
    totalHive: tokens.reduce((sum, token) => sum + token.valueHive, 0)
  }
}

/** Fetch and price every Hive-Engine balance for an account. */
export async function fetchHiveEnginePortfolio (account) {
  if (!account) return { tokens: [], totalHive: 0 }
  const engine = getHiveEngine()
  const balances = await engine.find('tokens', 'balances', { account }, 1000)
  if (!Array.isArray(balances) || !balances.length) return { tokens: [], totalHive: 0 }
  const symbols = balances.map(balance => balance.symbol).filter(Boolean)
  const metrics = symbols.length
    ? await engine.find('market', 'metrics', { symbol: { $in: symbols } }, 1000)
    : []
  return hiveEnginePortfolio(balances, metrics)
}
