// Local read-only data snapshots for offline and failed-refresh states.
//
// Snapshots are deliberately separate from the in-memory API cache: they
// survive reloads, are only written after a successful read, and always carry
// their timestamp so the UI can label stale data instead of pretending it is
// live. Signing never reads from these snapshots.

export const SNAPSHOT_PREFIX = 'hive:snapshot:'
export const DEFAULT_SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_SNAPSHOT_BYTES = 512 * 1024

function getStorage (storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

export function snapshotStorageKey (name) {
  return SNAPSHOT_PREFIX + String(name || '')
}

export function saveSnapshot (name, data, {
  storage,
  now = Date.now(),
  ttlMs = DEFAULT_SNAPSHOT_TTL_MS,
  maxBytes = MAX_SNAPSHOT_BYTES
} = {}) {
  if (!name) return false
  const target = getStorage(storage)
  if (!target) return false
  try {
    const payload = JSON.stringify({ savedAt: now, ttlMs, data })
    if (payload.length > maxBytes) return false
    target.setItem(snapshotStorageKey(name), payload)
    return true
  } catch {
    return false
  }
}

/** Returns `{ data, savedAt, ageMs }`, or null when absent/expired/corrupt. */
export function loadSnapshot (name, {
  storage,
  now = Date.now(),
  ttlMs = DEFAULT_SNAPSHOT_TTL_MS
} = {}) {
  if (!name) return null
  const target = getStorage(storage)
  if (!target) return null
  try {
    const parsed = JSON.parse(target.getItem(snapshotStorageKey(name)) || 'null')
    if (!parsed || !Number.isFinite(Number(parsed.savedAt))) return null
    const savedAt = Number(parsed.savedAt)
    const maxAge = Number.isFinite(Number(parsed.ttlMs)) ? Number(parsed.ttlMs) : ttlMs
    const ageMs = Math.max(0, now - savedAt)
    if (ageMs > maxAge) {
      target.removeItem(snapshotStorageKey(name))
      return null
    }
    return { data: parsed.data, savedAt, ageMs }
  } catch {
    return null
  }
}

export function removeSnapshot (name, { storage } = {}) {
  const target = getStorage(storage)
  if (!target || !name) return false
  try {
    target.removeItem(snapshotStorageKey(name))
    return true
  } catch {
    return false
  }
}

/** Remove every saved snapshot whose logical name starts with `prefix`. */
export function removeSnapshotsByPrefix (prefix, { storage } = {}) {
  const target = getStorage(storage)
  const keyPrefix = snapshotStorageKey(prefix)
  if (!target || !keyPrefix) return 0
  let removed = 0
  try {
    for (let index = target.length - 1; index >= 0; index--) {
      const key = target.key(index)
      if (key && key.startsWith(keyPrefix)) {
        target.removeItem(key)
        removed++
      }
    }
  } catch {
    // Storage enumeration can throw in hardened privacy modes.
  }
  return removed
}

/** Remove expired snapshots; called opportunistically by the home dashboard. */
export function pruneSnapshots ({ storage, now = Date.now(), ttlMs = DEFAULT_SNAPSHOT_TTL_MS } = {}) {
  const target = getStorage(storage)
  if (!target) return 0
  let removed = 0
  try {
    for (let index = target.length - 1; index >= 0; index--) {
      const key = target.key(index)
      if (!key || !key.startsWith(SNAPSHOT_PREFIX)) continue
      try {
        const parsed = JSON.parse(target.getItem(key) || 'null')
        const savedAt = Number(parsed?.savedAt)
        const maxAge = Number.isFinite(Number(parsed?.ttlMs)) ? Number(parsed.ttlMs) : ttlMs
        if (!Number.isFinite(savedAt) || now - savedAt > maxAge) {
          target.removeItem(key)
          removed++
        }
      } catch {
        target.removeItem(key)
        removed++
      }
    }
  } catch {
    // Storage enumeration can throw in hardened privacy modes.
  }
  return removed
}
