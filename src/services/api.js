// Central JSON-RPC client with timeouts, retries, cancellation and node failover.
//
// Components and stores should use this client (directly or through
// `chainData.js`) for read requests. Writes use the action queue with
// hive-tx/Keychain/SmartLock because they need the signing stack.

import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'
import {
  recordApiAttempt,
  recordApiFailover,
  recordApiRequest,
  recordApiRetry
} from './telemetry'

export const DEFAULT_API_TIMEOUT_MS = 8000
export const DEFAULT_API_RETRIES = 1
export const DEFAULT_API_RETRY_DELAY_MS = 100
export const NODE_COOLDOWN_BASE_MS = 15000
export const NODE_COOLDOWN_MAX_MS = 5 * 60 * 1000

export class HiveApiError extends Error {
  constructor (message, { method, node, code = null, attempts = 0, cause = null } = {}) {
    super(message)
    this.name = 'HiveApiError'
    this.method = method
    this.node = node
    this.code = code
    this.attempts = attempts
    this.cause = cause
  }
}

let currentNode = DEFAULT_HIVE_NODE
let configuredNodes = [...HIVE_API_NODES]
let defaultTimeoutMs = DEFAULT_API_TIMEOUT_MS
let defaultRetries = DEFAULT_API_RETRIES
let defaultRetryDelayMs = DEFAULT_API_RETRY_DELAY_MS
let requestCounter = 0

const nodeHealth = new Map()

function nodeState (node) {
  if (!nodeHealth.has(node)) {
    nodeHealth.set(node, {
      failures: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      cooldownUntil: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      lastLatency: null
    })
  }
  return nodeHealth.get(node)
}

function noteNodeSuccess (node, latencyMs) {
  const state = nodeState(node)
  state.failures = 0
  state.cooldownUntil = 0
  state.totalSuccesses += 1
  state.lastSuccessAt = Date.now()
  state.lastLatency = Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : state.lastLatency
}

function noteNodeFailure (node) {
  const state = nodeState(node)
  state.failures += 1
  state.totalFailures += 1
  state.lastFailureAt = Date.now()
  const backoff = Math.min(NODE_COOLDOWN_MAX_MS, NODE_COOLDOWN_BASE_MS * Math.pow(2, Math.min(4, state.failures - 1)))
  state.cooldownUntil = Date.now() + backoff
}

function isCoolingDown (node, now = Date.now()) {
  const state = nodeHealth.get(node)
  return Boolean(state && state.cooldownUntil > now)
}

export function configureApi (options = {}) {
  if (options.node) {
    currentNode = options.node
    // An explicit node choice should be tried immediately even if an earlier
    // automatic failover put it into cooldown.
    nodeHealth.delete(options.node)
  }
  if (Array.isArray(options.nodes) && options.nodes.length > 0) {
    configuredNodes = [...new Set([options.node, ...options.nodes].filter(Boolean))]
    if (!options.node && !configuredNodes.includes(currentNode)) currentNode = configuredNodes[0]
  }
  if (Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0) {
    defaultTimeoutMs = Number(options.timeoutMs)
  }
  if (Number.isFinite(Number(options.retries)) && Number(options.retries) >= 0) {
    defaultRetries = Number(options.retries)
  }
  if (Number.isFinite(Number(options.retryDelayMs)) && Number(options.retryDelayMs) >= 0) {
    defaultRetryDelayMs = Number(options.retryDelayMs)
  }
  return {
    node: currentNode,
    nodes: [...configuredNodes],
    timeoutMs: defaultTimeoutMs,
    retries: defaultRetries,
    retryDelayMs: defaultRetryDelayMs
  }
}

export function getApiNode () {
  return currentNode
}

export function getApiConfig () {
  return {
    node: currentNode,
    nodes: [...configuredNodes],
    timeoutMs: defaultTimeoutMs,
    retries: defaultRetries,
    retryDelayMs: defaultRetryDelayMs
  }
}

/** Per-node health derived from the current session, for diagnostics and tests. */
export function getApiNodeHealth () {
  return [...new Set([currentNode, ...configuredNodes])].filter(Boolean).map(node => {
    const state = nodeState(node)
    return {
      url: node,
      active: node === currentNode,
      coolingDown: state.cooldownUntil > Date.now(),
      cooldownUntil: state.cooldownUntil,
      consecutiveFailures: state.failures,
      failures: state.totalFailures,
      successes: state.totalSuccesses,
      lastLatency: state.lastLatency,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt
    }
  })
}

