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

/** Format a latency from history samples, using the supplied fallback when empty. */
export function formatMedian (value) {
  return formatLatency(value)
}

// --- Beacon monitor --------------------------------------------------------

export const BEACON_UPSTREAM = 'https://beacon.peakd.com'
export const BEACON_KNOWN_FEATURES = [
  'get_account_history',
  'get_transaction',
  'get_rc_stats',
  'broadcast',
  'nft_tracker_api',
  'balance_api',
  'hafah_api',
  'hafbe_api',
  'reputation_api',
  'hivesense_api'
]

function normalizeEndpoint (url) {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase()
}

/**
 * Map the beacon `/api/nodes` payload to a lookup keyed by normalised URL.
 * Rows without an endpoint are ignored so a schema change can never crash the
 * page.
 */
export function parseBeaconNodes (payload) {
  const rows = Array.isArray(payload) ? payload : []
  const map = {}
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const endpoint = raw.endpoint || raw.url || ''
    if (!endpoint) continue
    const success = Number(raw.success) || 0
    const fail = Number(raw.fail) || 0
    const score = Number(raw.score) || 0
    map[normalizeEndpoint(endpoint)] = {
      endpoint,
      name: raw.name || String(endpoint).replace(/^https?:\/\//, ''),
      version: raw.version && raw.version !== '-' ? raw.version : null,
      score,
      success,
      fail,
      lastBlock: Number.isFinite(Number(raw.lastBlock)) && Number(raw.lastBlock) > 0 ? Number(raw.lastBlock) : null,
      updatedAt: raw.updated_at || null,
      features: Array.isArray(raw.features) ? raw.features : [],
      appsSuccess: Number(raw.apps?.success) || 0,
      appsFail: Number(raw.apps?.fail) || 0,
      // beacon checks once per hour (24 successes = 24h of clean checks)
      uptime: success + fail > 0 ? (success / (success + fail)) * 100 : null
    }
  }
  return map
}

export function beaconStatus (entry) {
  if (!entry) return { key: 'unknown', label: 'Not scored', color: 'grey' }
  if (Number(entry.score) <= 0) return { key: 'critical', label: 'Down', color: 'negative' }
  if (Number(entry.score) >= 90) return { key: 'ok', label: 'Reliable', color: 'green' }
  if (Number(entry.score) >= 60) return { key: 'watch', label: 'Watch', color: 'amber' }
  return { key: 'warning', label: 'Flaky', color: 'orange' }
}

export function beaconEntryFor (map, url) {
  return map?.[normalizeEndpoint(url)] || null
}

const FEATURE_LABELS = {
  get_account_history: 'Account history',
  get_transaction: 'Transactions',
  get_rc_stats: 'RC stats',
  broadcast: 'Broadcast',
  nft_tracker_api: 'NFT tracker',
  balance_api: 'Balance API',
  hafah_api: 'HAF account history',
  hafbe_api: 'HAF block explorer',
  reputation_api: 'Reputation',
  hivesense_api: 'HiveSense API'
}

export function featureLabel (feature) {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature]
  if (!feature) return ''
  const words = String(feature)
    .replace(/_api$/, '')
    .replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Build the feature matrix for the /nodes comparison table: one row per known
 * feature, with the nodes that advertise it. Unknown advertised features are
 * appended after the well-known list.
 */
export function featureMatrix (entries) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean)
  const advertised = new Set()
  for (const entry of list) {
    for (const feature of entry.features || []) advertised.add(feature)
  }
  const order = [
    ...BEACON_KNOWN_FEATURES.filter(feature => advertised.has(feature)),
    ...[...advertised].filter(feature => !BEACON_KNOWN_FEATURES.includes(feature)).sort()
  ]
  return order.map(feature => ({
    key: feature,
    label: featureLabel(feature),
    nodes: list.filter(entry => (entry.features || []).includes(feature)).map(entry => entry.endpoint)
  }))
}

export function coverageLabel (feature, total) {
  const count = Number(feature?.nodes?.length) || 0
  const size = Number(total) || 0
  if (!size) return count + ' node' + (count === 1 ? '' : 's')
  return count + ' / ' + size
}

export function featureCoverage (entries, feature) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean)
  const have = list.filter(entry => (entry.features || []).includes(feature)).length
  return list.length ? (have / list.length) * 100 : 0
}

// --- Sorting, filtering and comparison ------------------------------------

export const NODE_SORT_OPTIONS = [
  { label: 'Typical latency', value: 'latency' },
  { label: 'Head lag', value: 'lag' },
  { label: 'Beacon score', value: 'score' },
  { label: 'Name', value: 'name' },
  { label: 'Version', value: 'version' }
]

