// Cached downvote reads.
//
// History is paged backwards with the vote bitmask. A page is oldest-to-newest
// and raw vote rows carry `weight` only; use `get_active_votes` for current
// rshares/percent. Never block a page on more than a few history pages.

import { apiGetAccountHistoryFiltered, apiGetActiveVotes } from './api'
import { loadCached } from './cache'
import { normalizeHistoryVotes } from './downvotes'
import { normalizeVotes } from './voteBreakdown'

export const VOTE_HISTORY_TTL_MS = 5 * 60 * 1000
export const VOTE_HISTORY_PAGES = 3
export const VOTE_HISTORY_LIMIT = 1000
export const ACTIVE_VOTES_TTL_MS = 5 * 60 * 1000

function historyCacheKey (account, pages) {
  return 'moderation:votes:' + String(account || '').toLowerCase() + ':' + pages
}

function activeCacheKey (author, permlink) {
  return 'moderation:active-votes:' + String(author || '').toLowerCase() + ':' + permlink
}

function gapSequence (error) {
  const sequence = error?.data?.stack?.[0]?.data?.sequence
  const number = Number(sequence)
  return Number.isFinite(number) && number >= 0 ? number : null
}

async function readHistoryPage (account, cursor, limit) {
  try {
    return await apiGetAccountHistoryFiltered(account, cursor, limit, '1', null)
  } catch (error) {
    const sequence = gapSequence(error)
    if (sequence === null) throw error
    return apiGetAccountHistoryFiltered(account, sequence, limit, '1', null)
  }
}

/**
 * Paged received+given downvote history. The result is newest-first and
 * deduplicated by history index. `truncated` means the page cap was reached.
 */
export function fetchAccountVoteHistory (account, {
  pages = VOTE_HISTORY_PAGES,
  force = false
} = {}) {
  const name = String(account || '').trim().toLowerCase()
  const pageCount = Math.max(1, Math.min(5, Number(pages) || VOTE_HISTORY_PAGES))
  if (!name) return Promise.resolve({ rows: [], truncated: false })
  return loadCached(historyCacheKey(name, pageCount), async () => {
    let cursor = -1
    let truncated = false
    const seen = new Set()
    const rows = []

    for (let page = 0; page < pageCount; page++) {
      const response = await readHistoryPage(name, cursor, VOTE_HISTORY_LIMIT)
      if (!Array.isArray(response)) throw new Error('Unexpected vote history response')
      if (!response.length) break
      for (const vote of normalizeHistoryVotes(response)) {
        const key = vote.index !== null ? 'i:' + vote.index : 't:' + vote.trxId + ':' + vote.voter + ':' + vote.target
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(vote)
      }
      const firstIndex = Number(Array.isArray(response[0]) ? response[0][0] : NaN)
      if (!Number.isFinite(firstIndex)) break
      cursor = firstIndex - 1
      if (cursor < 0) break
      if (response.length < VOTE_HISTORY_LIMIT) break
      if (page === pageCount - 1) truncated = true
    }

    rows.sort((a, b) => (b.time || 0) - (a.time || 0) || (Number(b.index) || 0) - (Number(a.index) || 0))
    return { rows, truncated }
  }, {
    ttl: VOTE_HISTORY_TTL_MS,
    force
  })
}

export function fetchActiveVotes (author, permlink, { force = false } = {}) {
  const name = String(author || '').trim().toLowerCase()
  const link = String(permlink || '').trim()
  if (!name || !link) return Promise.resolve([])
  return loadCached(activeCacheKey(name, link), async () => {
    const response = await apiGetActiveVotes(name, link)
    if (!Array.isArray(response)) throw new Error('Unexpected active votes response')
    return normalizeVotes(response)
  }, {
    ttl: ACTIVE_VOTES_TTL_MS,
    force
  })
}
