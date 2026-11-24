// Pure shaping for the Hive news digest widget.
//
// There is no editorial "Hive news" endpoint. This is an explicitly curated
// merge of a few ecosystem accounts' blog feeds; the list is a setting and the
// card says it is curated rather than pretending to be a news desk.

import { postCommentCount, postDisplayTitle, postPayoutValue, postVotes } from './posts'

export const NEWS_ACCOUNTS = ['hiveio', 'ecency', 'peakd', 'leofinance']
export const MAX_NEWS_ACCOUNTS = 5
export const MAX_NEWS_ITEMS = 12

const ACCOUNT_NAME = /^[a-z0-9][a-z0-9.-]{1,15}$/

function timestamp (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const parsed = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(parsed) ? parsed : 0
}

function normaliseAccount (value) {
  const name = String(value ?? '').trim().replace(/^@/, '').toLowerCase()
  return ACCOUNT_NAME.test(name) ? name : ''
}

/** Keep the configured order, drop duplicates and bound the list. */
export function normaliseNewsAccounts (accounts) {
  const result = []
  for (const value of Array.isArray(accounts) ? accounts : []) {
    const name = normaliseAccount(value)
    if (!name || result.includes(name)) continue
    result.push(name)
    if (result.length >= MAX_NEWS_ACCOUNTS) break
  }
  return result
}

function item (post, feedAccount) {
  if (!post || typeof post !== 'object' || !post.author || !post.permlink) return null
  const created = String(post.created || '')
  return {
    id: String(post.author) + '/' + String(post.permlink),
    title: postDisplayTitle(post),
    author: String(post.author),
    permlink: String(post.permlink),
    community: String(post.community || ''),
    source: feedAccount,
    created,
    createdAt: timestamp(created),
    payoutHbd: postPayoutValue(post),
    votes: postVotes(post),
    comments: postCommentCount(post),
    pending: post.is_paidout === false || post.is_paidout === 'false'
  }
}

/**
 * Merge curated feeds into one digest.
 *
 * `feeds` is `[{ account, posts, error }]`. Failures are reported per source
 * and never discard the other feeds. Posts are deduplicated by
 * author/permlink and sorted newest first.
 */
export function newsDigestSummary ({ accounts = [], feeds = [], limit = 6 } = {}) {
  const configured = normaliseNewsAccounts(accounts)
  const bySource = new Map()
  for (const feed of Array.isArray(feeds) ? feeds : []) {
    const account = normaliseAccount(feed?.account)
    if (!account) continue
    bySource.set(account, feed)
  }

  const seen = new Set()
  const posts = []
  const failures = []
  for (const account of configured) {
    const feed = bySource.get(account)
    if (!feed) continue
    if (feed.error) {
      failures.push({ account, error: String(feed.error) })
      continue
    }
    for (const post of Array.isArray(feed.posts) ? feed.posts : []) {
      const row = item(post, account)
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      posts.push(row)
    }
  }

  posts.sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title))
  const count = Math.max(1, Math.min(MAX_NEWS_ITEMS, Number(limit) || 6))

  return {
    accounts: configured,
    posts: posts.slice(0, count),
    total: posts.length,
    failures,
    hasData: posts.length > 0,
    partial: failures.length > 0
  }
}

export default newsDigestSummary
