// Comment context for a downvote.
//
// A Hive vote has no memo. The closest public evidence is a comment by the
// voter in the target discussion, or on another post by the same author around
// the vote. This module turns discussion/vote-comment feeds into short,
// attributable excerpts. It never labels an inferred reason as fact.

import { flattenDiscussion } from './comments'
import { parseChainTime } from './downvoteImpact'

const DAY_MS = 24 * 60 * 60 * 1000

export const REASON_KEYWORDS = [
  'downvote',
  'flag',
  'reason',
  'because',
  'spam',
  'plagiar',
  'abuse',
  'scam',
  'off-topic',
  'off topic',
  'why'
]

/** Strip enough markdown/HTML to make a readable plain-text excerpt. */
export function stripMarkdown (value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~`>#]+/g, ' ')
    .replace(/^\s*[-+]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerpt (value, maxLength = 240) {
  const text = stripMarkdown(value)
  if (text.length <= maxLength) return text
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…'
}

export function keywordHits (value) {
  const text = String(value || '').toLowerCase()
  return REASON_KEYWORDS.filter(keyword => text.includes(keyword))
}

function relativeToVote (createdMs, voteTime) {
  if (!createdMs || !voteTime) return 'unknown'
  return createdMs < voteTime ? 'before' : createdMs > voteTime ? 'after' : 'at'
}

function commentView (item, voteTime, author) {
  const comment = item.comment || item
  const createdMs = parseChainTime(comment.created)
  const parentAuthor = String(comment.parent_author || '').toLowerCase()
  return {
    author: String(comment.author || '').toLowerCase(),
    permlink: String(comment.permlink || ''),
    parentAuthor,
    parentPermlink: String(comment.parent_permlink || ''),
    depth: Number(item.depth) || Number(comment.depth) || 1,
    created: comment.created || '',
    createdMs,
    relativeToVote: relativeToVote(createdMs, voteTime),
    isAuthorReply: Boolean(author && String(comment.author || '').toLowerCase() === author),
    excerpt: excerpt(comment.body),
    keywords: keywordHits(comment.body),
    link: '/@' + String(comment.author || '').toLowerCase() + '/' + String(comment.permlink || ''),
    parentLink: '/@' + parentAuthor + '/' + String(comment.parent_permlink || '')
  }
}

/**
 * Comments by the voter in the target discussion, plus the author's replies to
 * that voter. The result is ordered oldest first so the UI can show the
 * exchange as a timeline.
 */
export function extractVoteContext (discussion, { author, permlink, voter, voteTime = 0 } = {}) {
  const rootKey = String(author || '').toLowerCase() + '/' + String(permlink || '')
  const comments = flattenDiscussion(discussion, rootKey, { sort: 'old' })
  const voterName = String(voter || '').toLowerCase()
  const authorName = String(author || '').toLowerCase()
  const voterComments = comments
    .filter(item => String(item.comment?.author || '').toLowerCase() === voterName)
    .map(item => commentView(item, voteTime, authorName))
    .sort((a, b) => a.createdMs - b.createdMs)
  const authorReplies = comments
    .filter(item => {
      const comment = item.comment || {}
      return String(comment.author || '').toLowerCase() === authorName &&
        String(comment.parent_author || '').toLowerCase() === voterName
    })
    .map(item => commentView(item, voteTime, authorName))
    .sort((a, b) => a.createdMs - b.createdMs)
  return {
    voterComments,
    authorReplies,
    count: voterComments.length,
    hasVoterComment: voterComments.length > 0,
    keywords: [...new Set(voterComments.flatMap(comment => comment.keywords))]
  }
}

/**
 * Comments the voter wrote on the author's other posts around the vote.
 *
 * `posts` is a `bridge.get_account_posts` comment feed for the voter. Only
 * comments whose parent is the profile owner are kept, and the window is
 * measured from the vote time.
 */
export function extractVoterComments (posts, { voter, author, voteTime = 0, windowDays = 14 } = {}) {
  const voterName = String(voter || '').toLowerCase()
  const authorName = String(author || '').toLowerCase()
  const windowMs = Math.max(1, Number(windowDays) || 14) * DAY_MS
  const comments = (Array.isArray(posts) ? posts : [])
    .filter(post => post && String(post.author || '').toLowerCase() === voterName)
    .filter(post => String(post.parent_author || '').toLowerCase() === authorName)
    .map(post => ({
      ...commentView({ comment: post }, voteTime, authorName),
      distanceMs: Math.abs((parseChainTime(post.created) || 0) - (Number(voteTime) || 0))
    }))
    .filter(comment => !voteTime || comment.distanceMs <= windowMs)
    .sort((a, b) => a.distanceMs - b.distanceMs)
    .slice(0, 20)
  return {
    comments,
    count: comments.length,
    windowDays: Math.max(1, Number(windowDays) || 14)
  }
}

/** Merge target-thread and elsewhere-on-the-author comments without repeats. */
export function mergeVoteContext (targetContext, voterContext) {
  const target = targetContext || { voterComments: [], authorReplies: [], keywords: [] }
  const elsewhere = voterContext || { comments: [], count: 0 }
  const seen = new Set()
  const otherComments = []
  for (const comment of elsewhere.comments || []) {
    if (seen.has(comment.link)) continue
    seen.add(comment.link)
    if ((target.voterComments || []).some(item => item.link === comment.link)) continue
    otherComments.push(comment)
  }
  return {
    voterComments: target.voterComments || [],
    authorReplies: target.authorReplies || [],
    otherComments,
    count: (target.voterComments || []).length + otherComments.length,
    hasVoterComment: (target.voterComments || []).length > 0 || otherComments.length > 0,
    keywords: [...new Set([
      ...(target.keywords || []),
      ...otherComments.flatMap(comment => comment.keywords || [])
    ])],
    windowDays: elsewhere.windowDays || 14
  }
}
