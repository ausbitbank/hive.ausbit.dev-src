// Cached read models for chain data used across pages and the store.

import { apiCache, clearCache, invalidateCache, loadCached } from './cache'
import {
  apiBlockHeader,
  apiGetAccounts,
  apiGetFollowCount,
  apiGetFollowers,
  apiGetFollowing,
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
import { fetchSimilarPosts, resolveHiveSenseHosts, searchHiveSenseAuthors, searchHiveSensePosts } from './hiveSense'
import { isValidTag } from '../utils/hiveTag'

export const CACHE_TTL = {
  globalProps: 15000,
  account: 15000,
  witnesses: 60000,
  posts: 30000,
  followCount: 60000,
  connections: 60000,
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

const ACCOUNT_BATCH_SIZE = 500

function cacheAccounts (response) {
  if (!Array.isArray(response)) return
  response.forEach(account => {
    if (account?.name) apiCache.set(accountKey(account.name), account, { ttl: CACHE_TTL.account })
  })
}

/**
 * Fetch many accounts using individual cache entries. Missing accounts are
 * requested in batches and stale entries can be refreshed in the background.
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
    const requested = force ? unique : missing
    for (let index = 0; index < requested.length; index += ACCOUNT_BATCH_SIZE) {
      cacheAccounts(await apiGetAccounts(requested.slice(index, index + ACCOUNT_BATCH_SIZE)))
    }
  } else if (stale.length > 0 && !force) {
    // Stale-while-revalidate for batch callers such as follower lists.
    Promise.resolve()
      .then(async () => {
        for (let index = 0; index < stale.length; index += ACCOUNT_BATCH_SIZE) {
          cacheAccounts(await apiGetAccounts(stale.slice(index, index + ACCOUNT_BATCH_SIZE)))
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

export function fetchConnections (account, type, { start = '', limit = 100, force = false } = {}) {
  if (!account) return Promise.resolve([])
  const kind = type === 'followers' ? 'followers' : 'following'
  const page = String(start || '').toLowerCase()
  const size = Math.min(1000, Math.max(1, Number(limit) || 100))
  return loadCached('connections:' + kind + ':' + account + ':' + page + ':' + size, () => (
    kind === 'followers'
      ? apiGetFollowers(account, start, size)
      : apiGetFollowing(account, start, size)
  ), {
    ttl: CACHE_TTL.connections,
    force
  })
}

const FOLLOWING_PAGE_SIZE = 1000
const FOLLOWING_MAX_PAGES = 10

function followingKey (account) {
  return 'following:' + String(account || '').toLowerCase()
}

/**
 * Every account the viewer follows, as one cached snapshot. Grids of cards
 * then answer "am I following this account?" with a local membership check
 * instead of one `get_relationship_between_accounts` call per card.
 */
export function fetchFollowingNames (account, { force = false } = {}) {
  if (!account) return Promise.resolve([])
  return loadCached(followingKey(account), async () => {
    const names = []
    const seen = new Set()
    let start = ''
    for (let page = 0; page < FOLLOWING_MAX_PAGES; page++) {
      const rows = await apiGetFollowing(account, start, FOLLOWING_PAGE_SIZE)
      if (!Array.isArray(rows) || rows.length === 0) break
      for (const row of rows) {
        const name = typeof row === 'string' ? row : row?.following
        if (!name || typeof name !== 'string' || seen.has(name)) continue
        seen.add(name)
        names.push(name)
      }
      if (rows.length < FOLLOWING_PAGE_SIZE) break
      const last = rows[rows.length - 1]
      const cursor = typeof last === 'string' ? last : last?.following
      if (!cursor || cursor === start) break
      start = cursor
    }
    return names
  }, {
    ttl: CACHE_TTL.connections,
    force
  })
}

/**
 * Keep the cached snapshot in step with an optimistic follow/unfollow so the
 * next card render and the next page visit agree with the queued action.
 */
export function rememberFollowing (account, target, follows) {
  if (!account || !target) return false
  const entry = apiCache.get(followingKey(account))
  const names = entry && entry.value
  if (!Array.isArray(names)) return false
  const index = names.indexOf(target)
  if (follows && index === -1) names.push(target)
  else if (!follows && index !== -1) names.splice(index, 1)
  return true
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
  // Hivemind asserts on invalid tag strings, so a legacy tag such as
  // `hive.ausbit.dev` must not reach `bridge.get_ranked_posts`.
  if (params && params.tag && !isValidTag(params.tag)) return Promise.resolve([])
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
export function fetchCommunityInfoBatch (names, {
  force = false,
  limit = 40,
  titleFor = null,
  fallback = true,
  maxPages = 10
} = {}) {
  const unique = [...new Set((Array.isArray(names) ? names : []).filter(name => typeof name === 'string' && name))]
  if (unique.length === 0) return Promise.resolve({})

  const pageSize = Math.max(1, Number(limit) || 40)
  const pageBudget = Math.max(1, Math.min(10, Number(maxPages) || 10))
  const cacheKey = 'communities:batch:' + unique.slice().sort().join(',') +
    ':' + pageSize + ':' + pageBudget + ':' + (fallback ? 'full' : 'ranked')

  return loadCached(cacheKey, async () => {
    const found = {}

    // Ranked pages cover the popular communities cheaply.
    let last = ''
    for (let page = 0; page < pageBudget; page++) {
      const batch = await apiListCommunities({ last, limit: pageSize, query: null, sort: 'rank' })
      if (!Array.isArray(batch) || batch.length === 0) break
      for (const community of batch) {
        if (community?.name) found[community.name] = community
      }
      if (unique.every(name => found[name])) break
      const next = batch[batch.length - 1]?.name
      if (!next || next === last) break
      last = next
    }

    // Smaller communities are not ranked high enough to reach; look them up
    // one by one using the subscription title as the search needle. Callers
    // that only need quick picker metadata can skip this long-tail pass.
    const missing = fallback ? unique.filter(name => !found[name]) : []
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

export function invalidateFollowingCache (account = null) {
  return invalidateCache(account ? followingKey(account) : 'following:')
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
 * One page of the public community directory.
 *
 * `sort` is limited to the three sorts Hivemind supports (`rank`, `new`,
 * `subs`). The query filters community titles and descriptions; exact
 * `hive-123456` lookups are handled by the page with `fetchCommunity`.
 */
export function fetchCommunityDirectoryPage ({
  sort = 'rank',
  query = '',
  last = '',
  limit = 36,
  force = false
} = {}) {
  const safeSort = ['rank', 'new', 'subs'].includes(sort) ? sort : 'rank'
  const needle = String(query || '').trim()
  const pageLimit = Math.max(1, Math.min(100, Number(limit) || 36))
  const key = 'communities:directory:' + safeSort + ':' + pageLimit + ':' +
    (last || '') + ':' + needle.toLowerCase()

  return loadCached(key, async () => {
    const rows = await apiListCommunities({
      last: last || '',
      limit: pageLimit,
      query: needle || null,
      sort: safeSort
    })
    return Array.isArray(rows)
      ? rows.filter(community => community && typeof community.name === 'string' && community.name)
      : []
  }, {
    ttl: CACHE_TTL.communities,
    force
  })
}

/**
 * Communities whose account name starts with a `hive-123` prefix.
 *
 * `bridge.list_communities` only queries titles and descriptions, so a partial
 * community id would otherwise find nothing. Community accounts are ordinary
 * Hive accounts, so `lookup_accounts` supplies the names and `get_community`
 * fills in the display records.
 */
export function fetchCommunityNameMatches (prefix, limit = 12, { force = false } = {}) {
  const needle = String(prefix || '').trim().toLowerCase()
  if (!/^hive-\d+$/.test(needle)) return Promise.resolve([])

  const count = Math.max(1, Math.min(20, Number(limit) || 12))
  const key = 'communities:names:' + needle + ':' + count

  return loadCached(key, async () => {
    const names = await apiLookupAccounts(needle, Math.min(100, count * 3))
    const matches = (Array.isArray(names) ? names : [])
      .filter(name => typeof name === 'string' && /^hive-\d+$/.test(name) && name.startsWith(needle))
      .slice(0, count)

    const records = await Promise.all(
      matches.map(name => fetchCommunity(name).catch(() => null))
    )
    return records.filter(record => record && record.name)
  }, {
    ttl: CACHE_TTL.communities,
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

// --- HiveSense semantic search --------------------------------------------
//
// These reads degrade to an empty list when the service is unreachable so the
// caller keeps whatever local keyword results it already has.

async function hiveSenseHosts () {
  try {
    return await resolveHiveSenseHosts()
  } catch {
    return undefined
  }
}

/** Semantic post results for a free-text query, in HiveSense relevance order. */
export function fetchHiveSenseSearch (query, { limit = 20, truncate = 400, observer = '', fromBlock = '', toBlock = '', force = false } = {}) {
  const text = String(query || '').trim().toLowerCase()
  if (text.length < 2) return Promise.resolve({ ok: false, posts: [], error: 'Query too short' })
  const key = 'search:hivesense:' + text + ':' + limit + ':' + truncate + ':' + observer + ':' + fromBlock + ':' + toBlock
  return loadCached(key, async () => {
    const hosts = await hiveSenseHosts()
    return searchHiveSensePosts(text, { limit, truncate, observer, fromBlock, toBlock, hosts })
  }, { ttl: CACHE_TTL.searchPosts, force })
}

/** Posts semantically similar to one post. */
export function fetchHiveSenseSimilar (author, permlink, { limit = 8, truncate = 400, observer = '', force = false } = {}) {
  const name = String(author || '').trim().toLowerCase().replace(/^@/, '')
  const slug = String(permlink || '').trim()
  if (!name || !slug) return Promise.resolve({ ok: false, posts: [], error: 'Missing post' })
  const key = 'hivesense:similar:' + name + '/' + slug + ':' + limit + ':' + truncate + ':' + observer
  return loadCached(key, async () => {
    const hosts = await hiveSenseHosts()
    return fetchSimilarPosts(name, slug, { limit, truncate, observer, hosts })
  }, { ttl: CACHE_TTL.searchPosts, force })
}

/** Accounts who write about a topic, for the search expertise hint. */
export function fetchHiveSenseAuthors (topic, { limit = 6, observer = '', force = false } = {}) {
  const text = String(topic || '').trim().toLowerCase()
  if (text.length < 2) return Promise.resolve({ ok: false, authors: [], error: 'Topic too short' })
  const key = 'search:hivesense:authors:' + text + ':' + limit + ':' + observer
  return loadCached(key, async () => {
    const hosts = await hiveSenseHosts()
    return searchHiveSenseAuthors(text, { limit, observer, hosts })
  }, { ttl: CACHE_TTL.searchPosts, force })
}