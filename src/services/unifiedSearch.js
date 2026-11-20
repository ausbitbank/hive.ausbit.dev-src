// Unified search: query model, result ranking and analytics helpers.
//
// Everything here is pure so the search page, the command palette and the unit
// tests share one implementation. Network reads live in `chainData.js`; this
// module only reasons about data it is given.

import { parseSearchRoute } from './search'
import { postTags, postMetadata, postPayoutValue } from './posts'

export const SEARCH_TYPES = ['all', 'accounts', 'posts', 'tags', 'communities', 'blocks', 'transactions', 'proposals', 'witnesses']
export const SEARCH_TYPE_LABELS = {
  all: 'All',
  accounts: 'Accounts',
  posts: 'Posts',
  tags: 'Tags',
  communities: 'Communities',
  blocks: 'Blocks',
  transactions: 'Transactions',
  proposals: 'Proposals',
  witnesses: 'Witnesses'
}

export const POST_SORTS = ['relevance', 'trending', 'created', 'hot']
export const POST_SORT_LABELS = {
  relevance: 'Relevance',
  trending: 'Trending',
  created: 'Newest',
  hot: 'Hot'
}

export const POST_PERIODS = ['all', 'day', 'week', 'month']
export const POST_PERIOD_LABELS = {
  all: 'All time',
  day: 'Past day',
  week: 'Past week',
  month: 'Past month'
}

export const RESULT_LIMITS = {
  accounts: 11,
  posts: 20,
  tags: 12,
  communities: 6,
  witnesses: 8,
  proposals: 6,
  blocks: 5,
  transactions: 5
}

export const MIN_QUERY_LENGTH = 2
export const BLOCK_NUMBER_RE = /^\d{1,10}$/
export const TX_ID_RE = /^[0-9a-f]{40}$/i
export const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance', description: 'Best text and tag match' },
  { value: 'trending', label: 'Trending', description: 'Hot discussion and rewards' },
  { value: 'created', label: 'Newest', description: 'Chronological, newest first' },
  { value: 'hot', label: 'Hot', description: 'Recent activity spikes' }
]

export const PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'day', label: 'Past day' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' }
]

const PERIOD_MS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 31 * 24 * 60 * 60 * 1000
}

function ratio (value) {
  return Math.min(10000, Math.max(-10000, Math.round(value)))
}

function uniqueSorted (list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))]
}

/**
 * Parse a search URL (`/search`, `/search/posts`, `/search/tags/photography`)
 * and its query string into one settings object. Invalid values fall back to
 * safe defaults rather than throwing, so a shared link never breaks the page.
 */
export function parseSearchState (search = '') {
  const text = String(search || '').replace(/^\?/, '')
  const params = new URLSearchParams(text)
  const type = params.get('type') || 'all'
  const sort = params.get('sort') || 'relevance'
  const period = params.get('period') || 'all'
  return normalizeSearchState({
    type,
    sort,
    period,
    tags: params.getAll('tag').flatMap(value => String(value).split(',')),
    communities: params.getAll('community').flatMap(value => String(value).split(',')),
    authors: params.getAll('author').flatMap(value => String(value).split(',')),
    sortOrder: params.get('order') || 'desc',
    window: params.get('window') || 'all',
    style: params.get('style') || 'cards',
    page: params.get('page') || 1,
    smart: params.get('smart') !== '0'
  })
}