/** Test helper: restore the default client state. */
export function resetApiClient (options = {}) {
  currentNode = options.node || options.nodes?.[0] || DEFAULT_HIVE_NODE
  configuredNodes = [...(options.nodes || HIVE_API_NODES)]
  defaultTimeoutMs = Number(options.timeoutMs) || DEFAULT_API_TIMEOUT_MS
  defaultRetries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : DEFAULT_API_RETRIES
  defaultRetryDelayMs = Number.isFinite(Number(options.retryDelayMs))
    ? Number(options.retryDelayMs)
    : DEFAULT_API_RETRY_DELAY_MS
  requestCounter = 0
  nodeHealth.clear()
}

function abortError () {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function isAbortError (error) {
  return error?.name === 'AbortError'
}

function candidatesFor (options = {}) {
  const preferred = options.node
  const explicit = Array.isArray(options.nodes) && options.nodes.length > 0 ? options.nodes : configuredNodes
  const candidates = [...new Set([preferred, currentNode, ...explicit].filter(Boolean))]
  const available = candidates.filter(node => !isCoolingDown(node))
  // If every node is cooling down, try them anyway rather than failing without
  // a network attempt. This is what stops a transient outage becoming a dead page.
  return available.length > 0 ? available : candidates
}

function sleep (ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestNode (node, method, params, { timeoutMs, signal, cache }) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const forwardAbort = () => controller.abort()
  if (signal) signal.addEventListener('abort', forwardAbort, { once: true })

  try {
    const response = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++requestCounter,
        method,
        params
      }),
      ...(cache ? { cache } : {}),
      signal: controller.signal
    })

    if (!response.ok) {
      const error = new Error('HTTP ' + response.status)
      error.status = response.status
      error.code = response.status
      throw error
    }
    const data = await response.json()
    if (data?.error) {
      const error = new Error(data.error.message || 'RPC request failed')
      error.code = data.error.code
      error.data = data.error.data
      throw error
    }
    return data?.result
  } catch (error) {
    if (signal?.aborted) throw abortError()
    if (timedOut) {
      const timeout = new Error('Request timed out after ' + timeoutMs + 'ms')
      timeout.name = 'TimeoutError'
      throw timeout
    }
    throw error
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', forwardAbort)
  }
}

/**
 * Send a JSON-RPC request to the configured node, moving to the next known node
 * when an attempt fails. `retries` is the number of extra attempts, capped by
 * the number of configured nodes. Failed nodes cool down briefly so a dead
 * endpoint does not slow every subsequent read.
 */
export async function rpcRequest (method, params = [], options = {}) {
  if (typeof method !== 'string' || !method) throw new HiveApiError('A JSON-RPC method is required', { method })
  const signal = options.signal
  if (signal?.aborted) throw abortError()
  const cache = options.cache

  const timeoutMs = Number(options.timeoutMs) || defaultTimeoutMs
  const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : defaultRetries
  const retryDelayMs = Number.isFinite(Number(options.retryDelayMs))
    ? Number(options.retryDelayMs)
    : defaultRetryDelayMs
  const candidates = candidatesFor(options)
  const attempts = Math.max(1, Math.min(candidates.length, retries + 1))

  const requestStarted = Date.now()
  let lastError = null
  let attemptsMade = 0
  let retriesMade = 0
  let failoversMade = 0
  let previousNode = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) {
      recordApiRequest({
        method,
        node: previousNode || candidates[0],
        ok: false,
        aborted: true,
        attempts: attemptsMade,
        retries: retriesMade,
        failovers: failoversMade,
        durationMs: Date.now() - requestStarted
      })
      throw abortError()
    }

    const node = candidates[attempt % candidates.length]
    if (previousNode && node !== previousNode) {
      failoversMade += 1
      recordApiFailover({ method, from: previousNode, to: node, reason: lastError?.message || '' })
    }
    previousNode = node

    attemptsMade++
    const attemptStarted = Date.now()

    try {
      const result = await requestNode(node, method, params, { timeoutMs, signal, cache })
      const durationMs = Date.now() - attemptStarted
      noteNodeSuccess(node, durationMs)
      recordApiAttempt({ method, node, ok: true, durationMs })
      recordApiRequest({
        method,
        node,
        ok: true,
        durationMs: Date.now() - requestStarted,
        attempts: attemptsMade,
        retries: retriesMade,
        failovers: failoversMade
      })
      currentNode = node
      return result
    } catch (error) {
      const durationMs = Date.now() - attemptStarted
      const timedOut = error?.name === 'TimeoutError'
      const aborted = isAbortError(error) && Boolean(signal?.aborted)
      if (error && typeof error === 'object' && !error.node) error.node = node
      lastError = error

      if (aborted) {
        recordApiAttempt({ method, node, ok: false, durationMs, aborted: true })
        recordApiRequest({
          method,
          node,
          ok: false,
          aborted: true,
          attempts: attemptsMade,
          retries: retriesMade,
          failovers: failoversMade,
          durationMs: Date.now() - requestStarted
        })
        throw error
      }

      noteNodeFailure(node)
      recordApiAttempt({ method, node, ok: false, durationMs, timedOut, code: error?.code ?? null })

      if (attempt < attempts - 1) {
        retriesMade += 1
        recordApiRetry({ method, node, attempt: attemptsMade, error: error?.message || '' })
        await sleep(retryDelayMs)
      }
    }
  }

  const message = lastError?.message || 'Hive API request failed'
  recordApiRequest({
    method,
    node: lastError?.node || candidates[0],
    ok: false,
    durationMs: Date.now() - requestStarted,
    attempts: attemptsMade,
    retries: retriesMade,
    failovers: failoversMade,
    timedOut: lastError?.name === 'TimeoutError',
    code: lastError?.code ?? null,
    error: message
  })
  throw new HiveApiError(message, {
    method,
    node: lastError?.node || candidates[0],
    code: lastError?.code ?? null,
    attempts: attemptsMade,
    cause: lastError
  })
}

