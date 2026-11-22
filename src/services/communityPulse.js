// Pure, deterministic shaping for the community-pulse dashboard widget.
//
// The widget supplies the bridge community record (or the account's
// subscriptions plus their records) and the top ranked post. All parsing and
// labelling lives here so it can be tested without a node.

import { postCommentCount, postDisplayTitle, postPayoutValue, postVotes } from './posts'
import { cleanCommunityText, communityRoleWeight } from './community'

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  mod: 'Moderator',
  member: 'Member',
  guest: 'Guest'
}

function numberFrom (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function communityRoleLabel (role, guestTitle = '') {
  const key = String(role || '').toLowerCase()
  if (!key) return ''
  if (key === 'guest' && guestTitle) return String(guestTitle)
  if (ROLE_LABELS[key]) return ROLE_LABELS[key]
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function communityLink (name) {
  return name ? '/c/' + name : ''
}

function communityRecord (community) {
  const record = community && typeof community === 'object' ? community : {}
  const name = String(record.name || '')
  return {
    name,
    title: cleanCommunityText(record.title) || name,
    about: cleanCommunityText(record.about),
    subscribers: numberFrom(record.subscribers),
    authors: numberFrom(record.num_authors ?? record.authors),
    pendingRewards: numberFrom(record.sum_pending ?? record.pendingRewards),
    link: communityLink(name),
    nsfw: Boolean(record.settings?.nsfw || record.is_nsfw)
  }
}

function topPostRecord (post) {
  if (!post || typeof post !== 'object') return null
  const payoutHbd = postPayoutValue(post)
  return {
    title: postDisplayTitle(post),
    permlink: String(post.permlink || ''),
    author: String(post.author || ''),
    payoutHbd,
    // HBD is USD-pegged; there is no price feed in this pure summary.
    payoutUsd: payoutHbd,
    votes: postVotes(post),
    comments: postCommentCount(post)
  }
}

function mineCard (row) {
  if (!row || typeof row !== 'object') return null
  const name = String(row.name || '')
  if (!name) return null
  const record = row.record && typeof row.record === 'object' ? row.record : row
  const role = String(row.role || record.role || '').toLowerCase()
  return {
    name,
    title: cleanCommunityText(record.title) || cleanCommunityText(row.title) || name,
    role,
    roleLabel: communityRoleLabel(role, row.guestTitle || ''),
    subscribers: numberFrom(record.subscribers),
    authors: numberFrom(record.num_authors ?? record.authors),
    pendingRewards: numberFrom(record.sum_pending ?? record.pendingRewards),
    link: communityLink(name),
    weight: communityRoleWeight(role)
  }
}

/**
 * Summarise one community (mode `single`) or the account's communities
 * (mode `mine`). Unknown records and posts degrade to empty/zero values.
 */
export function communityPulseSummary ({
  community = null,
  posts = [],
  role = '',
  mode = 'single',
  communities = []
} = {}) {
  const safeMode = mode === 'mine' ? 'mine' : 'single'
  const record = communityRecord(community)
  const normalizedRole = String(role || '').toLowerCase()

  const topPost = (Array.isArray(posts) ? posts : [])
    .filter(post => post && post.author && post.permlink)
    .map(topPostRecord)
    .sort((a, b) => b.payoutHbd - a.payoutHbd || a.title.localeCompare(b.title))[0] || null

  const cards = (Array.isArray(communities) ? communities : [])
    .map(mineCard)
    .filter(Boolean)
    .sort((a, b) =>
      b.weight - a.weight ||
      b.subscribers - a.subscribers ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    )
    .map(({ weight: _weight, ...card }) => card)

  const hasCommunity = safeMode === 'mine'
    ? cards.length > 0
    : Boolean(record.name)

  return {
    mode: safeMode,
    hasCommunity,
    community: record,
    role: normalizedRole,
    roleLabel: communityRoleLabel(normalizedRole),
    topPost,
    communities: cards
  }
}

export default communityPulseSummary
