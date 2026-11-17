// Pure helpers for the network health dashboard and API node status page.

export const HBD_SOFT_LIMIT_PERCENT = 20
export const HBD_HARD_LIMIT_PERCENT = 30
export const PARTICIPATION_WINDOW = 128

export function parseAsset (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'object' && value.amount !== undefined) {
    const amount = Number(value.amount)
    if (!Number.isFinite(amount)) return 0
    const precision = Number.isFinite(Number(value.precision)) ? Number(value.precision) : 3
    return amount / Math.pow(10, precision)
  }
  const parsed = parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

/** The median feed is quoted as HBD per 1 HIVE (`base` / `quote`). */
export function medianPrice (history) {
  const price = history?.current_median_history || history || null
  if (!price || !price.base || !price.quote) {
    return { base: 0, quote: 0, hiveUsd: 0, label: '—' }
  }
  const base = parseAsset(price.base)
  const quote = parseAsset(price.quote)
  const hiveUsd = quote > 0 ? base / quote : 0
  return {
    base,
    quote,
    hiveUsd,
    label: hiveUsd > 0 ? '$' + hiveUsd.toFixed(4) : '—'
  }
}

export function debtStatus (ratio) {
  if (ratio === null || ratio === undefined || ratio === '') return { key: 'unknown', label: 'Unknown', color: 'grey' }
  const value = Number(ratio)
  if (!Number.isFinite(value)) return { key: 'unknown', label: 'Unknown', color: 'grey' }
  if (value >= HBD_HARD_LIMIT_PERCENT) return { key: 'critical', label: 'Above hard limit', color: 'negative' }
  if (value >= HBD_SOFT_LIMIT_PERCENT) return { key: 'warning', label: 'Above 20% threshold', color: 'orange' }
  if (value >= 10) return { key: 'watch', label: 'Watch', color: 'amber' }
  return { key: 'ok', label: 'Healthy', color: 'green' }
}

/**
 * Debt ratio = HBD excluding treasury / (HBD excluding treasury + HIVE supply
 * valued in HBD). HF24 excludes the treasury's HBD from the consensus ratio.
 */
export function hbdDebtRatio ({
  hbdSupply,
  hiveSupply,
  hiveUsd,
  treasuryHbd = 0
} = {}) {
  const hbd = Math.max(0, parseAsset(hbdSupply) - Math.max(0, parseAsset(treasuryHbd)))
  const supply = Math.max(0, parseAsset(hiveSupply))
  const price = Math.max(0, Number(hiveUsd) || 0)
  const hiveAsHbd = supply * price
  const total = hbd + hiveAsHbd
  const ratio = price > 0 && total > 0 ? (hbd / total) * 100 : null
  const status = debtStatus(ratio)

  return {
    hbd,
    hiveAsHbd,
    total,
    ratio,
    status,
    hardLimit: HBD_HARD_LIMIT_PERCENT,
    softLimit: HBD_SOFT_LIMIT_PERCENT
  }
}

export function participationRate (count, window = PARTICIPATION_WINDOW) {
  const signed = Number(count)
  const size = Number(window)
  if (!Number.isFinite(signed) || !Number.isFinite(size) || size <= 0) return 0
  return Math.min(100, Math.max(0, (signed / size) * 100))
}

export function participationStatus (rate) {
  if (rate === null || rate === undefined || rate === '') return { key: 'unknown', label: 'Unknown', color: 'grey' }
  const value = Number(rate)
  if (!Number.isFinite(value)) return { key: 'unknown', label: 'Unknown', color: 'grey' }
  if (value >= 95) return { key: 'ok', label: 'Healthy', color: 'green' }
  if (value >= 80) return { key: 'warning', label: 'Degraded', color: 'orange' }
  return { key: 'critical', label: 'Critical', color: 'negative' }
}

export function resourcePool (globalProps, schedule = null) {
  const vestingFundHive = parseAsset(globalProps?.total_vesting_fund_hive)
  const vestingShares = parseAsset(globalProps?.total_vesting_shares)
  const hpPerMvest = vestingShares > 0 ? (1e6 / vestingShares) * vestingFundHive : 0
  const subsidyPool = schedule?.account_subsidy_rd
    ? {
        pool: Number(schedule.account_subsidy_rd.pool_eq) || 0,
        max: Number(schedule.account_subsidy_rd.max_pool_size) || 0,
        unit: Number(schedule.account_subsidy_rd.resource_unit) || 1
      }
    : null

  return {
    vestingFundHive,
    vestingShares,
    hpPerMvest,
    subsidyPool
  }
}

