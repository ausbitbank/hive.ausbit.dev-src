import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'
import { configureApi, rpcRequest } from './api'
import { setHiveTxNode } from './hiveTx'

export const HIVE_NODE_PROBE_TIMEOUT_MS = 2000

export function setHiveNode (url) {
  const node = url || DEFAULT_HIVE_NODE
  configureApi({ node })
  setHiveTxNode(node)
}

function probeErrorMessage (error) {
  return error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
}

/**
 * Probe a Hive API node with a cheap condenser call.
 *
 * Always resolves; failures are reported as `{ ok: false, error }` so callers
 * can use it inside Promise.all without extra error handling. A successful
 * probe also carries `rpcMs` (JSON-RPC server time), `headTime` (chain time of
 * the head block) and `serverVersion` when the node reports them.
 */
export async function probeHiveNode (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  if (!url || typeof url !== 'string') {
    return { url, ok: false, latency: Infinity, error: 'No node URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_dynamic_global_properties',
        params: []
      }),
      signal: controller.signal
    })

    const latency = Date.now() - started
    if (!response.ok) {
      return { url, ok: false, latency, error: 'HTTP ' + response.status }
    }

    const data = await response.json()
    const head = Number(data?.result?.head_block_number)
    if (!Number.isFinite(head) || head <= 0) {
      return { url, ok: false, answered: true, latency, error: data?.error?.message || 'Invalid response' }
    }

    const rpcMs = Number(data?.result?.server_latency ?? data?.result?.latency)
    return {
      url,
      ok: true,
      latency,
      head,
      rpcMs: Number.isFinite(rpcMs) && rpcMs >= 0 ? rpcMs : null,
      headTime: data?.result?.time || null,
      serverVersion: data?.result?.server_version || null
    }
  } catch (error) {
    const latency = Date.now() - started
    return { url, ok: false, latency, error: probeErrorMessage(error) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch the reporting node's software version. Supports both the condenser
 * `get_version` result and a `hive_version` field on global properties.
 *
 * Distinguishes a missing method (`missing: true`) from a node error so the
 * /nodes comparison table can show an empty feature cell without marking an
 * otherwise healthy node as broken.
 */
export async function probeHiveNodeVersion (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  if (!url || typeof url !== 'string') {
    return { url, ok: false, version: null, chainId: null, missing: true, error: 'No node URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_version',
        params: []
      }),
      signal: controller.signal
    })
    if (!response.ok) {
      return { url, ok: false, version: null, chainId: null, missing: false, error: 'HTTP ' + response.status }
    }
    const data = await response.json()
    const version = data?.result?.blockchain_version || data?.result?.hive_version || null
    const missing = !version && isMissingMethodError(data?.error)
    return {
      url,
      ok: Boolean(version),
      version,
      chainId: data?.result?.chain_id || null,
      nodeType: data?.result?.node_type || null,
      missing,
      error: version ? '' : (data?.error?.message || 'Version unavailable')
    }
  } catch (error) {
    return {
      url,
      ok: false,
      version: null,
      chainId: null,
      missing: false,
      error: probeErrorMessage(error)
    }
  } finally {
    clearTimeout(timer)
  }
}

function isMissingMethodError (error) {
  if (!error) return false
  const code = Number(error.code)
  const message = String(error.message || '').toLowerCase()
  return code === -32601 || code === 404 || message.includes('method not found') || message.includes('unknown method')
}

/**
 * Probe a node for head, latency, RPC time and software version in parallel.
 * Always resolves; a version failure does not make an otherwise healthy node
 * fail, but a timeout does count against the overall node.
 */
export async function probeHiveNodeFull (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  const [base, version] = await Promise.all([
    probeHiveNode(url, timeoutMs),
    probeHiveNodeVersion(url, timeoutMs)
  ])
  return {
    ...base,
    version: version.ok ? version.version : null,
    chainId: version.chainId || null,
    nodeType: version.nodeType || null,
    versionMissing: Boolean(version.missing)
  }
}

/**
 * Record a probe result into a rolling latency history.
 *
 * The median of the last few successful samples is a steadier "typical"
 * latency than a single request, which can be skewed by one slow TCP round
 * trip. Falls back to the latest sample when no history exists.
 */
