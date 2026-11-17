// Small TTL cache and stale-while-revalidate helper.
//
// Entries keep their insertion time so callers can decide whether a value is
// fresh, stale but usable, or missing. Revalidations are de-duplicated so a
// burst of components asking for the same account results in one request.

export function createTtlCache ({ maxEntries = 300, now = () => Date.now() } = {}) {
  const entries = new Map()

  function getEntry (key) {
    const entry = entries.get(key)
    if (!entry) return null
    return { ...entry, age: Math.max(0, now() - entry.at) }
  }

  function set (key, value, { ttl = 30000 } = {}) {
    if (!key) return value
    if (entries.has(key)) entries.delete(key)
    entries.set(key, { value, at: now(), ttl })
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value)
    }
    return value
  }

  return {
    get (key) {
      return getEntry(key)
    },
    set,
    delete (key) {
      return entries.delete(key)
    },
    clear () {
      entries.clear()
    },
    get size () {
      return entries.size
    },
    keys () {
      return [...entries.keys()]
    }
  }
}

export const apiCache = createTtlCache({ maxEntries: 400 })
const inflight = new Map()

function revalidate (key, fetcher, ttl, cache) {
  if (inflight.has(key)) return inflight.get(key)
  const promise = Promise.resolve()
    .then(fetcher)
    .then(value => {
      cache.set(key, value, { ttl })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

/**
 * Read a cached value, using stale-while-revalidate when it has exceeded `ttl`.
 * `onStale` is called synchronously when stale data is returned so a page can
 * show a stale/refreshing indicator without blocking.
 */
export async function loadCached (key, fetcher, {
  ttl = 30000,
  force = false,
  swr = true,
  cache = apiCache,
  onStale = null
} = {}) {
  const entry = cache.get(key)
  if (entry && !force) {
    if (entry.age <= ttl) return entry.value
    if (swr) {
      if (typeof onStale === 'function') onStale(entry)
      revalidate(key, fetcher, ttl, cache).catch(() => {})
      return entry.value
    }
  }

  return revalidate(key, fetcher, ttl, cache)
}

export function invalidateCache (prefix, cache = apiCache) {
  let removed = 0
  for (const key of cache.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      cache.delete(key)
      removed++
    }
  }
  return removed
}

export function clearCache (cache = apiCache) {
  cache.clear()
  inflight.clear()
}
