// Structured telemetry for the central API client and the read cache.
//
// The module is deliberately dependency-free so it can be imported from the
// service worker-facing tests, the API client and the cache without creating a
// startup cycle. It keeps bounded in-memory samples: enough for a session-level
// reliability view without growing into an unbounded log.

export const TELEMETRY_MAX_EVENTS = 250
export const TELEMETRY_MAX_LATENCIES = 1000

const state = {
  startedAt: Date.now(),
  requests: 0,
  successes: 0,
  failures: 0,
  aborted: 0,
  attempts: 0,
  retries: 0,
  failovers: 0,
  timeouts: 0,
  cacheHits: 0,
  cacheMisses: 0,
  staleHits: 0,
  latencies: [],
  nodes: new Map(),
  methods: new Map(),
  events: [],
  listeners: new Set()
}

function percentile (values, ratio) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function average (values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round (value, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}

function bucket (map, key) {
  const id = key || 'unknown'
  if (!map.has(id)) {
    map.set(id, {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      totalLatency: 0,
      latencySamples: 0,
      lastLatency: null,
      lastSuccessAt: null,
      lastFailureAt: null
    })
  }
  return map.get(id)
}

function pushEvent (event) {
  state.events.push({ t: Date.now(), ...event })
  if (state.events.length > TELEMETRY_MAX_EVENTS) {
    state.events.splice(0, state.events.length - TELEMETRY_MAX_EVENTS)
  }
  for (const listener of state.listeners) {
    try {
      listener(event)
    } catch {
      // A telemetry observer must never break a network request.
    }
  }
}

function addLatency (durationMs) {
  const value = Number(durationMs)
  if (!Number.isFinite(value) || value < 0) return
  state.latencies.push(value)
  if (state.latencies.length > TELEMETRY_MAX_LATENCIES) {
    state.latencies.splice(0, state.latencies.length - TELEMETRY_MAX_LATENCIES)
  }
}

/** Record one transport attempt against a specific node. */
export function recordApiAttempt ({
  method = '',
  node = '',
  ok = false,
  durationMs = 0,
  timedOut = false,
  aborted = false,
  code = null
} = {}) {
  state.attempts += 1
  if (timedOut) state.timeouts += 1

  const nodeStats = bucket(state.nodes, node)
  nodeStats.requests += 1
  if (ok) {
    nodeStats.successes += 1
    nodeStats.lastSuccessAt = Date.now()
  } else {
    nodeStats.failures += 1
    nodeStats.lastFailureAt = Date.now()
  }
  if (timedOut) nodeStats.timeouts += 1

  if (Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0) {
    nodeStats.totalLatency += Number(durationMs)
    nodeStats.latencySamples += 1
    nodeStats.lastLatency = Number(durationMs)
    if (!aborted) addLatency(durationMs)
  }

  pushEvent({
    type: 'attempt',
    method,
    node,
    ok,
    durationMs: round(durationMs),
    timedOut,
    aborted,
    code
  })
}

/** Record the terminal outcome of one logical request (which may use retries). */
export function recordApiRequest ({
  method = '',
  node = '',
  ok = false,
  durationMs = 0,
  attempts = 1,
  retries = 0,
  failovers = 0,
  timedOut = false,
  aborted = false,
  code = null,
  error = ''
} = {}) {
  state.requests += 1
  state.retries += Number(retries) || 0
  state.failovers += Number(failovers) || 0

  if (aborted) state.aborted += 1
  else if (ok) state.successes += 1
  else state.failures += 1

  const methodStats = bucket(state.methods, method)
  methodStats.requests += 1
  if (ok) {
    methodStats.successes += 1
    methodStats.lastSuccessAt = Date.now()
  } else {
    methodStats.failures += 1
    methodStats.lastFailureAt = Date.now()
  }
  if (timedOut) methodStats.timeouts += 1

  pushEvent({
    type: 'request',
    method,
    node,
    ok,
    durationMs: round(durationMs),
    attempts,
    retries,
    failovers,
    timedOut,
    aborted,
    code,
    error: String(error || '').slice(0, 160)
  })
}

/** Record a retry transition between attempts. */
export function recordApiRetry ({ method = '', node = '', attempt = 0, error = '' } = {}) {
  pushEvent({ type: 'retry', method, node, attempt, error: String(error || '').slice(0, 160) })
}

/** Record a node rotation caused by a failed attempt. */
export function recordApiFailover ({ method = '', from = '', to = '', reason = '' } = {}) {
  pushEvent({ type: 'failover', method, from, to, reason: String(reason || '').slice(0, 160) })
}

/** Record a read-cache lookup. */
export function recordCacheEvent ({ key = '', hit = false, stale = false } = {}) {
  if (hit) {
    state.cacheHits += 1
    if (stale) state.staleHits += 1
  } else {
    state.cacheMisses += 1
  }
  pushEvent({ type: 'cache', key, hit, stale })
}

/** Record a Vue error-boundary catch without leaking stack traces. */
export function recordUiError ({ info = '', message = '' } = {}) {
  pushEvent({ type: 'ui-error', info, message: String(message || '').slice(0, 160) })
}

export function subscribeTelemetry (listener) {
  if (typeof listener !== 'function') return () => {}
  state.listeners.add(listener)
  return () => state.listeners.delete(listener)
}

function snapshotMap (map) {
  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      requests: value.requests,
      successes: value.successes,
      failures: value.failures,
      timeouts: value.timeouts,
      successRate: value.requests ? round((value.successes / value.requests) * 100) : null,
      averageLatency: value.latencySamples ? round(value.totalLatency / value.latencySamples) : null,
      lastLatency: value.lastLatency,
      lastSuccessAt: value.lastSuccessAt,
      lastFailureAt: value.lastFailureAt
    }))
    .sort((a, b) => b.requests - a.requests)
}

