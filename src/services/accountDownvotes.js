// Cached downvote reads.
//
// History is paged backwards with the vote bitmask. One call reads at most
// VOTE_HISTORY_LIMIT operations and returns a cursor for the next older page,
// so the page can keep loading history for as long as the viewer asks. Raw vote
// rows carry `weight` only; use `get_active_votes` for current rshares/percent.

import { apiGetAccountHistoryFiltered, apiGetActiveVotes } from './api'
import { loadCached } from './cache'
import { normalizeHistoryVotes } from './downvotes'
import { normalizeVotes } from './voteBreakdown'

export const VOTE_HISTORY_TTL_MS = 5 * 60 * 1000
/** Pages fetched before the viewer asks for more. */
export const VOTE_HISTORY_PAGES = 3
/** Maximum operations read per history call (the condenser API cap). */
export const VOTE_HISTORY_LIMIT = 1000
export const ACTIVE_VOTES_TTL_MS = 5 * 60 * 1000

function historyCacheKey (account, cursor) {
  return 'moderation:votes:' + String(account || '').toLowerCase() + ':cursor:' + cursor
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

function sortHistoryVotes (rows) {
  return rows.sort((a, b) => (b.time || 0) - (a.time || 0) || (Number(b.index) || 0) - (Number(a.index) || 0))
}

/**
 * One page of vote history. `cursor` is the history index to read backwards
 * from (-1 starts at the newest operation). The result is newest-first with
 * `nextCursor` for the next older page; `hasMore` is false when the chain has
 * no older operations or this page was shorter than the API limit.
 */
export function fetchAccountVoteHistoryPage (account, { cursor = -1, force = false } = {}) {
  const name = String(account || '').trim().toLowerCase()
  if (!name) return Promise.resolve({ rows: [], scanned: 0, nextCursor: null, hasMore: false })
  const start = Number(cursor)
  const safeCursor = Number.isFinite(start) && start >= 0 ? Math.floor(start) : -1
  return loadCached(historyCacheKey(name, safeCursor), async () => {
    const response = await readHistoryPage(name, safeCursor, VOTE_HISTORY_LIMIT)
    if (!Array.isArray(response)) throw new Error('Unexpected vote history response')
    const firstIndex = Number(Array.isArray(response[0]) ? response[0][0] : NaN)
    const next = Number.isFinite(firstIndex) && firstIndex > 0 ? firstIndex - 1 : null
    const hasMore = response.length >= VOTE_HISTORY_LIMIT && next !== null
    return {
      rows: sortHistoryVotes(normalizeHistoryVotes(response)),
      scanned: response.length,
      nextCursor: hasMore ? next : null,
      hasMore
    }
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
