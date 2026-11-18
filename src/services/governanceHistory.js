// Bounded local history for governance analytics.
//
// The chain exposes cumulative missed-block counters and the latest-price-feed
// timestamp, but no per-witness trend feed. Recording a small snapshot each
// visit lets the analytics cards show what changed since the first visit
// without adding a backend or polling in the background.
//
// Snapshots are deliberately bounded (30 entries, at most one every six hours)
// and stored locally. A missing/full localStorage must never break a page.

export const HISTORY_KEY = 'hive.governance.history.v1'
export const MAX_SNAPSHOTS = 30
export const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000

function storageOrNull (storage) {
  if (storage) return storage
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

function safeNumber (value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeSnapshot (snapshot) {
  if (!snapshot || !Number.isFinite(Number(snapshot.at)) || !Array.isArray(snapshot.witnesses)) return null
  return {
    at: Number(snapshot.at),
    witnesses: snapshot.witnesses
      .filter(row => row && typeof row.owner === 'string')
      .map(row => ({
        owner: row.owner,
        missed: safeNumber(row.missed),
        lastConfirmed: safeNumber(row.lastConfirmed),
        feedAt: row.feedAt || null,
        version: typeof row.version === 'string' ? row.version : ''
      }))
  }
}

/** Read normalised snapshots oldest-first. Invalid/corrupt entries are dropped. */
export function loadHistory (storage = null) {
  const store = storageOrNull(storage)
  if (!store) return []
  try {
    const raw = store.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeSnapshot)
      .filter(Boolean)
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_SNAPSHOTS)
  } catch {
    return []
  }
}

export function saveHistory (history, storage = null) {
  const store = storageOrNull(storage)
  if (!store) return []
  const normalized = (Array.isArray(history) ? history : [])
    .map(normalizeSnapshot)
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_SNAPSHOTS)
  try {
    store.setItem(HISTORY_KEY, JSON.stringify(normalized))
  } catch {
    // Quota or private-mode failures leave the in-memory history usable.
  }
  return normalized
}

export function snapshotWitnesses (witnesses, now = Date.now()) {
  return {
    at: Number(now),
    witnesses: (Array.isArray(witnesses) ? witnesses : [])
      .filter(witness => witness?.owner)
      .map(witness => ({
        owner: witness.owner,
        missed: safeNumber(witness.total_missed),
        lastConfirmed: safeNumber(witness.last_confirmed_block_num),
        feedAt: witness.last_hbd_exchange_update || null,
        version: witness.running_version || ''
      }))
  }
}

/**
 * Record a snapshot. A snapshot inside the six-hour window replaces the newest
 * entry so a page refresh does not create a flat point in the trend.
 */
export function recordSnapshot (witnesses, { now = Date.now(), storage = null, force = false } = {}) {
  const history = loadHistory(storage)
  const snapshot = snapshotWitnesses(witnesses, now)
  if (snapshot.witnesses.length === 0) return history

  const last = history[history.length - 1]
  if (last && !force && snapshot.at - last.at < SNAPSHOT_INTERVAL_MS) {
    history[history.length - 1] = snapshot
  } else {
    history.push(snapshot)
  }

  return saveHistory(history, storage)
}

export function clearHistory (storage = null) {
  const store = storageOrNull(storage)
  if (!store) return
  try {
    store.removeItem(HISTORY_KEY)
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Network-wide change since the first recorded snapshot.
 *
 * `missedDelta` is the sum of each witness's cumulative counter, so it measures
 * newly missed blocks across the set. `feedsUpdated` counts witnesses whose
 * last feed timestamp moved forward.
 */
export function networkTrend (history) {
  const snapshots = Array.isArray(history) ? history : []
  const first = snapshots[0] || null
  const last = snapshots[snapshots.length - 1] || null
  if (!first || !last || first === last) {
    return {
      available: false,
      snapshots: snapshots.length,
      firstAt: first?.at || null,
      lastAt: last?.at || null,
      missedDelta: 0,
      feedsUpdated: 0,
      witnessesTracked: last?.witnesses?.length || 0
    }
  }

  const previous = new Map(first.witnesses.map(row => [row.owner, row]))
  let missedDelta = 0
  let feedsUpdated = 0

  for (const row of last.witnesses) {
    const before = previous.get(row.owner)
    if (!before) continue
    missedDelta += Math.max(0, row.missed - before.missed)
    if (before.feedAt && row.feedAt && row.feedAt !== before.feedAt) feedsUpdated += 1
  }

  return {
    available: true,
    snapshots: snapshots.length,
    firstAt: first.at,
    lastAt: last.at,
    missedDelta,
    feedsUpdated,
    witnessesTracked: last.witnesses.length
  }
}

/** Missed-block delta for one witness between the first and last snapshot. */
export function witnessMissedTrend (history, owner) {
  const snapshots = Array.isArray(history) ? history : []
  if (!owner || snapshots.length < 2) {
    return { available: false, missedDelta: 0, firstAt: null, lastAt: null }
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const before = first.witnesses.find(row => row.owner === owner)
  const after = last.witnesses.find(row => row.owner === owner)
  if (!before || !after) {
    return { available: false, missedDelta: 0, firstAt: first.at, lastAt: last.at }
  }

  return {
    available: true,
    missedDelta: Math.max(0, after.missed - before.missed),
    firstAt: first.at,
    lastAt: last.at
  }
}
