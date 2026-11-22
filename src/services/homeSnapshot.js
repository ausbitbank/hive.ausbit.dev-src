// Pre-warmed home data, published at build time and optionally served by the
// edge. The snapshot is only used to paint the first frame: every widget still
// refreshes from the chain and replaces it as soon as a live read lands.
//
// The build script injects a `<script type="application/json" id="home-snapshot">`
// block into the home shell so a cold first visit can render without waiting
// for a public node. Other shells (and client-side navigation to `/`) fall back
// to `/home-snapshot.json`, which can be served statically or by a Worker.

const SNAPSHOT_VERSION = 1
const ELEMENT_ID = 'home-snapshot'
const SNAPSHOT_URL = '/home-snapshot.json'
export const HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

let loaded = false
let current = null
let readyPromise = null

function isObject (value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalise (raw) {
  if (!isObject(raw) || Number(raw.version) !== SNAPSHOT_VERSION) return null
  const generatedAt = Number(raw.generatedAt)
  if (!Number.isFinite(generatedAt) || generatedAt <= 0) return null
  return { ...raw, generatedAt }
}

function readInline () {
  if (typeof document === 'undefined') return null
  const node = document.getElementById(ELEMENT_ID)
  if (!node) return null
  try {
    return normalise(JSON.parse(node.textContent || ''))
  } catch {
    return null
  }
}

/**
 * The freshest usable snapshot, read synchronously. Returns null on the server,
 * when no snapshot was published, or when the published one is older than
 * `maxAgeMs`.
 */
export function getHomeSnapshot ({ now = Date.now(), maxAgeMs = HOME_SNAPSHOT_MAX_AGE_MS } = {}) {
  if (!loaded) {
    loaded = true
    current = readInline()
  }
  if (!current) return null
  if (now - current.generatedAt > maxAgeMs) return null
  return current
}

/** Age of the snapshot in milliseconds, or null when there is no snapshot. */
export function homeSnapshotAgeMs (snapshot = getHomeSnapshot(), now = Date.now()) {
  if (!snapshot) return null
  return Math.max(0, now - snapshot.generatedAt)
}

export function snapshotBlock () {
  return getHomeSnapshot()?.block || null
}

export function snapshotMarket () {
  return getHomeSnapshot()?.market || null
}

export function snapshotWitnesses () {
  return getHomeSnapshot()?.witnesses || null
}

export function snapshotNetwork () {
  return getHomeSnapshot()?.network || null
}

/** One generated feed, keyed by `feed.key` (`global:trending`, ...). */
export function snapshotFeed (key) {
  if (!key) return null
  return getHomeSnapshot()?.feeds?.[key] || null
}

async function fetchSnapshot ({ timeoutMs = 500 } = {}) {
  if (typeof fetch !== 'function') return null
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer = null
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      controller?.abort()
      resolve(null)
    }, timeoutMs)
  })
  try {
    const response = await Promise.race([
      fetch(SNAPSHOT_URL, { signal: controller?.signal, headers: { accept: 'application/json' } }),
      timeout
    ])
    if (!response || !response.ok) return null
    return normalise(await response.json())
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Resolve the snapshot, fetching `/home-snapshot.json` when the inline copy is
 * absent. The timeout is deliberately short: a missing snapshot must never
 * delay the live read behind it.
 */
export function whenHomeSnapshot ({ timeoutMs = 500 } = {}) {
  const inline = getHomeSnapshot()
  if (inline) return Promise.resolve(inline)
  if (!readyPromise) {
    readyPromise = fetchSnapshot({ timeoutMs }).then(snapshot => {
      if (snapshot) {
        current = snapshot
        loaded = true
      }
      return snapshot
    }).catch(() => null)
  }
  return readyPromise
}

/** Test helper: forget the inline/fetched snapshot. */
export function resetHomeSnapshotForTests () {
  loaded = false
  current = null
  readyPromise = null
}
