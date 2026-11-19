// Pure helpers for post previews and browse listings.
import { stripHtml } from '../utils/safeHtml'
import { formatReputation } from './comments'

/** Parse `json_metadata`, which may be an object (bridge) or a string (condenser). */
export function postMetadata (post) {
  const metadata = post && post.json_metadata
  if (!metadata) return {}
  if (typeof metadata === 'object') return metadata
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Best available display title, including comment/reply fallbacks. */
export function postDisplayTitle (post) {
  const title = stripHtml(post && post.title)
  if (title) return title
  const author = (post && post.author) || 'unknown'
  if (postIsComment(post)) return 'Comment by @' + author
  return 'Post by @' + author
}

export function postIsComment (post) {
  return Boolean(post && (post.parent_author || Number(post.depth) > 0))
}

/** Clean tags for chips, excluding the community id and duplicates. */
export function postTags (post, limit = 3) {
  const tags = postMetadata(post).tags
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  const cleaned = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const value = tag.trim()
    if (!value || value.startsWith('hive-') || seen.has(value)) continue
    seen.add(value)
    cleaned.push(value)
    if (cleaned.length >= limit) break
  }
  return cleaned
}

export function postCommunityTitle (post) {
  return (post && post.community_title) || ''
}

/** Combined pending/paid payout as a number. */
export function postPayoutValue (post) {
  const pending = parseFloat(post && post.pending_payout_value)
  const paid = Number(post && post.payout)
  const values = [pending, paid].filter(value => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : 0
}

export function postPayoutLabel (post) {
  const value = postPayoutValue(post)
  return value > 0 ? value.toFixed(3) + ' HBD' : '0 HBD'
}

export function postVotes (post) {
  const votes = post && post.stats && post.stats.total_votes
  if (votes !== undefined && votes !== null) return Number(votes) || 0
  return Array.isArray(post && post.active_votes) ? post.active_votes.length : 0
}

/**
 * Direction of a vote weight. Bridge and condenser sometimes serialise
 * `rshares`/`percent` as strings, so coerce before taking the sign.
 * Returns 1 for upvotes, -1 for downvotes and 0 for a neutral/zero vote.
 */
export function voteDirection (vote) {
  if (!vote) return 0
  const rshares = Number(vote.rshares)
  if (Number.isFinite(rshares) && rshares !== 0) return Math.sign(rshares)
  const percent = Number(vote.percent)
  if (Number.isFinite(percent) && percent !== 0) return Math.sign(percent)
  return 0
}

/**
 * The logged-in user's own vote on a post, if any (case-insensitive voter
 * match). Returns `undefined` when the user has not voted or is logged out.
 */
export function postUserVote (post, username) {
  if (!post || !username) return undefined
  const voter = String(username).toLowerCase()
  const votes = Array.isArray(post.active_votes) ? post.active_votes : []
  return votes.find(vote => vote && String(vote.voter || '').toLowerCase() === voter)
}

/**
 * "up" / "down" for the user's vote on a post, or `null` when they have not
 * voted (or voted at neutral weight). Used by browse cards to make the user's
 * own vote obvious at a glance.
 */
export function postUserVoteDirection (post, username) {
  const direction = voteDirection(postUserVote(post, username))
  if (direction > 0) return 'up'
  if (direction < 0) return 'down'
  return null
}

export function postCommentCount (post) {
  return Number(post && post.children) || 0
}

export function postRebloggers (post) {
  return Array.isArray(post && post.reblogged_by) ? post.reblogged_by : []
}

/**
 * Bridge returns a display reputation (e.g. 73.44) while condenser returns the
 * raw chain value. Handle both so cards show the familiar score.
 */
export function formatPostReputation (value) {
  const reputation = Number(value)
  if (!Number.isFinite(reputation) || reputation === 0) return null
  if (reputation > 1e9) return formatReputation(reputation)
  return reputation >= 100 ? String(Math.round(reputation)) : String(Math.round(reputation * 10) / 10)
}
