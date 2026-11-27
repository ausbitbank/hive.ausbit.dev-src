// Viewer-specific short-form feeds: the posts an account reacted to.
//
// Hive has no "things I liked" endpoint. This module reconciles two cheap
// signals instead:
//
//   1. `bridge.account_notifications` for the account. Notifications for a
//      vote, reply or mention carry the URL of the post we touched, so the
//      viewer's own actions are already in hand with no extra reads.
//   2. Reactions *on* our short posts. The site's beneficiary (10% of every
//      like by default) receives those as its own notifications, and each one
//      names the commenter and permlink. Reading that account's notifications
//      gives "who liked which short post" without scanning the containers.
//
// Both paths are bounded: a handful of notification pages, and one
// `bridge.get_post` (plus one parent read) per candidate through a small pool.
//
// Known limitation: a like whose beneficiary share goes to a third party (for
// example a trending page's curation account) is not visible to either path.
// It still shows up on the post itself; the feed is "best effort recent".

import { detectShortForm, getShortFormat, isShortFormContainer } from './shortForm'

/** Hive's default 10% beneficiary cut lands here for posts published by this app. */
export const SHORT_FORM_BENEFICIARY = 'ausbitbank'

const PAGE_LIMIT = 100
const MAX_NOTIFICATION_PAGES = 4
const MAX_ENRICH = 60
const CONCURRENCY = 6

function lower (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function postKey (author, permlink) {
  return lower(author) + '/' + lower(permlink)
}

function urlKey (url) {
  const match = String(url || '').match(/@([a-z0-9.-]+)\/([a-z0-9][a-z0-9-]*)/i)
  return match ? postKey(match[1], match[2]) : ''
}

/** Run `worker` over `items` with a fixed number of in-flight promises. */
async function pool (items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

/** Notifications from `account`, newest first, filtered to reactions we made. */
export async function fetchReactionNotifications (account, { request, pages = MAX_NOTIFICATION_PAGES, limit = PAGE_LIMIT } = {}) {
  const name = lower(account)
  const seen = new Set()
  const entries = []
  let lastId = 0

  for (let page = 0; page < pages; page++) {
    const params = { account: name, limit }
    if (lastId) params.last_id = lastId
    let batch
    try {
      batch = await request('bridge.account_notifications', params)
    } catch {
      break
    }
    if (!Array.isArray(batch) || batch.length === 0) break

    for (const entry of batch) {
      const id = Number(entry && entry.id) || 0
      if (id > lastId) lastId = id
      if (!['vote', 'reply', 'mention', 'reblog'].includes(entry && entry.type)) continue
      const key = urlKey(entry.url)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const [author, permlink] = key.split('/')
      if (author === name) continue
      entries.push({ author, permlink, created: entry.date || '', type: entry.type })
    }
    if (batch.length < limit || !lastId) break
  }
  return entries
}

/**
 * Who liked each comment under the beneficiary's notifications.
 *
 * Returns `{ liker, author, permlink, created }` rows where `author/permlink`
 * is the short post that was liked. Non-comment URLs (our own projects) are
 * skipped so we never mistake a like on an article for a short post.
 */
export async function fetchBeneficiaryReactions ({ request, beneficiary, notifications = MAX_NOTIFICATION_PAGES } = {}) {
  const entries = await fetchReactionNotifications(beneficiary, { request, pages: notifications })
  return entries
    .filter(entry => entry.type === 'reply')
    .map(entry => ({ liker: entry.author }))
}

/** Target posts named by a liker's own notifications (their vote rows). */
export async function fetchLikedTargets (account, { request, pages = 2 } = {}) {
  const entries = await fetchReactionNotifications(account, { request, pages })
  return entries.map(entry => ({ author: entry.author, permlink: entry.permlink, created: entry.created }))
}

/** Read one post plus its parent, so a container comment can be classified. */
async function enrichPost (candidate, request) {
  try {
    const post = await request('bridge.get_post', { author: candidate.author, permlink: candidate.permlink })
    if (!post || !post.author) return null
    let parent = null
    if (post.parent_author) {
      try {
        parent = await request('bridge.get_post', { author: post.parent_author, permlink: post.parent_permlink })
      } catch {
        parent = null
      }
    }
    return { post, parent }
  } catch {
    return null
  }
}

function classify (post, parent) {
  if (!post || !post.author) return null
  if (isShortFormContainer(post)) return null
  const format = detectShortForm(parent ? { ...post, parent_author: parent.author, parent_permlink: parent.permlink } : post)
  if (!format) return null
  return {
    ...post,
    parent_author: parent ? parent.author : '',
    parent_permlink: parent ? parent.permlink : '',
    format,
    _container: parent ? { author: parent.author, permlink: parent.permlink, title: parent.title } : null
  }
}

/**
 * Short posts the account reacted to, newest first.
 *
 * Combines the account's notification history (posts it replied to, mentioned
 * or reblogged) with its own recent short posts, so the feed is useful even
 * before there is history. Duplicates collapse on author/permlink, and each
 * candidate is resolved to its format before it is shown.
 */
export async function fetchLikedShortPosts (account, { limit = 20, request } = {}) {
  const name = lower(account)
  if (!name || typeof request !== 'function') return []

  const [notified, ownPosts] = await Promise.all([
    fetchReactionNotifications(name, { request }),
    fetchAccountShortPosts(name, request)
  ])

  const candidates = new Map()
  for (const item of notified) candidates.set(postKey(item.author, item.permlink), item)
  for (const item of ownPosts) candidates.set(postKey(item.author, item.permlink), item)

  const chosen = [...candidates.values()].slice(0, MAX_ENRICH)
  const enriched = await pool(chosen, CONCURRENCY, async candidate => {
    if (isShortFormContainer(candidate)) return null
    const detected = detectShortForm(candidate)
    if (detected) return { ...candidate, format: detected }
    const result = await enrichPost(candidate, request)
    return result ? classify(result.post, result.parent) : null
  })

  const seen = new Set()
  const out = []
  for (const post of enriched) {
    if (!post) continue
    const key = postKey(post.author, post.permlink)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(post)
    if (out.length >= limit) break
  }
  return out.sort((a, b) => Date.parse(b.created || '') - Date.parse(a.created || ''))
}

const ACCOUNT_PAGE = 20
const ACCOUNT_MAX_PAGES = 6

/** Short posts authored by `account`, newest first (bounded to ~120 posts). */
export async function fetchAccountShortPosts (account, request) {
  const name = lower(account)
  const posts = []
  let startAuthor = ''
  let startPermlink = ''

  for (let page = 0; page < ACCOUNT_MAX_PAGES; page++) {
    const params = { sort: 'posts', account: name, limit: ACCOUNT_PAGE }
    if (startPermlink) {
      params.start_author = startAuthor
      params.start_permlink = startPermlink
    }
    let batch
    try {
      batch = await request('bridge.get_account_posts', params)
    } catch {
      break
    }
    if (!Array.isArray(batch) || batch.length === 0) break
    for (const post of batch) {
      if (isShortFormContainer(post)) continue
      if (detectShortForm(post)) posts.push(post)
    }
    const last = batch[batch.length - 1]
    if (batch.length < ACCOUNT_PAGE || !last || !last.permlink) break
    startAuthor = last.author
    startPermlink = last.permlink
  }
  return posts
}

/** Public profile for a short-form format id, or null. */
export function shortFormatProfile (formatId) {
  return getShortFormat(formatId)
}
