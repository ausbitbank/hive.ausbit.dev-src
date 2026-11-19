// Client for the HiveSense semantic search API.
//
// HiveSense (https://tools.openhive.network/hivesense) runs an AI vector index
// of Hive posts and exposes a small REST surface under `<node>/hivesense-api/`:
//
//   GET /posts/search?q=...&limit=...                 semantic post search
//   GET /posts/{author}/{permlink}/similar?limit=...  nearest-neighbour posts
//   GET /authors/search?topic=...&limit=...           topic expert discovery
//
// The endpoints are CORS-open and anonymous. Only some API nodes run the
// service, so hosts are chosen from the beacon feature list (which advertises
// `hivesense_api`) with a small static fallback list. Requests never throw;
// callers get `{ ok: false }` so search can quietly fall back to local ranking.
//
// Note: post results carry no similarity score. HiveSense returns them in
// relevance order, so callers must preserve array order rather than re-rank.

import { fetchBeaconNodes } from './beacon'
import { BEACON_API_BASE } from './hiveNodes'

export const HIVESENSE_PATH = '/hivesense-api'
export const HIVESENSE_MAX_LIMIT = 100
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

function clampLimit (value, fallback = 20) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(HIVESENSE_MAX_LIMIT, Math.floor(number)))
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
 */
export async function searchHiveSensePosts (q, { limit = 20, hosts, timeoutMs, fetchImpl } = {}) {
  const query = String(q || '').trim()
  if (query.length < HIVESENSE_MIN_QUERY) {
    return { ok: false, posts: [], error: 'Query too short' }
  }
  const params = new URLSearchParams({ q: query, limit: String(clampLimit(limit)) })
  const result = await requestAcrossHosts(
    '/posts/search?' + params.toString(),
    { hosts, timeoutMs, fetchImpl, validate: Array.isArray }
  )
  if (!result.ok) return { ok: false, posts: [], error: result.error }
  return { ok: true, posts: normalizePostList(result.data), host: result.host }
}

/** Posts semantically similar to one post. */
export async function fetchSimilarPosts (author, permlink, { limit = 8, hosts, timeoutMs, fetchImpl } = {}) {
  const cleanAuthor = String(author || '').trim().toLowerCase().replace(/^@/, '')
  const cleanPermlink = String(permlink || '').trim()
  if (!cleanAuthor || !cleanPermlink) {
    return { ok: false, posts: [], error: 'Missing post' }
  }
  const path = '/posts/' + encodeURIComponent(cleanAuthor) + '/' + encodeURIComponent(cleanPermlink) +
    '/similar?' + new URLSearchParams({ limit: String(clampLimit(limit)) }).toString()
  const result = await requestAcrossHosts(path, { hosts, timeoutMs, fetchImpl, validate: Array.isArray })
  if (!result.ok) return { ok: false, posts: [], error: result.error }
  return { ok: true, posts: normalizePostList(result.data), host: result.host }
}

/** Accounts who write about a topic, ranked by thematic specialisation. */
export async function searchHiveSenseAuthors (topic, { limit = 6, hosts, timeoutMs, fetchImpl } = {}) {
  const needle = String(topic || '').trim()
  if (needle.length < HIVESENSE_MIN_QUERY) {
    return { ok: false, authors: [], error: 'Topic too short' }
  }
  const path = '/authors/search?' + new URLSearchParams({ topic: needle, limit: String(clampLimit(limit)) }).toString()
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
