// Central JSON-RPC client with timeouts, retries, cancellation and node failover.
//
// Components and stores should use this client (directly or through
// `chainData.js`) for read requests. Writes continue to use hive-js/Keychain/
// SmartLock because they need the signing stack.

import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'

export const DEFAULT_API_TIMEOUT_MS = 8000
export const DEFAULT_API_RETRIES = 1

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
let requestCounter = 0

export function configureApi (options = {}) {
  if (options.node) currentNode = options.node
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
  return { node: currentNode, nodes: [...configuredNodes], timeoutMs: defaultTimeoutMs, retries: defaultRetries }
}

export function getApiNode () {
  return currentNode
}

export function getApiConfig () {
  return {
    node: currentNode,
    nodes: [...configuredNodes],
    timeoutMs: defaultTimeoutMs,
    retries: defaultRetries
  }
}

/** Test helper: restore the default client state. */
export function resetApiClient (options = {}) {
  currentNode = options.node || options.nodes?.[0] || DEFAULT_HIVE_NODE
  configuredNodes = [...(options.nodes || HIVE_API_NODES)]
  defaultTimeoutMs = Number(options.timeoutMs) || DEFAULT_API_TIMEOUT_MS
  defaultRetries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : DEFAULT_API_RETRIES
  requestCounter = 0
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
  return [...new Set([preferred, currentNode, ...explicit].filter(Boolean))]
}

async function requestNode (node, method, params, { timeoutMs, signal }) {
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
      signal: controller.signal
    })

    if (!response.ok) throw new Error('HTTP ' + response.status)
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
 * the number of configured nodes.
 */
export async function rpcRequest (method, params = [], options = {}) {
  if (typeof method !== 'string' || !method) throw new HiveApiError('A JSON-RPC method is required', { method })
  const signal = options.signal
  if (signal?.aborted) throw abortError()

  const timeoutMs = Number(options.timeoutMs) || defaultTimeoutMs
  const retries = Number.isFinite(Number(options.retries)) ? Number(options.retries) : defaultRetries
  const candidates = candidatesFor(options)
  const attempts = Math.max(1, Math.min(candidates.length, retries + 1))

  let lastError = null
  let attemptsMade = 0

  for (let attempt = 0; attempt < attempts; attempt++) {
    const node = candidates[attempt % candidates.length]
    attemptsMade++
    try {
      const result = await requestNode(node, method, params, { timeoutMs, signal })
      currentNode = node
      return result
    } catch (error) {
      if (error && typeof error === 'object' && !error.node) error.node = node
      lastError = error
      if (isAbortError(error) && signal?.aborted) throw error
    }
  }

  const message = lastError?.message || 'Hive API request failed'
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

export function apiGetMedianHistoryPrice (options = {}) {
  return rpcRequest('condenser_api.get_current_median_history_price', [], options)
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
