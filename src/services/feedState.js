// In-memory continuity cache for browse feeds.
//
// A route change remounts the browse page, so without this the reader loses
// every page loaded beyond the first snapshot page. The cache stores the post
// objects by reference, which is cheap during a session and lets the router's
// savedPosition restore a document tall enough to hold the original scroll.

const DEFAULT_TTL_MS = 5 * 60 * 1000
const MAX_FEEDS = 12

const feeds = new Map()

export function saveFeedState (key, { posts, hasMore, cachedAt } = {}) {
  if (!key) return false
  if (!Array.isArray(posts) || posts.length === 0) return false
  feeds.delete(key)
  feeds.set(key, {
    posts,
    hasMore: hasMore === true,
    cachedAt: cachedAt || null,
    savedAt: Date.now()
  })
  while (feeds.size > MAX_FEEDS) {
    feeds.delete(feeds.keys().next().value)
  }
  return true
}

export function loadFeedState (key, { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!key) return null
  const state = feeds.get(key)
  if (!state) return null
  if (now - state.savedAt > ttlMs) {
    feeds.delete(key)
    return null
  }
  return state
}

export function clearFeedState (key) {
  return feeds.delete(key)
}

/** Test helper: drop every cached feed. */
export function resetFeedStates () {
  feeds.clear()
}
