// Client for the HiveSense semantic search API.
//
// HiveSense (https://tools.openhive.network/hivesense) runs an AI vector index
// of Hive posts and exposes a small REST surface under `<node>/hivesense-api/`:
//
//   GET /posts/search?q=...&result_limit=...&full_posts=...
//   GET /posts/{author}/{permlink}/similar?result_limit=...&full_posts=...
//   GET /authors/search?topic=...&result_limit=...
//
// The endpoints are CORS-open and anonymous. Only some API nodes run the
// service, so hosts are chosen from the beacon feature list (which advertises
// `hivesense_api`) with a small static fallback list. Requests never throw;
// callers get `{ ok: false }` so search can quietly fall back to local ranking.
//
// The public API is PostgREST. Its OpenAPI document is served from
// `<node>/hivesense-api/` and is the source of truth for parameters: the
// docs page's `limit` parameter is stale and silently ignored by the deployed
// service. `result_limit` is the total number of rows (full posts plus stubs),
// while `full_posts` is how many of the leading rows are hydrated. Rows beyond
// `full_posts` contain only `author`/`permlink`.
//
// Note: post results carry no similarity score. HiveSense returns them in
// relevance order, so callers must preserve array order rather than re-rank.

import { fetchBeaconNodes } from './beacon'
import { BEACON_API_BASE } from './hiveNodes'

export const HIVESENSE_PATH = '/hivesense-api'
export const HIVESENSE_MAX_RESULTS = 1000
export const HIVESENSE_MAX_FULL_POSTS = 50
export const HIVESENSE_TIMEOUT_MS = 8000
export const HIVESENSE_MIN_QUERY = 2

// Hosts known to run HiveSense. Ordered by observed latency; used when the
// beacon list is unavailable. `techcoderx.com` and `api.deathwing.me` return
// 503/404 for this service even though they are otherwise healthy, so they are
// deliberately absent.
export const HIVESENSE_HOSTS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info',
  'https://api.syncad.com',
  'https://api.c0ff33a.uk'
]

/**
 * Choose HiveSense hosts from a beacon node map, preferring advertised
 * `hivesense_api` support and higher reliability scores. Falls back to the
 * static list when nothing is advertised.
 */
export function hiveSenseHostsFromBeacon (beaconMap) {
  const advertised = Object.values(beaconMap || {})
    .filter(entry => Array.isArray(entry?.features) && entry.features.includes('hivesense_api'))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .map(entry => entry.endpoint)
    .filter(Boolean)
  const ordered = [...new Set([...advertised, ...HIVESENSE_HOSTS])]
  return ordered.length ? ordered : [...HIVESENSE_HOSTS]
}

