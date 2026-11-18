// Cached read models for chain data used across pages and the store.

import { apiCache, clearCache, invalidateCache, loadCached } from './cache'
import {
  apiBlockHeader,
  apiGetAccounts,
  apiGetFollowCount,
  apiGetGlobalProps,
  apiGetMedianHistoryPrice,
  apiGetOpenOrders,
  apiGetTicker,
  apiGetWitnessByAccount,
  apiGetWitnessesByVote,
  apiListAllSubscriptions,
  apiListCommunities,
  apiLookupAccounts,
  apiRankedPosts,
  bridgeRequest
} from './api'
import { searchReadKey } from './unifiedSearch'

export const CACHE_TTL = {
  globalProps: 15000,
  account: 15000,
  witnesses: 60000,
  posts: 30000,
  followCount: 60000,
  ticker: 15000,
  median: 15000,
  searchAccounts: 120000,
  searchCommunities: 120000,
  communities: 300000,
  subscriptions: 60000,
  searchPosts: 60000,
  blockHeader: 600000
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

/**
 * Communities an account subscribed to. Hivemind returns short rows:
 * `[name, title, role, guestTitle]`. Malformed rows degrade to an empty list.
 */
export function fetchAccountSubscriptions (account, { force = false } = {}) {
  if (!account) return Promise.resolve([])
  return loadCached('subscriptions:' + account, async () => {
    const rows = await apiListAllSubscriptions({ account })
    if (!Array.isArray(rows)) return []
    return rows
      .filter(row => Array.isArray(row) && typeof row[0] === 'string')
      .map(row => ({
        name: row[0],
        title: typeof row[1] === 'string' && row[1].trim() ? row[1].trim() : row[0],
        role: typeof row[2] === 'string' ? row[2] : '',
        guestTitle: typeof row[3] === 'string' ? row[3] : ''
      }))
  }, {
    ttl: CACHE_TTL.subscriptions,
    force
  })
}

/**
 * Community records from `bridge.list_communities`, keyed by name.
 * `list_communities` has no multi-id lookup, so the ranked pages are walked
 * for communities in good standing; ids that never appear (long-tail or
 * unlisted communities) are then searched by title via `titleFor`. Anything
 * still missing is simply absent from the result map.
 */
export function fetchCommunityInfoBatch (names, { force = false, limit = 40, titleFor = null } = {}) {
  const unique = [...new Set((Array.isArray(names) ? names : []).filter(name => typeof name === 'string' && name))]
  if (unique.length === 0) return Promise.resolve({})

  const pageSize = Math.max(1, Number(limit) || 40)
  const maxPages = 10

  return loadCached('communities:batch:' + unique.slice().sort().join(','), async () => {
    const found = {}

    // Ranked pages cover the popular communities cheaply.
    let last = ''
    for (let page = 0; page < maxPages; page++) {
      const batch = await apiListCommunities({ last, limit: pageSize, query: null, sort: 'rank' })
      if (!Array.isArray(batch) || batch.length === 0) break
      for (const community of batch) {
        if (community?.name) found[community.name] = community
      }
      if (Object.keys(found).length >= unique.length) break
      const next = batch[batch.length - 1]?.name
      if (!next || next === last) break
      last = next
    }

    // Smaller communities are not ranked high enough to reach; look them up
    // one by one using the subscription title as the search needle.
    const missing = unique.filter(name => !found[name])
    for (const name of missing) {
      const needle = typeof titleFor === 'function' ? titleFor(name) : name
      if (!needle) continue
      try {
        const matches = await apiListCommunities({ last: '', limit: 5, query: needle, sort: 'subs' })
        const match = Array.isArray(matches) ? matches.find(community => community?.name === name) : null
        if (match) found[name] = match
      } catch {
        // A failed lookup only costs that card its stats.
      }
    }

    return found
  }, {
    ttl: CACHE_TTL.communities,
    force
  }).then(map => map || {})
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

export function invalidateCommunityCache (name = null) {
  const removed = invalidateCache(name ? 'community:' + name : 'community:')
  return removed + invalidateCache('communities:') + invalidateCache('subscriptions:')
}

export function invalidateFollowCountCache (account = null) {
  return invalidateCache(account ? 'followCount:' + account : 'followCount:')
}

export function invalidateTickerCache () {
  return invalidateCache('ticker')
}

export function invalidateMedianCache () {
  return invalidateCache('medianHistory')
}

export function invalidateOpenOrderCache (account = null) {
  return invalidateCache(account ? 'openOrders:' + account : 'openOrders:')
}

export function invalidateAllChainData () {
  return clearCache(apiCache)
}

// -- Unified search reads -----------------------------------------------------

/** Accounts whose name starts with a prefix, via `condenser_api.lookup_accounts`. */
export function fetchAccountNameSearch (prefix, limit = 10, { force = false } = {}) {
  const needle = String(prefix || '').trim().toLowerCase()
  if (!needle) return Promise.resolve([])
  const key = 'search:accounts:' + needle + ':' + limit
  return loadCached(key, async () => {
    const names = await apiLookupAccounts(needle, limit)
    const list = Array.isArray(names) ? names : []
    if (!list.length) return []
    const accounts = await apiGetAccounts(list)
    return Array.isArray(accounts) ? accounts.filter(Boolean) : []
  }, {
    ttl: CACHE_TTL.searchAccounts,
    force
  })
}

/** Communities matching a query, ranked by Hivemind's `rank` sort. */
export function fetchCommunitySearch (query, limit = 6, { force = false } = {}) {
  const needle = String(query || '').trim().toLowerCase()
  const key = 'search:communities:' + needle + ':' + limit
  return loadCached(key, async () => {
    const params = {
      last: '',
      limit: Math.min(20, Math.max(1, limit)),
      query: needle || null,
      sort: needle ? 'subs' : 'rank'
    }
    const response = await apiListCommunities(params)
    return Array.isArray(response) ? response.filter(Boolean) : []
  }, {
    ttl: CACHE_TTL.searchCommunities,
    force
  })
}

/**
 * Candidate posts for a search. Tag/community queries page the chronological
 * feed so relevance ranking has enough of the newest posts to work with; those
 * pages are fetched sequentially and kept locally per request.
 */
export function fetchPostSearch (plan, { force = false } = {}) {
  const key = 'search:posts:' + searchReadKey(plan || {}, { sort: plan?.sort })
  return loadCached(key, async () => {
    const limit = 20
    const tag = plan?.communities || plan?.tags

    if (tag) {
      const posts = []
      let startAuthor = ''
      let startPermlink = ''
      for (let page = 0; page < 2; page++) {
        const params = { sort: 'created', tag, limit }
        if (startAuthor) {
          params.start_author = startAuthor
          params.start_permlink = startPermlink
        }
        const batch = await apiRankedPosts(params)
        if (!Array.isArray(batch) || !batch.length) break
        posts.push(...batch)
        const last = batch[batch.length - 1]
        if (batch.length < limit) break
        if (!last?.author || !last?.permlink) break
        startAuthor = last.author
        startPermlink = last.permlink
      }
      return posts
    }

    // Keyword queries: combine trending, newest and hot feeds, then rank the
    // union locally because public nodes do not enable `search_ranked_posts`.
    const feeds = await Promise.all(
      ['trending', 'created', 'hot'].map(sort => apiRankedPosts({ sort, limit }).catch(() => []))
    )
    const seen = new Set()
    const posts = []
    for (const feed of feeds) {
      for (const post of Array.isArray(feed) ? feed : []) {
        if (!post?.author || !post?.permlink) continue
        const postKey = post.author + '/' + post.permlink
        if (seen.has(postKey)) continue
        seen.add(postKey)
        posts.push(post)
      }
    }
    return posts
  }, {
    ttl: CACHE_TTL.searchPosts,
    force
  })
}

/** Block header for a numeric search, used to confirm the block exists. */
export function fetchBlockHeader (blockNum, { force = false } = {}) {
  const number = Number(blockNum)
  if (!Number.isInteger(number) || number < 1) return Promise.resolve(null)
  return loadCached('search:block:' + number, () => apiBlockHeader(number), {
    ttl: CACHE_TTL.blockHeader,
    force
  })
}

export function invalidateSearchCache () {
  return invalidateCache('search:')
}