// Layer-2 nodes have no beacon score, so keep the same ordering without the
// Hive-only metric.
export const LAYER2_SORT_OPTIONS = NODE_SORT_OPTIONS.filter(option => option.value !== 'score')

export const NODE_FILTER_OPTIONS = [
  { label: 'All nodes', value: 'all' },
  { label: 'Healthy only', value: 'healthy' },
  { label: 'Fallback nodes', value: 'fallback' },
  { label: 'Problems', value: 'problems' }
]

/**
 * Sort probed nodes for display. Healthy nodes always come before failing
 * ones; inside each group the chosen metric decides. Ties break on typical
 * latency then URL so the order is stable across refreshes.
 */
export function sortNodes (nodes, key = 'latency', direction = 'asc', { typicalOf } = {}) {
  const list = (Array.isArray(nodes) ? nodes : []).filter(Boolean)
  const dir = direction === 'desc' ? -1 : 1
  const typical = typeof typicalOf === 'function' ? typicalOf : node => node.latency

  const metric = node => {
    switch (key) {
      case 'lag':
        return Number.isFinite(Number(node.lag)) ? Number(node.lag) : Infinity
      case 'score':
        return Number.isFinite(Number(node.beacon?.score)) ? Number(node.beacon.score) : -1
      case 'version':
        return String(node.version || '')
      case 'name':
        return String(node.url || '')
      case 'latency':
      default: {
        const value = typical(node)
        return Number.isFinite(Number(value)) ? Number(value) : Infinity
      }
    }
  }

  return list.slice().sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1
    const left = metric(a)
    const right = metric(b)
    if (typeof left === 'string' || typeof right === 'string') {
      const compare = String(left).localeCompare(String(right))
      if (compare !== 0) return compare * dir
    } else if (left !== right) {
      return (left - right) * dir
    }
    // Tie-break: lower head lag first (a synced node beats a lagging one),
    // then typical latency, then host name for a stable order.
    const lagDiff = (Number(a.lag) || 0) - (Number(b.lag) || 0)
    if (key !== 'lag' && lagDiff !== 0) return lagDiff
    const latencyDiff = (Number(typical(a)) || Infinity) - (Number(typical(b)) || Infinity)
    if (key !== 'latency' && Number.isFinite(latencyDiff) && latencyDiff !== 0) return latencyDiff
    return String(a.url || '').localeCompare(String(b.url || ''))
  })
}

export function filterNodes (nodes, filter) {
  const list = (Array.isArray(nodes) ? nodes : []).filter(Boolean)
  switch (filter) {
    case 'healthy':
      return list.filter(node => node.ok)
    case 'fallback':
      return list.filter(node => node.fallback)
    case 'problems':
      return list.filter(node => !node.ok || Number(node.lag) > 3)
    case 'all':
    default:
      return list
  }
}

/**
 * Nodes that are missing a commonly used feature, relative to the healthiest
 * node. Used for warnings on the comparison table rather than to fail a node.
 */
export function featureGaps (entry, reference) {
  if (!entry || !reference) return []
  const have = new Set(entry.features || [])
  return (reference.features || []).filter(feature => !have.has(feature))
}

/**
 * Aggregate a beacon row into the node row the page renders. The browser probe
 * decides if the node works from *this* device; beacon supplies the long-run
 * reliability score and the advertised feature list.
 */
export function mergeBeaconNode (node, beaconEntry) {
  return {
    ...node,
    beacon: beaconEntry || null
  }
}

export function attachBeacon (nodes, beaconMap) {
  return (Array.isArray(nodes) ? nodes : []).map(node => mergeBeaconNode(node, beaconEntryFor(beaconMap, node?.url)))
}

/** Seconds since the head block was produced, computed from chain time. */
export function headAge (headTime, now = Date.now()) {
  if (!headTime) return null
  const parsed = Date.parse(headTime.endsWith?.('Z') ? headTime : headTime + 'Z')
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round((now - parsed) / 1000))
}

export function formatHeadAge (seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const value = Number(seconds)
  if (!Number.isFinite(value)) return '—'
  if (value < 2) return 'just now'
  if (value < 60) return value + 's ago'
  const minutes = Math.floor(value / 60)
  return minutes + 'm ago'
}

export function minimumScore (nodes) {
  const healthy = (Array.isArray(nodes) ? nodes : []).filter(node => node?.ok && Number.isFinite(Number(node.beacon?.score)))
  return healthy.length ? Math.min(...healthy.map(node => Number(node.beacon.score))) : null
}

export function formatPercent (value, digits = 0) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toFixed(digits) + '%'
}


export function formatCount (value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}