export function typicalLatency (samples, latest) {
  const values = (Array.isArray(samples) ? samples : [])
    .filter(sample => sample && sample.ok && Number.isFinite(Number(sample.latency)))
    .map(sample => Number(sample.latency))
    .slice(-5)
    .sort((a, b) => a - b)
  if (values.length) return values[Math.floor(values.length / 2)]
  return Number.isFinite(Number(latest)) ? Number(latest) : null
}

/**
 * Pick a usable API node at startup.
 *
 * The configured node wins when it is healthy; otherwise the fastest healthy
 * known node is used. All candidates are probed in parallel so a dead network
 * delays startup by at most one probe timeout (~2s). If nothing responds the
 * configured URL is returned so the app still starts.
 */
export async function selectHiveNode (configuredUrl) {
  const configured = configuredUrl || DEFAULT_HIVE_NODE
  const candidates = [...new Set([configured, ...HIVE_API_NODES])]
  const probes = await Promise.all(candidates.map(url => probeHiveNode(url)))

  const configuredProbe = probes.find(probe => probe.url === configured)
  // A configured node that answers but has no readable head is degraded, not
  // dead, so keep it rather than forcing an unnecessary switch to a fallback.
  if (configuredProbe?.ok || configuredProbe?.answered) return configured

  const healthy = probes
    .filter(probe => probe.ok)
    .sort((a, b) => a.latency - b.latency)

  return healthy.length > 0 ? healthy[0].url : configured
}

// Compatibility facade for the old `hive.api` surface.
//
// The read path has always been `src/services/api.js`; this object keeps the
// existing call sites working while the last hive-js reads are migrated. New
// code should import the named helpers from `api.js`/`chainData.js` instead.
const api = {
  setOptions ({ url }) {
    setHiveNode(url)
  },
  callAsync (method, params = []) {
    if (method === 'call') {
      const [apiName, apiMethod, apiParams] = params
      return rpcRequest(apiName + '.' + apiMethod, apiParams)
    }
    return rpcRequest(method, params)
  },
  getBlockAsync (blockNum) {
    return rpcRequest('block_api.get_block', { block_num: blockNum })
  },
  getBlockHeaderAsync (blockNum) {
    return rpcRequest('condenser_api.get_block_header', [blockNum])
  },
  getOpsInBlockAsync (blockNum, onlyVirtual = false) {
    return rpcRequest('account_history_api.get_ops_in_block', {
      block_num: blockNum,
      only_virtual: onlyVirtual
    })
  },
  getContentAsync (author, permlink) {
    return rpcRequest('condenser_api.get_content', [author, permlink])
  },
  getAccountsAsync (names) {
    return rpcRequest('condenser_api.get_accounts', [Array.isArray(names) ? names : [names]])
  },
  getCurrentMedianHistoryPriceAsync () {
    return rpcRequest('condenser_api.get_current_median_history_price', [])
  },
  getTickerAsync () {
    return rpcRequest('market_history_api.get_ticker', [])
  },
  getOrderBookAsync (limit = 200) {
    return rpcRequest('market_history_api.get_order_book', [limit])
  },
  getRecentTradesAsync (limit = 100) {
    return rpcRequest('market_history_api.get_recent_trades', [limit])
  },
  getOpenOrdersAsync (owner) {
    return rpcRequest('condenser_api.get_open_orders', [owner])
  },
  getSavingsWithdrawFromAsync (account) {
    return rpcRequest('condenser_api.get_savings_withdraw_from', [account])
  },
  getConversionRequestsAsync (account) {
    return rpcRequest('condenser_api.get_conversion_requests', [account])
  },
  lookupAccountsAsync (lowerBound, limit = 10) {
    return rpcRequest('condenser_api.lookup_accounts', [String(lowerBound || '').toLowerCase(), limit])
  },
  getWithdrawRoutesAsync (account, type) {
    return rpcRequest('condenser_api.get_withdraw_routes', [account, type])
  },
  getTransactionAsync (trxId) {
    return rpcRequest('condenser_api.get_transaction', [trxId])
  },
  getRewardFund (name = 'post') {
    return rpcRequest('condenser_api.get_reward_fund', [name])
  },
  getHardforkVersionAsync () {
    return rpcRequest('condenser_api.get_hardfork_version', [])
  },
  getAccountCountAsync () {
    return rpcRequest('condenser_api.get_account_count', [])
  },
  getAccountHistory (account, from = -1, limit = 100) {
    return rpcRequest('account_history_api.get_account_history', { account, from, limit })
  }
}

const hive = { api }

export default hive
export { hive }
