// Network reads for the downvote deep-dive.
//
// Target posts are read once per author/permlink and cached; the page can ask
// for a bounded batch of them without turning a long history into hundreds of
// simultaneous RPC calls. Discussions and voter comment feeds are lazy reads
// used only when the viewer opens the context drawer.

import { apiGetContent, bridgeRequest } from './api'
import { loadCached } from './cache'
import { fetchAccountVoteHistoryPage } from './accountDownvotes'

export const DOWNVOTE_SOURCE_TTL_MS = 5 * 60 * 1000
export const DOWNVOTE_TARGET_CAP = 500
export const DOWNVOTE_CONCURRENCY = 4

function targetKey (author, permlink) {
  return String(author || '').toLowerCase() + '/' + String(permlink || '')
}

export function splitTarget (target) {
  const text = String(target || '')
  const slash = text.indexOf('/')
  if (slash <= 0) return null
  return { author: text.slice(0, slash).toLowerCase(), permlink: text.slice(slash + 1) }
}

/**
 * One target post with payout, active votes and timestamps.
 *
 * A malformed/OpenAPI-shaped response is rejected so it is not cached as a
 * post without an author.
 */
export function fetchDownvoteTargetPost (author, permlink, { force = false } = {}) {
  const key = targetKey(author, permlink)
  if (!author || !permlink) return Promise.resolve(null)
  return loadCached('downvote:post:' + key, async () => {
    const post = await apiGetContent(author, permlink)
    if (!post || !post.author) throw new Error('Unexpected post response')
    return post
  }, {
    ttl: DOWNVOTE_SOURCE_TTL_MS,
    force
  })
}

/**
 * Fetch a bounded batch of target posts. Failures do not reject the batch; the
 * caller gets the posts that resolved plus the targets that failed.
 */
export async function fetchDownvoteTargetPosts (targets, {
  force = false,
  concurrency = DOWNVOTE_CONCURRENCY,
  maxTargets = DOWNVOTE_TARGET_CAP,
  onProgress = null
} = {}) {
  const unique = [...new Set((Array.isArray(targets) ? targets : []).filter(Boolean))]
    .slice(0, Math.max(1, Number(maxTargets) || DOWNVOTE_TARGET_CAP))
  const posts = {}
  const failed = []
  let index = 0
  let done = 0
  const workers = Math.max(1, Math.min(Number(concurrency) || DOWNVOTE_CONCURRENCY, unique.length || 1))

  async function worker () {
    while (index < unique.length) {
      const target = unique[index++]
      const parts = splitTarget(target)
      if (!parts) {
        failed.push(target)
      } else {
        try {
          const post = await fetchDownvoteTargetPost(parts.author, parts.permlink, { force })
          if (post) posts[target] = post
          else failed.push(target)
        } catch {
          failed.push(target)
        }
      }
      done += 1
      if (onProgress) onProgress({ done, total: unique.length, failed: failed.length, target })
    }
  }

  await Promise.all(Array.from({ length: workers }, worker))
  return { posts, failed, total: unique.length }
}

/** Full discussion map for a target post. */
export function fetchDownvoteDiscussion (author, permlink, { force = false } = {}) {
  const key = targetKey(author, permlink)
  if (!author || !permlink) return Promise.resolve({})
  return loadCached('downvote:discussion:' + key, async () => {
    const discussion = await bridgeRequest('get_discussion', { author, permlink })
    if (!discussion || typeof discussion !== 'object' || Array.isArray(discussion)) {
      throw new Error('Unexpected discussion response')
    }
    return discussion
  }, {
    ttl: DOWNVOTE_SOURCE_TTL_MS,
    force
  })
}

/** Recent comments written by one voter, newest first. */
export function fetchVoterComments (voter, { limit = 20, force = false } = {}) {
  const name = String(voter || '').toLowerCase()
  const count = Math.max(1, Math.min(50, Number(limit) || 20))
  if (!name) return Promise.resolve([])
  return loadCached('downvote:voter-comments:' + name + ':' + count, async () => {
    const posts = await bridgeRequest('get_account_posts', { sort: 'comments', account: name, limit: count })
    if (!Array.isArray(posts)) throw new Error('Unexpected voter comments response')
    return posts
  }, {
    ttl: DOWNVOTE_SOURCE_TTL_MS,
    force
  })
}

/**
 * A small sample of the voter's own vote history, used to show how much of
 * their recent downvoting is aimed at this profile.
 */
export async function fetchVoterRecentVotes (voter, { pages = 2, force = false } = {}) {
  const name = String(voter || '').toLowerCase()
  const pageCount = Math.max(1, Math.min(5, Number(pages) || 2))
  if (!name) return { rows: [], scanned: 0, hasMore: false }
  const rows = []
  let cursor = -1
  let scanned = 0
  let hasMore = true
  for (let page = 0; page < pageCount && hasMore; page++) {
    const result = await fetchAccountVoteHistoryPage(name, { cursor, force })
    rows.push(...result.rows.filter(row => row.weight < 0))
    scanned += result.scanned
    cursor = result.nextCursor
    hasMore = Boolean(result.hasMore && cursor !== null)
  }
  return { rows, scanned, hasMore }
}