/** A plain-object snapshot suitable for the UI, logs or E2E assertions. */
export function getTelemetrySnapshot () {
  const completed = state.successes + state.failures
  const cacheLookups = state.cacheHits + state.cacheMisses
  return {
    startedAt: state.startedAt,
    uptimeMs: Math.max(0, Date.now() - state.startedAt),
    requests: {
      total: state.requests,
      successes: state.successes,
      failures: state.failures,
      aborted: state.aborted,
      successRate: completed ? round((state.successes / completed) * 100) : null
    },
    attempts: {
      total: state.attempts,
      retries: state.retries,
      failovers: state.failovers,
      timeouts: state.timeouts
    },
    latency: {
      samples: state.latencies.length,
      average: round(average(state.latencies)),
      p50: round(percentile(state.latencies, 0.5)),
      p95: round(percentile(state.latencies, 0.95)),
      max: state.latencies.length ? Math.max(...state.latencies) : null
    },
    cache: {
      hits: state.cacheHits,
      misses: state.cacheMisses,
      staleHits: state.staleHits,
      hitRate: cacheLookups ? round((state.cacheHits / cacheLookups) * 100) : null
    },
    nodes: snapshotMap(state.nodes),
    methods: snapshotMap(state.methods),
    recent: state.events.slice(-40)
  }
}

if (typeof window !== 'undefined') {
  // Read-only diagnostics handle. W24 owns the developer panel; this keeps the
  // contract inspectable from the console and browser smoke tests today.
  window.__hiveTelemetry = Object.freeze({
    snapshot: getTelemetrySnapshot,
    subscribe: subscribeTelemetry
  })
}

/** Test helper: clear counters and samples. */
export function resetTelemetry () {
  state.startedAt = Date.now()
  state.requests = 0
  state.successes = 0
  state.failures = 0
  state.aborted = 0
  state.attempts = 0
  state.retries = 0
  state.failovers = 0
  state.timeouts = 0
  state.cacheHits = 0
  state.cacheMisses = 0
  state.staleHits = 0
  state.latencies = []
  state.nodes.clear()
  state.methods.clear()
  state.events = []
}
