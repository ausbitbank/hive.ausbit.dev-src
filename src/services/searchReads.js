// Search orchestration: turn a query into grouped results using cached reads.
//
// The pure parsing/ranking lives in `unifiedSearch.js`; this module decides
// which reads to make, tolerates individual failures and returns a shape the
// page renders directly.

import {
  BLOCK_NUMBER_RE,
  RESULT_LIMITS,
  TX_ID_RE,
  buildSearchPlan,
  exploreFacets,
  filterByFacets,
  mergeSemanticPosts,
  normalizeSearchState,
  rankAccounts,
  rankCommunities,
  rankPosts,
  rankProposals,
  rankWitnesses,
  tagAnalytics,
  tagFacets
} from './unifiedSearch'
import {
  fetchAccountNameSearch,
  fetchAccountPosts,
  fetchAccounts,
  fetchBlockHeader,
  fetchCommunitySearch,
  fetchHiveSenseAuthors,
  fetchHiveSenseSearch,
  fetchPostSearch,
  fetchWitnessesByVote
} from './chainData'
import { listProposals } from './proposals'

export { hasActiveFilters } from './unifiedSearch'

function emptyGroup (label, items = []) {
  return { label, items, error: '' }
}

function cleanAccount (value) {
  return String(value || '').trim().toLowerCase().replace(/^@/, '')
}

/** Posts a specific account published, used for the author facet and analytics. */
export async function fetchAuthorContext (author, { force = false } = {}) {
  const name = cleanAccount(author)
  if (!name) return []
  try {
    const posts = await fetchAccountPosts({ account: name, sort: 'posts', limit: 20 }, { force })
    return Array.isArray(posts) ? posts : []
  } catch {
    return []
  }
}

function searchableQuery (plan) {
  if (plan.kind === 'keyword') return plan.query
  return plan.posts || plan.tags || plan.accounts || ''
}

async function buildAnalyticsFor (label, filters, { force = false } = {}) {
  try {
    const posts = await fetchPostSearch({ tags: label, communities: label }, { force })
    const normalized = normalizeSearchState(filters)
    const filtered = filterByFacets(posts, {
      ...normalized,
      tags: normalized.tags.length ? normalized.tags : [label],
      communities: normalized.communities.filter(community => community !== label)
    })
    return tagAnalytics(filtered, { label: '#' + label })
  } catch {
    return null
  }
}

/**
 * Run a unified search. Every group is optional; a failing group reports its
 * error without failing the whole result set.
 */