function cleanList (value) {
  return uniqueSorted(
    (Array.isArray(value) ? value : String(value || '').split(','))
      .map(item => String(item || '').trim().replace(/^#/, '').toLowerCase())
      .filter(item => /^[a-z0-9.-]{1,40}$/.test(item))
  ).slice(0, 10)
}

export function normalizeSearchState (state = {}) {
  const type = SEARCH_TYPES.includes(state.type) ? state.type : 'all'
  const sort = POST_SORTS.includes(state.sort) ? state.sort : 'relevance'
  const period = POST_PERIODS.includes(state.period) ? state.period : 'all'
  const style = ['cards', 'list', 'table'].includes(state.style) ? state.style : 'cards'
  const windowKey = ['all', '7d', '30d'].includes(state.window) ? state.window : 'all'
  const sortOrder = state.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.min(100, Number(state.page) || 1))
  return {
    type,
    sort,
    period,
    tags: cleanList(state.tags),
    communities: cleanList(state.communities),
    authors: cleanList(state.authors),
    sortOrder,
    window: windowKey,
    style,
    page,
    smart: state.smart !== false
  }
}

export function searchToQuery (state = {}) {
  const normalized = normalizeSearchState(state)
  const params = new URLSearchParams()
  if (normalized.type !== 'all') params.set('type', normalized.type)
  if (normalized.sort !== 'relevance') params.set('sort', normalized.sort)
  if (normalized.period !== 'all') params.set('period', normalized.period)
  for (const tag of normalized.tags) params.append('tag', tag)
  for (const community of normalized.communities) params.append('community', community)
  for (const author of normalized.authors) params.append('author', author)
  if (normalized.sortOrder !== 'desc') params.set('order', normalized.sortOrder)
  if (normalized.window !== 'all') params.set('window', normalized.window)
  if (normalized.style !== 'cards') params.set('style', normalized.style)
  if (normalized.page > 1) params.set('page', String(normalized.page))
  if (!normalized.smart) params.set('smart', '0')
  return params.toString()
}

/** Build a shareable `/search?q=…` URL for the current query and filters. */
export function searchUrl (query, state = {}) {
  const params = new URLSearchParams()
  const text = String(query || '').trim()
  if (text) params.set('q', text)
  const extra = searchToQuery(state)
  const merged = [params.toString(), extra].filter(Boolean).join('&')
  return '/search' + (merged ? '?' + merged : '')
}

export function hasActiveFilters (state = {}) {
  const normalized = normalizeSearchState(state)
  return normalized.tags.length > 0 ||
    normalized.communities.length > 0 ||
    normalized.authors.length > 0 ||
    normalized.period !== 'all' ||
    normalized.sort !== 'relevance'
}

export function clearFilters () {
  return normalizeSearchState({})
}

/** Toggle a facet value, returning a new filter list. */
export function toggleFacet (list, value) {
  const clean = String(value || '').trim().replace(/^#/, '').toLowerCase()
  if (!clean) return cleanList(list)
  const current = cleanList(list)
  return current.includes(clean) ? current.filter(item => item !== clean) : [...current, clean].slice(0, 10)
}

// Very common English words carry no topical signal. Without this list a query
// like "landing on the moon" matches almost every post through "on"/"the", which
// lets unrelated popular posts pad relevance results when semantic results run
// short (for example when a host is down or a facet filter removes them).
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for',
  'from', 'had', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our',
  'out', 'she', 'so', 'than', 'that', 'the', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your'
])

function tokenize (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[#@]/g, ' ')
    .split(/[^a-z0-9.]/i)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !STOPWORDS.has(token))
}

function postText (post) {
  const metadata = postMetadata(post)
  return [
    post && post.title,
    post && post.body,
    post && post.category,
    post && post.community_title,
    post && post.author,
    Array.isArray(metadata.tags) ? metadata.tags.join(' ') : ''
  ].filter(Boolean).join(' ').toLowerCase()
}

/**
 * True when at least one query token appears in the post's own text. Engagement
 * signals alone must not keep an unrelated post in a relevance result set.
 */
export function postMatchesQuery (post, query = '') {
  const tokens = tokenize(query)
  if (!tokens.length) return true
  const text = postText(post)
  return tokens.some(token => text.includes(token))
}

