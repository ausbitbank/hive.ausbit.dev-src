// Cached read models for chain data used across pages and the store.

import { apiCache, clearCache, invalidateCache, loadCached } from './cache'
import {
  apiGetAccounts,
  apiGetFollowCount,
  apiGetGlobalProps,
  apiGetMedianHistoryPrice,
  apiGetOpenOrders,
  apiGetTicker,
  apiGetWitnessByAccount,
  apiGetWitnessesByVote,
  bridgeRequest
} from './api'

export const CACHE_TTL = {
  globalProps: 15000,
  account: 15000,
  witnesses: 60000,
  posts: 30000,
  followCount: 60000,
  ticker: 15000,
  median: 15000
}

function accountKey (name) {
  return 'account:' + String(name || '').toLowerCase()
}

export function fetchGlobalProps ({ force = false, onStale = null } = {}) {
  return loadCached('globalProps', () => apiGetGlobalProps(), {
    ttl: CACHE_TTL.globalProps,
    force,
    onStale
  })
}

export function fetchAccount (name, { force = false, onStale = null } = {}) {
  if (!name) return Promise.resolve(null)
  return loadCached(accountKey(name), async () => {
    const accounts = await apiGetAccounts([name])
    return Array.isArray(accounts) ? accounts[0] || null : null
  }, {
    ttl: CACHE_TTL.account,
    force,
    onStale
  })
}

/**
 * Fetch many accounts using individual cache entries. Missing accounts are
 * requested in one batch and stale entries can be refreshed in the background.
 */
export async function fetchAccounts (names, { force = false } = {}) {
  const unique = [...new Set((Array.isArray(names) ? names : []).filter(Boolean))]
  if (unique.length === 0) return []

  const missing = unique.filter(name => force || !apiCache.get(accountKey(name)))
  const stale = unique.filter(name => {
    const entry = apiCache.get(accountKey(name))
    return entry && entry.age > CACHE_TTL.account
  })

  if (missing.length > 0) {
    const response = await apiGetAccounts(force ? unique : missing)
    if (Array.isArray(response)) {
      response.forEach(account => {
        if (account?.name) apiCache.set(accountKey(account.name), account, { ttl: CACHE_TTL.account })
      })
    }
  } else if (stale.length > 0 && !force) {
    // Stale-while-revalidate for batch callers such as follower lists.
    Promise.resolve()
      .then(() => apiGetAccounts(stale))
      .then(response => {
        if (Array.isArray(response)) {
          response.forEach(account => {
            if (account?.name) apiCache.set(accountKey(account.name), account, { ttl: CACHE_TTL.account })
          })
        }
      })
      .catch(() => {})
  }

  return unique.map(name => apiCache.get(accountKey(name))?.value).filter(Boolean)
}

export function fetchWitnessesByVote (limit = 200, { force = false, onStale = null } = {}) {
  return loadCached('witnesses:' + limit, () => apiGetWitnessesByVote(limit), {
    ttl: CACHE_TTL.witnesses,
    force,
    onStale
  })
}

export function fetchWitnessByAccount (owner, { force = false } = {}) {
  if (!owner) return Promise.resolve(null)
  return loadCached('witness:' + owner, () => apiGetWitnessByAccount(owner), {
    ttl: CACHE_TTL.witnesses,
    force
  })
}

export function fetchFollowCount (account, { force = false } = {}) {
  if (!account) return Promise.resolve(null)
  return loadCached('followCount:' + account, () => apiGetFollowCount(account), {
    ttl: CACHE_TTL.followCount,
    force
  })
}

export function fetchMedianHistoryPrice ({ force = false } = {}) {
  return loadCached('medianHistory', () => apiGetMedianHistoryPrice(), {
    ttl: CACHE_TTL.median,
    force
  })
}

export function fetchTicker ({ force = false } = {}) {
  return loadCached('ticker', () => apiGetTicker(), {
    ttl: CACHE_TTL.ticker,
    force
  })
}

export function fetchOpenOrders (account, { force = false } = {}) {
  if (!account) return Promise.resolve([])
  return loadCached('openOrders:' + account, () => apiGetOpenOrders(account), {
    ttl: 5000,
    force
  })
}

function postCacheKey (method, params) {
  return 'posts:' + method + ':' + JSON.stringify(params || {})
}

export function fetchRankedPosts (params, { force = false } = {}) {
  return loadCached(postCacheKey('bridge.get_ranked_posts', params), () => bridgeRequest('get_ranked_posts', params), {
    ttl: CACHE_TTL.posts,
    force
  })
}

export function fetchAccountPosts (params, { force = false } = {}) {
  return loadCached(postCacheKey('bridge.get_account_posts', params), () => bridgeRequest('get_account_posts', params), {
    ttl: CACHE_TTL.posts,
    force
  })
}

export function fetchCommunity (name, observer = null, { force = false } = {}) {
  if (!name) return Promise.resolve(null)
  const params = { name, observer }
  return loadCached('community:' + name, () => bridgeRequest('get_community', params), {
    ttl: 60000,
    force
  })
}

export function invalidateAccountCache (name = null) {
  return invalidateCache(name ? accountKey(name) : 'account:')
}

export function invalidateGlobalPropsCache () {
  return invalidateCache('globalProps')
}

export function invalidateWitnessCache () {
  return invalidateCache('witness')
}

export function invalidatePostCache () {
  return invalidateCache('posts:')
}

export function invalidateOpenOrderCache (account = null) {
  return invalidateCache(account ? 'openOrders:' + account : 'openOrders:')
}

export function invalidateAllChainData () {
  return clearCache(apiCache)
}