export async function runUnifiedSearch (query, state = {}, { force = false } = {}) {
  const text = String(query || '').trim()
  const filters = normalizeSearchState(state)
  const plan = buildSearchPlan(text)
  const include = type => filters.type === 'all' || filters.type === type
  const author = filters.authors[0] || (plan.kind === 'account' && !filters.tags.length ? cleanAccount(plan.accounts) : '')

  const result = {
    query: text,
    plan,
    state: filters,
    accounts: emptyGroup('Accounts'),
    posts: emptyGroup('Posts'),
    tags: emptyGroup('Tags'),
    communities: emptyGroup('Communities'),
    blocks: emptyGroup('Blocks'),
    transactions: emptyGroup('Transactions'),
    proposals: emptyGroup('Proposals'),
    witnesses: emptyGroup('Witnesses'),
    authorContext: author ? { author, facets: null } : null,
    analytics: null,
    semantic: { attempted: false, ok: false, count: 0 },
    recommendedAuthors: []
  }

  if (!text) return result

  const tasks = []

  if (include('accounts') && plan.kind !== 'post' && plan.kind !== 'block' && plan.kind !== 'transaction') {
    if (plan.accounts) {
      tasks.push(
        fetchAccountNameSearch(plan.accounts.slice(0, 12), RESULT_LIMITS.accounts, { force })
          .then(accounts => {
            result.accounts.items = rankAccounts(accounts, plan.accounts).slice(0, RESULT_LIMITS.accounts)
          })
          .catch(() => { result.accounts.error = 'Accounts could not be loaded.' })
      )
    }
    if (plan.kind === 'keyword') {
      tasks.push(
        fetchAccounts([plan.query.toLowerCase()], { force })
          .then(exact => {
            const merged = [...(Array.isArray(exact) ? exact : []), ...result.accounts.items]
            result.accounts.items = rankAccounts(merged, plan.query).slice(0, RESULT_LIMITS.accounts)
          })
          .catch(() => {})
      )
    }
  }

  let postCandidates = null
  let postsPromise = null
  if (include('posts') && (plan.posts || author)) {
    postsPromise = fetchPostSearch(author ? { ...plan, tags: '', communities: '', accounts: '' } : plan, { force })
      .then(posts => {
        postCandidates = posts
        result.posts.items = rankPosts(posts, {
          query: searchableQuery(plan),
          sort: filters.sort,
          period: filters.period,
          tags: filters.tags,
          communities: filters.communities,
          authors: filters.authors
        }).slice(0, RESULT_LIMITS.posts)
      })
      .catch(() => { result.posts.error = 'Posts could not be loaded.' })
    tasks.push(postsPromise)
  }

  // Smart search: add HiveSense semantic results for free-text keyword queries.
  // Semantic ordering is preserved and placed ahead of the keyword results.
  const useSemantic = filters.smart && plan.kind === 'keyword' && include('posts') && plan.query.length >= 2
  if (useSemantic) {
    result.semantic.attempted = true
    tasks.push(
      Promise.allSettled([fetchHiveSenseSearch(plan.query, { limit: RESULT_LIMITS.posts * 3, force }), postsPromise])
        .then(([response]) => {
          const data = response.status === 'fulfilled' ? response.value : null
          if (!data?.ok || !Array.isArray(data.posts) || !data.posts.length) return
          result.semantic.ok = true
          result.semantic.count = data.posts.length
          const keyword = result.posts.items.length
            ? result.posts.items
            : rankPosts(postCandidates || [], {
              query: plan.query,
              sort: filters.sort,
              period: filters.period,
              tags: filters.tags,
              communities: filters.communities,
              authors: filters.authors
            })
          result.posts.items = mergeSemanticPosts(data.posts, keyword, {
            period: filters.period,
            tags: filters.tags,
            communities: filters.communities,
            authors: filters.authors,
            query: plan.query
          }).slice(0, RESULT_LIMITS.posts)
          if (result.posts.items.length) result.posts.error = ''
        })
        .catch(() => {})
    )
  }

  // Author expertise hint for keyword and tag searches.
  if (include('posts') && (plan.kind === 'keyword' || plan.kind === 'tag') && filters.smart) {
    const topic = plan.kind === 'tag' ? plan.tags : plan.query
    if (topic && topic.length >= 2) {
      tasks.push(
        fetchHiveSenseAuthors(topic, { limit: 6, force })
          .then(response => {
            if (response?.ok) result.recommendedAuthors = response.authors
          })
          .catch(() => {})
      )
    }
  }

  if (include('tags') && (plan.tags || plan.kind === 'keyword')) {
    tasks.push(
      Promise.allSettled([plan.tags ? fetchPostSearch({ ...plan, communities: '' }, { force }) : Promise.resolve([]), postsPromise])
        .then(([feed]) => {
          const feedPosts = feed.status === 'fulfilled' ? feed.value : []
          const basePosts = Array.isArray(feedPosts) && feedPosts.length
            ? feedPosts
            : (result.posts.items || [])
          const needle = plan.tags || plan.query
          result.tags.items = tagFacets(basePosts, needle, { limit: 24 })
            .filter(row => !needle || row.tag.includes(needle) || row.count > 1)
            .slice(0, RESULT_LIMITS.tags)
        })
        .catch(() => { result.tags.error = 'Tags could not be loaded.' })
    )
  }

  if (include('communities') && plan.communities) {
    tasks.push(
      fetchCommunitySearch(plan.communities, RESULT_LIMITS.communities, { force })
        .then(communities => {
          result.communities.items = rankCommunities(communities, plan.communities).slice(0, RESULT_LIMITS.communities)
        })
        .catch(() => { result.communities.error = 'Communities could not be loaded.' })
    )
  }

  if (include('blocks') && BLOCK_NUMBER_RE.test(String(plan.blocks || ''))) {
    tasks.push(
      fetchBlockHeader(plan.blocks, { force })
        .then(header => {
          if (!header) return
          result.blocks.items = [{
            blockNum: Number(plan.blocks),
            timestamp: header.timestamp,
            witness: header.witness,
            txCount: Array.isArray(header.transaction_ids) ? header.transaction_ids.length : 0
          }]
        })
        .catch(() => { result.blocks.error = 'That block could not be confirmed.' })
    )
  }

  if (include('transactions') && TX_ID_RE.test(String(plan.transactions || ''))) {
    result.transactions.items = [{ txId: String(plan.transactions).toLowerCase() }]
  }

  if (include('proposals') && (plan.proposals || plan.kind === 'keyword')) {
    tasks.push(
      listProposals({ limit: 200 })
        .then(proposals => {
          result.proposals.items = rankProposals(proposals, plan.proposals || plan.query).slice(0, RESULT_LIMITS.proposals)
        })
        .catch(() => { result.proposals.error = 'Proposals could not be loaded.' })
    )
  }

  if (include('witnesses') && (plan.accounts || plan.query)) {
    tasks.push(
      fetchWitnessesByVote(200, { force })
        .then(witnesses => {
          result.witnesses.items = rankWitnesses(witnesses, plan.accounts || plan.query).slice(0, RESULT_LIMITS.witnesses)
        })
        .catch(() => { result.witnesses.error = 'Witnesses could not be loaded.' })
    )
  }

  await Promise.allSettled(tasks)

  const analyticsLabel = filters.tags[0] || filters.communities[0] || (plan.kind === 'tag' ? plan.tags : '')
  if (analyticsLabel) {
    result.analytics = await buildAnalyticsFor(analyticsLabel, filters, { force })
  } else if (author) {
    const authorPosts = await fetchAuthorContext(author, { force })
    result.authorContext.facets = exploreFacets(authorPosts)
    if (postCandidates === null && include('posts')) {
      result.posts.items = rankPosts(authorPosts, {
        query: '',
        sort: filters.sort,
        period: filters.period,
        tags: filters.tags,
        communities: filters.communities
      }).slice(0, RESULT_LIMITS.posts)
    }
  }

  return result
}