function tokenScore (text, token) {
  if (!token) return 0
  const index = text.indexOf(token)
  if (index === -1) return 0
  let score = 6
  if (index === 0) score += 4
  if (new RegExp('(^|[^a-z0-9])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text)) score += 4
  return score
}

/**
 * Relevance score for one post. Exact tag and community matches rank highest,
 * then title/author matches, then body occurrences. Ties fall back to payout and
 * engagement so the order is stable and useful.
 */
export function scorePost (post, query = '') {  if (!post) return 0
  const tokens = tokenize(query)
  const text = postText(post)
  const rawQuery = String(query || '').trim().toLowerCase().replace(/^#/, '')
  const tags = postTags(post, 30).map(tag => tag.toLowerCase())
  const metadata = postMetadata(post)
  const metadataTags = (Array.isArray(metadata.tags) ? metadata.tags : []).map(tag => String(tag).toLowerCase())

  let score = 0
  if (rawQuery && tags.includes(rawQuery)) score += 60
  if (rawQuery && metadataTags.includes(rawQuery)) score += 20
  if (rawQuery && String(post.category || '').toLowerCase() === rawQuery) score += 40
  if (rawQuery && String(post.community || '').toLowerCase() === rawQuery) score += 40
  if (rawQuery && String(post.author || '').toLowerCase() === rawQuery) score += 30
  if (rawQuery && String(post.title || '').toLowerCase().includes(rawQuery)) score += 25
  if (rawQuery && String(post.body || '').toLowerCase().includes(rawQuery)) score += 8

  for (const token of tokens) {
    score += tokenScore(text, token)
  }
  if (tokens.length && tokens.every(token => text.includes(token))) score += 10

  const payout = postPayoutValue(post)
  const votes = Number(post.stats && post.stats.total_votes) || (Array.isArray(post.active_votes) ? post.active_votes.length : 0)
  const comments = Number(post.children) || 0
  score += Math.min(20, Math.log10(1 + Math.max(0, payout)) * 6)
  score += Math.min(12, Math.log10(1 + votes) * 5)
  score += Math.min(8, Math.log10(1 + comments) * 4)

  return Math.round(score * 100) / 100
}

export function postCreatedMs (post) {
  const value = Date.parse(post && (post.created || post.updated) || '')
  return Number.isFinite(value) ? value : 0
}

export function filterByPeriod (posts, period, now = Date.now()) {
  if (!period || period === 'all') return posts
  const windowMs = PERIOD_MS[period]
  if (!windowMs) return posts
  return posts.filter(post => {
    const created = postCreatedMs(post)
    return created > 0 && now - created <= windowMs
  })
}

/**
 * Start of a period filter as the `YYYY-MM-DD HH:MI:SS` UTC string HiveSense
 * expects for `from-block`. Returns an empty string for "all time" so callers
 * can omit the parameter.
 */
export function periodStartTimestamp (period, now = Date.now()) {
  const windowMs = PERIOD_MS[period]
  if (!windowMs) return ''
  const date = new Date(now - windowMs)
  const pad = value => String(value).padStart(2, '0')
  return [
    date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()),
    pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds())
  ].join(' ')
}

export function filterByFacets (posts, state = {}) {
  const normalized = normalizeSearchState(state)
  return (Array.isArray(posts) ? posts : []).filter(post => {
    if (!post) return false
    const metadata = postMetadata(post)
    const tags = [post.category, ...(Array.isArray(metadata.tags) ? metadata.tags : []), ...postTags(post, 30)]
      .filter(Boolean)
      .map(tag => String(tag).toLowerCase())
    if (normalized.tags.length && !normalized.tags.some(tag => tags.includes(tag))) return false
    if (normalized.communities.length) {
      const community = String(post.community || '').toLowerCase()
      if (!normalized.communities.includes(community)) return false
    }
    if (normalized.authors.length) {
      const author = String(post.author || '').toLowerCase()
      if (!normalized.authors.includes(author)) return false
    }
    return true
  })
}

/** Sort, de-duplicate and rank a post list for the chosen query and filters. */
export function rankPosts (posts, { query = '', sort = 'relevance', period = 'all', tags = [], communities = [], authors = [], now = Date.now() } = {}) {
  const seen = new Set()
  const unique = (Array.isArray(posts) ? posts : []).filter(post => {
    if (!post || !post.author || !post.permlink) return false
    const key = post.author + '/' + post.permlink
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const filtered = filterByPeriod(
    filterByFacets(unique, { tags, communities, authors }),
    period,
    now
  )

  const sortKey = POST_SORTS.includes(sort) ? sort : 'relevance'
  // Relevance search must not pad the list with unrelated popular posts just
  // because they have votes or payout. Keep the original list only when no
  // candidate mentions the query at all.
  let relevant = filtered
  if (sortKey === 'relevance' && String(query || '').trim()) {
    const matched = filtered.filter(post => postMatchesQuery(post, query))
    if (matched.length) relevant = matched
  }

  const scored = relevant.map(post => ({ post, score: scorePost(post, query) }))
  scored.sort((a, b) => {
    if (sortKey === 'created') return postCreatedMs(b.post) - postCreatedMs(a.post) || b.score - a.score
    if (sortKey === 'trending' || sortKey === 'hot') {
      const diff = postPayoutValue(b.post) - postPayoutValue(a.post)
      if (Math.abs(diff) > 0.001) return diff
      return postCreatedMs(b.post) - postCreatedMs(a.post)
    }
    if (b.score !== a.score) return b.score - a.score
    return postCreatedMs(b.post) - postCreatedMs(a.post)
  })
  return scored.map(item => item.post)
}

/**
 * Merge semantic (HiveSense) results with locally ranked keyword results.
 *
 * HiveSense returns posts in relevance order with no score, so its ordering is
 * kept: semantic posts come first in the order given, then keyword posts that
 * are not already present, ordered by the local ranking. Period/facet filters
 * are still applied so the tabs and sidebar keep working.
 */
export function mergeSemanticPosts (semanticPosts, keywordPosts, { period = 'all', tags = [], communities = [], authors = [], query = '', now = Date.now() } = {}) {
  const facets = { tags, communities, authors }
  const seen = new Set()
  const merged = []

  const semantic = filterByPeriod(filterByFacets(semanticPosts || [], facets), period, now)
  for (const post of semantic) {
    if (!post || !post.author || !post.permlink) continue
    const key = post.author + '/' + post.permlink
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...post, semantic: true })
  }

  for (const post of keywordPosts || []) {
    if (!post || !post.author || !post.permlink) continue
    // Once semantic results exist, do not pad them with keyword candidates
    // that never mention the query.
    if (merged.length && query && !postMatchesQuery(post, query)) continue
    const key = post.author + '/' + post.permlink
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...post, semantic: false })
  }

  return merged
}