function clampInt (value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

/**
 * Translate the caller's desired result count into the two values the API
 * expects. `result_limit` is the total row count; `full_posts` is capped at 50,
 * so larger requests return hydrated posts followed by sparse stubs.
 */
function resultShape (limit) {
  const total = clampInt(limit, 1, HIVESENSE_MAX_RESULTS, 20)
  return { total, full: Math.min(total, HIVESENSE_MAX_FULL_POSTS) }
}

function setOptional (params, key, value) {
  if (value === undefined || value === null || value === '') return
  const number = Number(value)
  if (key === 'truncate') {
    if (!Number.isFinite(number) || number < 0) return
    params.set(key, String(Math.floor(number)))
    return
  }
  params.set(key, String(value))
}

async function getJson (url, { timeoutMs, fetchImpl } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) {
      return { ok: false, error: 'HTTP ' + response.status }
    }
    const data = await response.json()
    return { ok: true, data }
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
    return { ok: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Try each host in order until one answers. `buildPath` returns the path after
 * `/hivesense-api` (with a leading slash). Resolves with the first successful
 * payload, or `{ ok: false, error }` after every host fails.
 */
async function requestAcrossHosts (buildPath, { hosts, timeoutMs = HIVESENSE_TIMEOUT_MS, fetchImpl = typeof fetch === 'function' ? fetch : null, validate } = {}) {
  if (!fetchImpl) return { ok: false, error: 'Fetch unavailable' }
  const candidates = Array.isArray(hosts) && hosts.length ? hosts : HIVESENSE_HOSTS
  let lastError = ''
  for (const host of candidates) {
    const base = String(host).replace(/\/+$/, '')
    const result = await getJson(base + HIVESENSE_PATH + buildPath, { timeoutMs, fetchImpl })
    if (result.ok) {
      if (typeof validate === 'function' && !validate(result.data)) {
        lastError = 'Unexpected response'
        continue
      }
      return { ok: true, data: result.data, host: base }
    }
    lastError = result.error
  }
  return { ok: false, error: lastError || 'Unreachable' }
}

/** Normalise a HiveSense post so `rankPosts` and the UI can consume it. */
export function normalizeHiveSensePost (post) {
  if (!post || !post.author || !post.permlink) return null
  // HiveSense pads large result sets with sparse rows that carry only
  // author/permlink. Drop them so the UI never shows "Untitled post" spam.
  const hasContent = Boolean(
    String(post.title || '').trim() ||
    String(post.body || '').trim()
  )
  if (!hasContent) return null
  return {
    ...post,
    community: post.community || '',
    stats: post.stats || { total_votes: Number(post.active_votes?.length) || 0 }
  }
}

function normalizePostList (data) {
  return (Array.isArray(data) ? data : []).map(normalizeHiveSensePost).filter(Boolean)
}

/**
 * Semantic post search. `q` is required and must clear the minimum length.
 * Returns `{ ok, posts, host }` with posts in HiveSense relevance order.
 *
 * `limit` is the number of posts the caller wants. The API returns at most 50
 * hydrated posts per call (`full_posts`), and any rows beyond that are stubs
 * which `normalizePostList` drops.
 */
export async function searchHiveSensePosts (q, { limit = 20, truncate, observer, author, fromBlock, toBlock, hosts, timeoutMs, fetchImpl } = {}) {
  const query = String(q || '').trim()
  if (query.length < HIVESENSE_MIN_QUERY) {
    return { ok: false, posts: [], error: 'Query too short' }
  }
  const shape = resultShape(limit)
  const params = new URLSearchParams({
    q: query,
    result_limit: String(shape.total),
    full_posts: String(shape.full)
  })
  setOptional(params, 'truncate', truncate)
  setOptional(params, 'observer', observer)
  setOptional(params, 'author', author)
  setOptional(params, 'from-block', fromBlock)
  setOptional(params, 'to-block', toBlock)
  const result = await requestAcrossHosts(
    '/posts/search?' + params.toString(),
    { hosts, timeoutMs, fetchImpl, validate: Array.isArray }
  )
  if (!result.ok) return { ok: false, posts: [], error: result.error }
  return { ok: true, posts: normalizePostList(result.data), host: result.host }
}

/** Posts semantically similar to one post. */
export async function fetchSimilarPosts (author, permlink, { limit = 8, truncate, observer, hosts, timeoutMs, fetchImpl } = {}) {
  const cleanAuthor = String(author || '').trim().toLowerCase().replace(/^@/, '')
  const cleanPermlink = String(permlink || '').trim()
  if (!cleanAuthor || !cleanPermlink) {
    return { ok: false, posts: [], error: 'Missing post' }
  }
  const shape = resultShape(limit)
  const params = new URLSearchParams({
    result_limit: String(shape.total),
    full_posts: String(shape.full)
  })
  setOptional(params, 'truncate', truncate)
  setOptional(params, 'observer', observer)
  const path = '/posts/' + encodeURIComponent(cleanAuthor) + '/' + encodeURIComponent(cleanPermlink) +
    '/similar?' + params.toString()
  const result = await requestAcrossHosts(path, { hosts, timeoutMs, fetchImpl, validate: Array.isArray })
  if (!result.ok) return { ok: false, posts: [], error: result.error }
  return { ok: true, posts: normalizePostList(result.data), host: result.host }
}

/** Accounts who write about a topic, ranked by thematic specialisation. */
export async function searchHiveSenseAuthors (topic, { limit = 6, observer, hosts, timeoutMs, fetchImpl } = {}) {
  const needle = String(topic || '').trim()
  if (needle.length < HIVESENSE_MIN_QUERY) {
    return { ok: false, authors: [], error: 'Topic too short' }
  }
  const params = new URLSearchParams({
    topic: needle,
    result_limit: String(clampInt(limit, 1, 100, 6))
  })
  setOptional(params, 'observer', observer)
  const path = '/authors/search?' + params.toString()
  const result = await requestAcrossHosts(path, { hosts, timeoutMs, fetchImpl, validate: Array.isArray })
  if (!result.ok) return { ok: false, authors: [], error: result.error }
  const authors = result.data
    .map(item => (typeof item === 'string' ? item : item?.name || item?.author))
    .filter(Boolean)
  return { ok: true, authors, host: result.host }
}

/** Resolve HiveSense hosts from beacon once per session, then cache. */
let hostCache = null
export async function resolveHiveSenseHosts ({ force = false, fetchImpl, timeoutMs } = {}) {
  if (hostCache && !force) return hostCache
  try {
    const beacon = await fetchBeaconNodes({ baseUrl: BEACON_API_BASE, fetchImpl, timeoutMs })
    hostCache = hiveSenseHostsFromBeacon(beacon.nodes)
  } catch {
    hostCache = [...HIVESENSE_HOSTS]
  }
  return hostCache
}

export function resetHiveSenseHosts () {
  hostCache = null
}