export function chainVersions (config = {}, majorityVersion = '', hardforkVersion = '') {
  const required = Number(config?.HIVE_HARDFORK_REQUIRED_WITNESSES)
  return {
    blockchainVersion: config?.HIVE_BLOCKCHAIN_VERSION || '',
    hardforkVersion: config?.HIVE_BLOCKCHAIN_HARDFORK_VERSION || '',
    consensusVersion: majorityVersion || hardforkVersion || '',
    requiredWitnesses: Number.isFinite(required) ? required : null,
    blockInterval: Number(config?.HIVE_BLOCK_INTERVAL) || 3,
    hbdHardLimit: Number(config?.HIVE_HBD_HARD_LIMIT) ? Number(config.HIVE_HBD_HARD_LIMIT) / 100 : HBD_HARD_LIMIT_PERCENT,
    hbdStartPercent: Number(config?.HIVE_HBD_START_PERCENT_HF26) ? Number(config.HIVE_HBD_START_PERCENT_HF26) / 100 : HBD_SOFT_LIMIT_PERCENT
  }
}

export function headLag (head, bestHead) {
  const height = Number(head)
  const best = Number(bestHead)
  if (!Number.isFinite(height) || !Number.isFinite(best) || best <= 0) return 0
  return Math.max(0, best - height)
}

export function withHeadLag (nodes) {
  const list = Array.isArray(nodes) ? nodes : []
  const bestHead = list.reduce((best, node) => node?.ok ? Math.max(best, Number(node.head) || 0) : best, 0)
  return list.map(node => ({
    ...node,
    lag: node?.ok ? headLag(node.head, bestHead) : null
  }))
}

export function summarizeNodes (nodes) {
  const list = (Array.isArray(nodes) ? nodes : []).filter(Boolean)
  const healthy = list.filter(node => node.ok)
  const latencies = healthy.map(node => Number(node.latency)).filter(Number.isFinite)
  const lags = healthy.map(node => Number(node.lag)).filter(Number.isFinite)
  const fastest = healthy
    .filter(node => Number.isFinite(Number(node.latency)))
    .sort((a, b) => Number(a.latency) - Number(b.latency))[0] || null

  const versions = new Map()
  for (const node of healthy) {
    const version = node.version || 'unknown'
    versions.set(version, (versions.get(version) || 0) + 1)
  }

  return {
    total: list.length,
    healthyCount: healthy.length,
    unreachableCount: list.length - healthy.length,
    averageLatency: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null,
    fastest,
    maxLag: lags.length ? Math.max(...lags) : null,
    versions: [...versions.entries()].map(([version, count]) => ({ version, count }))
  }
}

export function pickFastestHealthy (nodes, { maxLag = 3 } = {}) {
  const limit = Number.isFinite(Number(maxLag)) ? Number(maxLag) : 3
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => node?.ok)
    .filter(node => !Number.isFinite(Number(node.lag)) || Number(node.lag) <= limit)
    .filter(node => Number.isFinite(Number(node.latency)))
    .sort((a, b) => Number(a.latency) - Number(b.latency))[0] || null
}

export function nodeStatus (node, { maxLag = 3 } = {}) {
  if (!node) return { key: 'unknown', label: 'Unknown', color: 'grey' }
  if (!node.ok) return { key: 'offline', label: 'Unreachable', color: 'negative' }
  if (Number(node.lag) > Number(maxLag)) return { key: 'behind', label: 'Behind', color: 'warning' }
  return { key: 'ok', label: 'Healthy', color: 'green' }
}

export function versionStatus (version, expectedVersion) {
  const current = String(version || '')
  const expected = String(expectedVersion || '')
  if (!current || !expected) return 'unknown'
  const currentParts = current.replace(/^v/i, '').split('.').slice(0, 2).join('.')
  const expectedParts = expected.replace(/^v/i, '').split('.').slice(0, 2).join('.')
  return currentParts === expectedParts ? 'match' : 'mismatch'
}

export function overallStatus (levels) {
  const list = (Array.isArray(levels) ? levels : []).filter(Boolean)
  if (list.includes('critical')) return 'critical'
  if (list.includes('warning')) return 'warning'
  if (list.includes('watch')) return 'watch'
  return 'healthy'
}

export function overallStatusLabel (status) {
  switch (status) {
    case 'critical':
      return 'Needs attention'
    case 'warning':
      return 'Degraded'
    case 'watch':
      return 'Watch'
    default:
      return 'Healthy'
  }
}

export function overallStatusColor (status) {
  switch (status) {
    case 'critical':
      return 'negative'
    case 'warning':
      return 'orange'
    case 'watch':
      return 'amber'
    default:
      return 'green'
  }
}

export function formatLatency (value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return Math.round(number).toLocaleString('en-US') + ' ms'
}

export function formatCount (value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}