/**
 * Convert a typed query into specific search actions. `@user`, `#tag`,
 * block numbers, tx ids and proposal commands are handled directly; other
 * input becomes keyword, tag and community lookups.
 */
export function buildSearchPlan (query) {
  const text = String(query || '').trim()
  const plan = {
    query: text,
    kind: 'keyword',
    accounts: null,
    posts: null,
    tags: null,
    communities: null,
    blocks: null,
    transactions: null,
    proposals: null,
    route: null
  }
  if (!text) return plan

  const route = parseSearchRoute(text)
  // A bare word like "photography" or "bitcoin" is also a syntactically valid
  // Hive account name, so parseSearchRoute() reports it as an account. Honouring
  // that in the search box would skip post, tag and semantic results entirely
  // and just show the generic trending feed. Only treat an account as an
  // explicit target when the user typed `@` or pasted a URL; bare words fall
  // through to the keyword branch and still get an account lookup there.
  const explicitAccount = route && route.kind === 'account' &&
    !text.startsWith('@') && !/^https?:\/\//i.test(text)
  if (route && !explicitAccount) {
    plan.route = route
    plan.accounts = null
    plan.blocks = null
    plan.transactions = null
    plan.proposals = null
    plan.tags = null
    plan.communities = null
    plan.posts = null
    if (route.kind === 'account') {
      plan.kind = 'account'
      plan.accounts = route.label.replace(/^@/, '')
    }
    if (route.kind === 'block') {
      plan.kind = 'block'
      plan.blocks = String(route.label.replace(/\D/g, ''))
    }
    if (route.kind === 'tx') {
      plan.kind = 'transaction'
      plan.transactions = String(route.path.split('/').pop())
    }
    if (route.kind === 'proposal') {
      plan.kind = 'proposal'
      plan.proposals = String(route.path.split('/').pop())
    }
    if (route.kind === 'tag') {
      plan.kind = 'tag'
      plan.tags = String(route.label).replace(/^#/, '')
      plan.posts = plan.tags
      plan.communities = plan.tags
    }
    if (route.kind === 'post') {
      plan.kind = 'post'
      plan.accounts = String(route.label).split('/')[0]
      plan.posts = String(route.label).split('/')[1]
    }
    if (route.kind === 'wallet') {
      plan.kind = 'account'
      plan.accounts = String(route.path.split('/')[1] || '').replace(/^@/, '')
    }
    return plan
  }

  if (text.startsWith('@')) {
    const account = text.slice(1).split('/')[0].toLowerCase()
    if (ACCOUNT_RE.test(account)) {
      plan.kind = 'account'
      plan.accounts = account
      return plan
    }
  }
  if (text.startsWith('#')) {
    const tag = text.slice(1).toLowerCase()
    if (/^[a-z0-9][a-z0-9-]{0,39}$/.test(tag)) {
      plan.kind = 'tag'
      plan.tags = tag
      plan.posts = tag
      plan.communities = tag
    }
    return plan
  }
  if (BLOCK_NUMBER_RE.test(text)) {
    plan.kind = 'block'
    plan.blocks = text
    return plan
  }
  if (TX_ID_RE.test(text)) {
    plan.kind = 'transaction'
    plan.transactions = text.toLowerCase()
    return plan
  }
  if (/^[a-z][a-z0-9.-]{2,15}$/.test(text)) {
    plan.accounts = text
    plan.tags = text
    plan.communities = text
    plan.posts = text
    return plan
  }

  // Free text (spaces, punctuation) is not a tag or community slug: passing it
  // as one makes `bridge.get_ranked_posts` reject the request. Only single valid
  // tag tokens are treated as tags; the rest rely on post search + facets.
  plan.posts = text
  const tagToken = text.toLowerCase().replace(/^#/, '')
  if (/^[a-z0-9][a-z0-9-]{0,39}$/.test(tagToken)) {
    plan.tags = tagToken
    plan.communities = tagToken
  }
  return plan
}

function normalizeText (value) {
  return String(value || '').trim().toLowerCase()
}

/** Rank accounts for a typed query. Prefix matches beat substring matches. */
export function rankAccounts (accounts, query = '') {
  const needle = normalizeText(query).replace(/^@/, '')
  const seen = new Set()
  return (Array.isArray(accounts) ? accounts : [])
    .filter(account => {
      if (!account || !account.name || seen.has(account.name)) return false
      seen.add(account.name)
      return true
    })
    .map(account => {
      const name = normalizeText(account.name)
      let score = 0
      if (!needle) score = 1
      else if (name === needle) score = 100
      else if (name.startsWith(needle)) score = 80
      else if (name.includes(needle)) score = 50
      const profile = account.posting_json_metadata || {}
      const about = typeof profile === 'object' ? profile.profile?.about : ''
      if (needle && about && String(about).toLowerCase().includes(needle)) score += 10
      return { account, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.account.reputation || 0) - Number(a.account.reputation || 0))
    .map(item => item.account)
}

/** Rank tags gathered from posts, communities and typed input. */
export function tagFacets (posts, query = '', { limit = 24 } = {}) {
  const needle = normalizeText(query).replace(/^#/, '')
  const counter = new Map()
  for (const post of Array.isArray(posts) ? posts : []) {
    const metadata = postMetadata(post)
    const tags = [post.category, ...(Array.isArray(metadata.tags) ? metadata.tags : [])]
    for (const tag of tags) {
      const clean = normalizeText(tag)
      if (!clean || clean.startsWith('hive-')) continue
      counter.set(clean, (counter.get(clean) || 0) + 1)
    }
  }
  if (needle && /^[a-z0-9][a-z0-9-]{1,39}$/.test(needle) && !counter.has(needle)) {
    counter.set(needle, 1)
  }
  return [...counter.entries()]
    .filter(([tag]) => !needle || tag.includes(needle))
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

function communityScore (community, query) {
  const needle = normalizeText(query)
  if (!needle) return 1
  const name = normalizeText(community && community.name)
  const title = normalizeText(community && community.title)
  const about = normalizeText(community && community.about)
  let score = 0
  if (name === needle) score += 100
  if (name.includes(needle)) score += 60
  if (title === needle) score += 80
  if (title.includes(needle)) score += 40
  if (about.includes(needle)) score += 10
  return score
}

export function rankCommunities (communities, query = '') {
  const seen = new Set()
  return (Array.isArray(communities) ? communities : [])
    .filter(community => {
      if (!community || !community.name || seen.has(community.name)) return false
      seen.add(community.name)
      return true
    })
    .map(community => ({ community, score: communityScore(community, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.community.subscribers || 0) - Number(a.community.subscribers || 0))
    .map(item => item.community)
}

export function rankWitnesses (witnesses, query = '') {
  const needle = normalizeText(query)
  return (Array.isArray(witnesses) ? witnesses : [])
    .filter(witness => witness && witness.owner)
    .filter(witness => !needle || String(witness.owner).toLowerCase().includes(needle) || String(witness.url || '').toLowerCase().includes(needle))
    .sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0))
}

export function rankProposals (proposals, query = '') {
  const needle = normalizeText(query)
  return (Array.isArray(proposals) ? proposals : [])
    .filter(proposal => proposal && (proposal.proposal_id !== undefined || proposal.id !== undefined))
    .filter(proposal => {
      if (!needle) return true
      return [proposal.subject, proposal.creator, proposal.permlink, proposal.proposal_id, proposal.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle))
    })
    .sort((a, b) => Number(b.total_votes || 0) - Number(a.total_votes || 0))
}

/**
 * Explore facets for an author filter: tags and communities they publish in,
 * counting how often each appears in the supplied posts.
 */
export function exploreFacets (posts, { limit = 8 } = {}) {
  const tags = new Map()
  const communities = new Map()
  for (const post of Array.isArray(posts) ? posts : []) {
    const metadata = postMetadata(post)
    for (const tag of Array.isArray(metadata.tags) ? metadata.tags : []) {
      const clean = normalizeText(tag)
      if (!clean || clean.startsWith('hive-')) continue
      tags.set(clean, (tags.get(clean) || 0) + 1)
    }
    const community = normalizeText(post.community)
    if (community) communities.set(community, (communities.get(community) || 0) + 1)
  }
  const toRows = map => [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
  return { tags: toRows(tags), communities: toRows(communities) }
}

/**
 * Aggregate a tag or community's recent posts: posting cadence, top authors,
 * reward distribution, engagement and related tags.
 */
export function tagAnalytics (posts, { now = Date.now(), days = 14, label = '' } = {}) {
  const list = (Array.isArray(posts) ? posts : []).filter(post => post && post.author && post.permlink)
  const windowMs = Math.max(1, Math.min(90, Number(days) || 14)) * 24 * 60 * 60 * 1000
  const recent = list.filter(post => {
    const created = postCreatedMs(post)
    return created > 0 && now - created <= windowMs
  })

  const authors = new Map()
  const related = new Map()
  let totalPayout = 0
  let totalVotes = 0
  let totalComments = 0
  const payouts = []

  for (const post of recent) {
    const payout = postPayoutValue(post)
    totalPayout += payout
    totalVotes += Number(post.stats && post.stats.total_votes) || (Array.isArray(post.active_votes) ? post.active_votes.length : 0)
    totalComments += Number(post.children) || 0
    payouts.push(payout)

    const row = authors.get(post.author) || { author: post.author, posts: 0, payout: 0, votes: 0, lastPostAt: 0 }
    row.posts += 1
    row.payout += payout
    row.votes += Number(post.stats && post.stats.total_votes) || 0
    row.lastPostAt = Math.max(row.lastPostAt, postCreatedMs(post))
    authors.set(post.author, row)

    const metadata = postMetadata(post)
    for (const tag of Array.isArray(metadata.tags) ? metadata.tags : []) {
      const clean = normalizeText(tag)
      if (!clean || clean === normalizeText(label) || clean.startsWith('hive-')) continue
      related.set(clean, (related.get(clean) || 0) + 1)
    }
  }

  payouts.sort((a, b) => a - b)
  const median = payouts.length
    ? (payouts.length % 2 ? payouts[(payouts.length - 1) / 2] : (payouts[payouts.length / 2 - 1] + payouts[payouts.length / 2]) / 2)
    : 0
  const topCount = payouts.length ? Math.max(1, Math.ceil(payouts.length * 0.1)) : 0
  const topShare = payouts.length
    ? payouts.slice(-topCount).reduce((sum, value) => sum + value, 0) / (totalPayout || 1)
    : 0

  const dayKeys = new Map()
  for (let offset = Math.min(14, Math.max(1, Math.floor(windowMs / (24 * 60 * 60 * 1000)))) - 1; offset >= 0; offset--) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000)
    const key = date.toISOString().slice(0, 10)
    dayKeys.set(key, { key, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), count: 0 })
  }
  for (const post of recent) {
    const created = postCreatedMs(post)
    if (!created) continue
    const row = dayKeys.get(new Date(created).toISOString().slice(0, 10))
    if (row) row.count += 1
  }

  const daysWithPosts = new Set(recent.map(post => new Date(postCreatedMs(post)).toISOString().slice(0, 10))).size
  const spanDays = Math.max(1, Math.min(Number(days) || 14, 90))

  return {
    label,
    posts: recent.length,
    authors: authors.size,
    postsPerDay: Math.round((recent.length / spanDays) * 100) / 100,
    activeDays: daysWithPosts,
    totalPayout: Math.round(totalPayout * 1000) / 1000,
    averagePayout: recent.length ? Math.round((totalPayout / recent.length) * 1000) / 1000 : 0,
    medianPayout: Math.round(median * 1000) / 1000,
    topDecileShare: ratio(topShare * 10000) / 100,
    votes: totalVotes,
    comments: totalComments,
    cadence: [...dayKeys.values()],
    topAuthors: [...authors.values()].sort((a, b) => b.posts - a.posts || b.payout - a.payout).slice(0, 8),
    relatedTags: [...related.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 12)
  }
}

/** Stable cache key for a search request, used by the cached read layer. */
export function searchReadKey (plan, state = {}) {
  const normalized = normalizeSearchState(state)
  return [
    plan && plan.query || '',
    plan && plan.accounts || '',
    plan && plan.posts || '',
    plan && plan.tags || '',
    plan && plan.communities || '',
    plan && plan.blocks || '',
    plan && plan.transactions || '',
    plan && plan.proposals || '',
    normalized.sort,
    normalized.period,
    normalized.tags.join(','),
    normalized.communities.join(','),
    normalized.authors.join(',')
  ].join('|')
}
