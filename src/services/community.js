// Community insight helpers and API wrapper.
//
// `bridge.get_ranked_posts` already powers the community feed, so the insight
// panel reuses it with a larger page instead of introducing another data
// source. All aggregation is pure and defensive: bridge responses vary between
// nodes and a missing payout field should degrade to zero, not NaN.

import { bridgeRequest } from './api'
import moment from '../utils/time'

const DAY_MS = 24 * 60 * 60 * 1000

function numberFrom (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function postPayout (post) {
  return numberFrom(post?.payout ?? post?.pending_payout_value ?? post?.total_payout_value)
}

function postTime (post) {
  const value = post?.created || post?.updated
  if (!value) return null
  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

function topLevelPosts (posts) {
  return (Array.isArray(posts) ? posts : []).filter(post => {
    if (!post?.author || !post?.permlink) return false
    return !post.parent_author || post.parent_author === ''
  })
}

function utcDayKey (timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/**
 * Aggregate a community's recent posts into the insight card's shape.
 */
export function communityInsights (posts, options = {}) {
  const now = options.now ? Number(new Date(options.now)) : Date.now()
  const communityInfo = options.communityInfo || null
  const mutedPosts = options.mutedPosts || []
  const list = topLevelPosts(posts)
  const days = Math.max(1, Math.min(30, Number(options.days) || 14))

  const authorMap = new Map()
  let totalPayout = 0
  let posts7d = 0
  let posts30d = 0
  let lastPostAt = null

  for (const post of list) {
    const created = postTime(post)
    const payout = postPayout(post)
    const author = post.author
    totalPayout += payout

    if (created !== null) {
      if (now - created <= 7 * DAY_MS) posts7d += 1
      if (now - created <= 30 * DAY_MS) posts30d += 1
      if (lastPostAt === null || created > lastPostAt) lastPostAt = created
    }

    if (!authorMap.has(author)) {
      authorMap.set(author, { author, posts: 0, payout: 0, replies: 0, votes: 0, lastPostAt: null })
    }
    const row = authorMap.get(author)
    row.posts += 1
    row.payout += payout
    row.replies += numberFrom(post.children ?? post.replies)
    row.votes += numberFrom(post.active_votes?.length ?? post.votes)
    if (created !== null && (row.lastPostAt === null || created > row.lastPostAt)) row.lastPostAt = created
  }

  const authors = [...authorMap.values()]
    .sort((a, b) => b.posts - a.posts || b.payout - a.payout || a.author.localeCompare(b.author))
  const activeAuthors7d = authors.filter(row => row.lastPostAt !== null && now - row.lastPostAt <= 7 * DAY_MS).length

  const payouts = list.map(postPayout).sort((a, b) => a - b)
  const medianPayout = payouts.length
    ? (payouts.length % 2 === 1
        ? payouts[(payouts.length - 1) / 2]
        : (payouts[payouts.length / 2 - 1] + payouts[payouts.length / 2]) / 2)
    : 0
  const averagePayout = payouts.length ? totalPayout / payouts.length : 0
  const topTenCount = Math.max(1, Math.ceil(payouts.length * 0.1))
  const topTenPayout = payouts.slice(-topTenCount).reduce((sum, value) => sum + value, 0)

  const cadence = []
  const today = new Date(now)
  for (let offset = days - 1; offset >= 0; offset--) {
    const timestamp = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)
    cadence.push({
      key: utcDayKey(timestamp),
      timestamp,
      label: new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: 0
    })
  }
  const cadenceByKey = new Map(cadence.map(row => [row.key, row]))
  for (const post of list) {
    const created = postTime(post)
    if (created === null) continue
    const row = cadenceByKey.get(utcDayKey(created))
    if (row) row.count += 1
  }

  const settings = communityInfo?.settings || {}
  const mutedCount = Array.isArray(mutedPosts) ? mutedPosts.filter(post => post?.author).length : 0
  const flagText = String(settings.flag_text || communityInfo?.flag_text || '').trim()

  return {
    subscribers: numberFrom(communityInfo?.subscribers),
    pendingRewards: numberFrom(communityInfo?.sum_pending),
    weeklyInteractions: numberFrom(communityInfo?.num_pending),
    createdAt: communityInfo?.created_at || null,
    postCount: list.length,
    posts7d,
    posts30d,
    activeAuthors7d,
    totalAuthors: authors.length,
    totalPayout,
    medianPayout,
    averagePayout,
    topTenShare: totalPayout > 0 ? topTenPayout / totalPayout : 0,
    lastPostAt,
    cadence,
    peakCadence: cadence.reduce((max, row) => Math.max(max, row.count), 0),
    authors: authors.slice(0, 8),
    mutedCount,
    flagText,
    nsfw: Boolean(settings.nsfw || communityInfo?.is_nsfw),
    restricted: Boolean(settings.restricted || settings.posting_restricted),
    moderationSignals: (flagText ? 1 : 0) + (mutedCount > 0 ? 1 : 0) + (settings.nsfw ? 1 : 0) + (settings.restricted ? 1 : 0)
  }
}

export async function fetchCommunityInsightData (name, options = {}) {
  if (!name) return { posts: [], mutedPosts: [], pages: 0, truncated: false }

  // bridge.get_ranked_posts caps `limit` at 20 on public nodes. Page through
  // the created feed until a page is short, the oldest post is outside the
  // 30-day window, or the page budget is reached.
  const pageSize = Math.max(1, Math.min(20, Number(options.pageSize) || 20))
  const maxPages = Math.max(1, Math.min(10, Number(options.maxPages) || 5))
  const now = options.now ? Number(new Date(options.now)) : Date.now()
  const oldestUseful = now - 31 * 24 * 60 * 60 * 1000
  const posts = []
  let startAuthor = ''
  let startPermlink = ''
  let pages = 0
  let truncated = false

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const params = { sort: 'created', tag: name, limit: pageSize }
    if (startAuthor) {
      params.start_author = startAuthor
      params.start_permlink = startPermlink
    }

    let page
    try {
      page = await bridgeRequest('get_ranked_posts', params)
    } catch (error) {
      if (pageIndex === 0 || options.throwOnError) throw error
      break
    }

    if (!Array.isArray(page)) {
      if (pageIndex === 0) throw new Error('Unexpected community feed response')
      break
    }
    if (page.length === 0) break
    pages += 1
    posts.push(...page)

    const last = page[page.length - 1]
    if (page.length < pageSize || !last?.author || !last?.permlink) break

    const lastCreated = postTime(last)
    if (lastCreated !== null && lastCreated < oldestUseful) break

    startAuthor = last.author
    startPermlink = last.permlink
    if (pageIndex === maxPages - 1) truncated = true
  }

  const seen = new Set()
  const uniquePosts = posts.filter(post => {
    if (!post?.author || !post?.permlink) return false
    const key = post.author + '/' + post.permlink
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let mutedPosts = []
  try {
    mutedPosts = await bridgeRequest('get_ranked_posts', { sort: 'muted', tag: name, limit: 20 })
  } catch (error) {
    if (options.throwOnError) throw error
  }

  return {
    posts: uniquePosts,
    mutedPosts: Array.isArray(mutedPosts) ? mutedPosts : [],
    pages,
    truncated
  }
}
