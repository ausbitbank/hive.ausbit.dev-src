// Global state for the quick-look post peek.
//
// The peek is a single overlay hosted by MainLayout so every feed can open it
// from a preview card without each card carrying its own dialog. The seed post
// is kept so the card's reactive object can be merged with the full read and
// its vote state can update without refreshing the feed.

import { reactive } from 'vue'

const LOCAL_VOTE_TTL_MS = 10 * 60 * 1000

// Optimistic votes survive a peek close/reopen and a feed remount. The map is
// reactive so a card's vote pill recomputes as soon as a vote is queued.
const localVotes = reactive(new Map())

export const postPeek = reactive({
  open: false,
  seed: null,
  author: '',
  permlink: '',
  key: '',
  nonce: 0,
  openedFromCard: false
})

export function peekKey (author, permlink) {
  if (!author || !permlink) return ''
  return '@' + author + '/' + permlink
}

/** Parse `@author/permlink` (the leading @ is optional). */
export function parsePeekKey (value) {
  const raw = String(value || '').trim().replace(/^@/, '')
  const slash = raw.indexOf('/')
  if (slash <= 0 || slash === raw.length - 1) return null
  const author = raw.slice(0, slash).trim()
  const permlink = raw.slice(slash + 1).trim()
  if (!author || !permlink || permlink.includes('/')) return null
  return { author, permlink, key: peekKey(author, permlink) }
}

function setPeek (post, { openedFromCard }) {
  if (!post || !post.author || !post.permlink) return false
  const key = peekKey(post.author, post.permlink)
  if (postPeek.open && postPeek.key === key) {
    if (post.body) postPeek.seed = post
    postPeek.openedFromCard = openedFromCard
    return true
  }
  postPeek.seed = post
  postPeek.author = post.author
  postPeek.permlink = post.permlink
  postPeek.key = key
  postPeek.open = true
  postPeek.openedFromCard = openedFromCard
  postPeek.nonce += 1
  return true
}

/** Open from a preview card. The seed enables instant paint and card sync. */
export function openPostPeek (post) {
  return setPeek(post, { openedFromCard: true })
}

/** Open from `?peek=@author/permlink`; there may be no card seed on the page. */
export function openPostPeekFromRoute (author, permlink) {
  return setPeek({ author, permlink }, { openedFromCard: false })
}

export function closePostPeek () {
  postPeek.open = false
  postPeek.seed = null
  postPeek.author = ''
  postPeek.permlink = ''
  postPeek.key = ''
  postPeek.openedFromCard = false
}

/**
 * Record a vote queued from the peek. `weight` is the signed percentage used
 * by the vote control (for example -100 for a full downvote).
 */
export function noteLocalPeekVote (author, permlink, voter, weight) {
  const key = peekKey(author, permlink)
  const value = Number(weight)
  if (!key || !voter) return
  if (!Number.isFinite(value) || value === 0) {
    localVotes.delete(key)
    return
  }
  localVotes.set(key, { voter, weight: value, at: Date.now() })
}

/** Latest optimistic vote for a post, if it is still fresh and for this voter. */
export function localVoteFor (post, voter, now = Date.now()) {
  if (!post || !voter) return null
  const key = peekKey(post.author, post.permlink)
  const record = localVotes.get(key)
  if (!record) return null
  if (now - record.at > LOCAL_VOTE_TTL_MS) {
    localVotes.delete(key)
    return null
  }
  if (record.voter !== voter) return null
  return { direction: Math.sign(record.weight), weight: record.weight, voter: record.voter }
}

/**
 * Apply an optimistic vote to a freshly fetched post so reopening the peek
 * does not briefly show the pre-vote chain state.
 */
export function applyLocalPeekVote (post, voter, now = Date.now()) {
  const local = localVoteFor(post, voter, now)
  if (!local || !post) return post
  const votes = Array.isArray(post.active_votes) ? [...post.active_votes] : []
  const index = votes.findIndex(vote => vote && vote.voter === local.voter)
  if (local.direction === 0) {
    if (index !== -1) votes.splice(index, 1)
  } else if (index === -1) {
    votes.push({
      voter: local.voter,
      percent: local.weight * 100,
      rshares: local.weight,
      weight: local.weight,
      time: new Date(now).toISOString()
    })
  }
  post.active_votes = votes
  return post
}

/** Test helper: clear optimistic votes between cases. */
export function resetLocalPeekVotes () {
  localVotes.clear()
}
