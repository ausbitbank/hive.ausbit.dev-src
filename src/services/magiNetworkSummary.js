// Pure summary for the Magi network dashboard widget.
//
// The widget probes one Magi node and then asks for witnesses, recent
// contracts and DEX token prices. Those calls are optional: a node can answer
// the probe while the indexer-backed calls fail or lag. Keeping the shaping
// here means null probes, empty lists and missing price maps are all handled
// in one deterministic, testable place.
//
// This module intentionally has no Vue imports and no timers.

function numberOrNull (value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeLimit (limit, fallback = 4) {
  const value = Math.floor(Number(limit))
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(value, 50)
}

function shortId (id) {
  const value = String(id || '')
  if (!value) return ''
  return value.length > 18 ? value.slice(0, 10) + '…' + value.slice(-6) : value
}

function normalizeNode (node) {
  if (!node || typeof node !== 'object') return null

  const ok = Boolean(node.ok)
  const suspended = Boolean(node.processingSuspended) || Boolean(node.suspended)
  const head = numberOrNull(node.head)
  const latency = numberOrNull(node.latency)

  let label = 'Offline'
  if (ok) label = suspended ? 'Suspended' : 'Online'
  else if (node.error) label = String(node.error)

  return {
    url: String(node.url || ''),
    ok,
    head: head !== null && head > 0 ? head : null,
    version: String(node.version || node.versionId || ''),
    latency,
    suspended,
    label
  }
}

function witnessRows (witnesses) {
  return (Array.isArray(witnesses) ? witnesses : [])
    .filter(row => row && typeof row === 'object')
}

function contractRows (contracts, limit) {
  const raw = Array.isArray(contracts)
    ? contracts
    : Array.isArray(contracts?.contracts) ? contracts.contracts : []

  return raw
    .filter(row => row && typeof row === 'object')
    .slice(0, limit)
    .map(row => {
      const id = String(row.id || row.contract_id || '')
      return {
        id,
        owner: String(row.owner || row.creator || ''),
        timestamp: String(row.creation_ts || row.activation_ts || row.timestamp || ''),
        height: numberOrNull(row.creation_height) ?? numberOrNull(row.activation_height),
        label: String(row.name || shortId(id) || 'Unnamed contract')
      }
    })
}

function tokenRows (tokens, limit) {
  const map = tokens && typeof tokens === 'object' &&
    tokens.pricesBySymbol && typeof tokens.pricesBySymbol === 'object'
    ? tokens.pricesBySymbol
    : null
  if (!map) return []

  return Object.entries(map)
    .map(([symbol, row]) => ({
      symbol: String(symbol || ''),
      priceHbd: numberOrNull(row?.priceHbd),
      depth: numberOrNull(row?.poolDepthHbd)
    }))
    .filter(row => row.symbol && row.priceHbd !== null && row.priceHbd > 0)
    // The deepest pool is the best price signal, so surface it first.
    .sort((a, b) => {
      const depth = (b.depth ?? -1) - (a.depth ?? -1)
      return depth !== 0 ? depth : a.symbol.localeCompare(b.symbol)
    })
    .slice(0, limit)
    .map(row => ({ symbol: row.symbol, priceHbd: row.priceHbd }))
}

function statusLabelFor (status, node) {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'warning':
      return 'Degraded'
    case 'critical':
      return node && !node.ok ? 'Unreachable' : 'Needs attention'
    default:
      return 'Unknown'
  }
}

/**
 * Summarise a Magi probe plus the optional public read models for the widget.
 *
 * `contracts` accepts the `{ endpoint, contracts }` shape returned by
 * `fetchRecentMagiContracts` as well as a bare array; `tokens` accepts the
 * `{ pricesBySymbol, hbdPerHive }` shape from `fetchMagiTokenPrices`.
 */
export function magiNetworkSummary ({
  node = null,
  witnesses = [],
  contracts = [],
  tokens = null,
  limit = 4
} = {}) {
  const size = normalizeLimit(limit)
  const nodeInfo = normalizeNode(node)
  const witnessList = witnessRows(witnesses)
  const contractList = contractRows(contracts, size)
  const tokenList = tokenRows(tokens, size)
  const hbdPerHive = numberOrNull(tokens?.hbdPerHive)

  const enabledWitnesses = witnessList.filter(row => Boolean(row.enabled)).length
  const witnessInfo = {
    count: witnessList.length,
    enabled: enabledWitnesses,
    top: witnessList.slice(0, size).map(row => ({
      account: String(row.account || ''),
      versionId: String(row.versionId || row.version_id || ''),
      enabled: Boolean(row.enabled),
      delegationMode: String(row.delegationMode || row.delegation_mode || '')
    }))
  }

  const available = Boolean(nodeInfo?.ok) ||
    witnessInfo.count > 0 ||
    contractList.length > 0 ||
    tokenList.length > 0 ||
    hbdPerHive !== null

  let status = 'unknown'
  if (nodeInfo) {
    if (!nodeInfo.ok || nodeInfo.suspended) {
      status = 'critical'
    } else if (witnessInfo.count === 0) {
      status = 'warning'
    } else if (nodeInfo.latency !== null && nodeInfo.latency >= 2000) {
      status = 'warning'
    } else {
      status = 'healthy'
    }
  } else if (available) {
    // Partial data without a probe: useful, but the node state is unknown.
    status = 'warning'
  }

  return {
    available,
    node: nodeInfo,
    witnesses: witnessInfo,
    contracts: contractList,
    tokens: tokenList,
    hbdPerHive,
    status,
    statusLabel: statusLabelFor(status, nodeInfo)
  }
}

export default magiNetworkSummary