export function apiGetAccounts (names, options = {}) {
  return rpcRequest('condenser_api.get_accounts', [Array.isArray(names) ? names : [names]], options)
}

export function apiGetGlobalProps (options = {}) {
  return rpcRequest('condenser_api.get_dynamic_global_properties', [], options)
}

export function apiGetWitnessesByVote (limit = 200, options = {}) {
  return rpcRequest('condenser_api.get_witnesses_by_vote', ['', limit], options)
}

export function apiGetWitnessByAccount (account, options = {}) {
  return rpcRequest('condenser_api.get_witness_by_account', [account], options)
}

export function apiGetFollowCount (account, options = {}) {
  return rpcRequest('condenser_api.get_follow_count', [account], options)
}

export function apiGetAccountHistory (account, from = -1, limit = 100, options = {}) {
  return rpcRequest('condenser_api.get_account_history', [account, from, limit], options)
}

export function apiGetAccountHistoryFiltered (account, from = -1, limit = 100, low = null, high = null, options = {}) {
  return rpcRequest('condenser_api.get_account_history', [account, from, limit, low, high], options)
}

export function apiGetActiveVotes (author, permlink, options = {}) {
  return rpcRequest('condenser_api.get_active_votes', [author, permlink], options)
}

export function apiGetContent (author, permlink, options = {}) {
  return rpcRequest('condenser_api.get_content', [author, permlink], options)
}

export function apiGetFollowers (account, start = '', limit = 100, options = {}) {
  return rpcRequest('condenser_api.get_followers', [account, start, 'blog', limit], options)
}

export function apiGetFollowing (account, start = '', limit = 100, options = {}) {
  return rpcRequest('condenser_api.get_following', [account, start, 'blog', limit], options)
}

export function apiGetMedianHistoryPrice (options = {}) {
  return rpcRequest('condenser_api.get_current_median_history_price', [], options)
}

export function apiGetRewardFund (name = 'post', options = {}) {
  return rpcRequest('condenser_api.get_reward_fund', [name], options)
}

export function apiGetTicker (options = {}) {
  return rpcRequest('condenser_api.get_ticker', [], options)
}

export function apiGetOpenOrders (account, options = {}) {
  return rpcRequest('condenser_api.get_open_orders', [account], options)
}

export function bridgeRequest (method, params = {}, options = {}) {
  return rpcRequest('bridge.' + method, params, options)
}

// -- Unified search reads -----------------------------------------------------
//
// Public Hivemind nodes expose `list_communities`, `get_ranked_posts` and
// `get_account_posts` on the bridge plugin; `search_accounts` and
// `search_ranked_posts` are not enabled on any of the configured nodes, so
// account lookup uses `condenser_api.lookup_accounts` and post search ranks
// candidate feeds locally.

/**
 * Account names matching a prefix. `lookup_accounts` is a prefix lookup, so
 * short or older names often need several prefixes; that expansion is handled
 * in `searchReads.js`, not here.
 */
export function apiLookupAccounts (lowerBound, limit = 10, options = {}) {
  return rpcRequest('condenser_api.lookup_accounts', [String(lowerBound || '').toLowerCase(), Math.min(1000, Math.max(1, limit))], options)
}

/** Ranked posts for a tag, community or global sort. */
export function apiRankedPosts (params, options = {}) {
  return bridgeRequest('get_ranked_posts', params, options)
}

export function apiListCommunities (params, options = {}) {
  return bridgeRequest('list_communities', params, options)
}

/** Communities an account subscribed to (`[name, title, role, guestTitle]` rows). */
export function apiListAllSubscriptions (params, options = {}) {
  return bridgeRequest('list_all_subscriptions', params, options)
}

export function apiBlockHeader (blockNum, options = {}) {
  return rpcRequest('condenser_api.get_block_header', [Number(blockNum)], options)
}
