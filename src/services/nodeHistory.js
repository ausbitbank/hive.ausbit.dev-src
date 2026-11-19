// Small localStorage-backed latency history for the API node status page.
//
// Preferences are kept separately from account settings so they survive a
// settings save from the existing settings panel, which rebuilds the settings
// object from known fields.

export const NODE_HISTORY_KEY = 'nodeLatencyHistory'
export const NODE_PREFS_KEY = 'nodeMonitorPrefs'
export const MAX_SAMPLES = 24
export const SAMPLE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getStorage (storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or a blocked storage implementation.
  }
  return null
}

export function recordSamples (history, nodes, now = Date.now()) {
  const next = history && typeof history === 'object' ? { ...history } : {}
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node?.url) continue
    const previous = Array.isArray(next[node.url]) ? next[node.url] : []
    const sample = {
      t: now,
      ok: Boolean(node.ok),
      latency: node.ok && Number.isFinite(Number(node.latency)) ? Math.round(Number(node.latency)) : null,
      head: node.ok && Number.isFinite(Number(node.head)) ? Number(node.head) : null,
      headTime: node.ok && node.headTime ? String(node.headTime) : null,
      error: node.ok ? null : (node.error || 'Unreachable')
    }
    next[node.url] = previous.concat(sample).slice(-MAX_SAMPLES)
  }
  return next
}

export function latencySummary (history, url, limit = 12) {
  const samples = Array.isArray(history?.[url]) ? history[url].slice(-Math.max(1, limit)) : []
  const successful = samples.filter(sample => sample.ok && Number.isFinite(sample.latency))
  const values = successful.map(sample => sample.latency)
  const latest = samples.length ? samples[samples.length - 1] : null
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const min = values.length ? Math.min(...values) : null
  const max = values.length ? Math.max(...values) : null
  const first = values.length ? values[0] : null
  const last = values.length ? values[values.length - 1] : null
  const trend = first !== null && last !== null ? last - first : null

  return {
    samples,
    values,
    latest,
    average,
    min,
    max,
    trend
  }
}

export function pruneHistory (history, now = Date.now(), ttl = SAMPLE_TTL_MS) {
  const next = {}
  for (const [url, samples] of Object.entries(history || {})) {
    if (!Array.isArray(samples)) continue
    const keep = samples
      .filter(sample => sample && Number.isFinite(Number(sample.t)) && now - Number(sample.t) <= ttl)
      .slice(-MAX_SAMPLES)
    if (keep.length) next[url] = keep
  }
  return next
}

export function loadNodeHistory (storage) {
  const target = getStorage(storage)
  if (!target) return {}
  try {
    const parsed = JSON.parse(target.getItem(NODE_HISTORY_KEY) || '{}')
    return pruneHistory(parsed)
  } catch {
    return {}
  }
}

export function saveNodeHistory (history, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.setItem(NODE_HISTORY_KEY, JSON.stringify(pruneHistory(history)))
    return true
  } catch {
    return false
  }
}

export function defaultNodePrefs () {
  return {
    autoFailover: true,
    autoSelectFastest: false,
    includeWatched: true,
    requireFeatures: false
  }
}

export function loadNodePrefs (storage) {
  const target = getStorage(storage)
  if (!target) return defaultNodePrefs()
  try {
    const parsed = JSON.parse(target.getItem(NODE_PREFS_KEY) || '{}')
    return {
      autoFailover: parsed.autoFailover !== false,
      autoSelectFastest: parsed.autoSelectFastest === true,
      includeWatched: parsed.includeWatched !== false,
      requireFeatures: parsed.requireFeatures === true
    }
  } catch {
    return defaultNodePrefs()
  }
}

export function saveNodePrefs (prefs, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.setItem(NODE_PREFS_KEY, JSON.stringify({
      autoFailover: prefs?.autoFailover !== false,
      autoSelectFastest: prefs?.autoSelectFastest === true,
      includeWatched: prefs?.includeWatched !== false,
      requireFeatures: prefs?.requireFeatures === true
    }))
    return true
  } catch {
    return false
  }
}
