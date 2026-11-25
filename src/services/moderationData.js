// Cached reads for the moderation layer.
//
// `bridge.get_follow_list` returns the entire list and rejects a `limit`
// argument on the live node (verified 2026-11-24). We therefore cache the full
// normalized list and expose a bounded snapshot to the policy. A malformed
// response is an error, not an empty list: the skin gate must be able to fail
// closed when it cannot prove an author is safe.

import { bridgeRequest } from './api'
import { loadCached } from './cache'
import { fetchFollowingNames } from './chainData'
import { normalizeName } from './moderationPolicy'

export const MODERATION_LIST_TTL_MS = 5 * 60 * 1000
export const MODERATION_LIST_MAX = 10000
export const MODERATION_FOLLOWED_LIST_MAX = 20
export const MODERATION_FOLLOW_TYPES = ['muted', 'blacklisted', 'follow_muted', 'follow_blacklist']

const DESCRIPTION_MAX = 200

function normalizeDescription (value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, DESCRIPTION_MAX)
}

function normalizeListEntries (response) {
  if (!Array.isArray(response)) {
    throw new Error('Unexpected moderation list response')
  }
  const seen = new Set()
  const entries = []
  let truncated = false
  for (const row of response) {
    const name = normalizeName(row && typeof row === 'object' ? row.name : row)
    if (!name || seen.has(name)) continue
    if (entries.length >= MODERATION_LIST_MAX) {
      // There is at least one more unique member beyond the index cap. Keep
      // scanning only to report an honest state, never to retain the names.
      truncated = true
      break
    }
    seen.add(name)
    entries.push({
      name,
      description: normalizeDescription(
        row && typeof row === 'object'
          ? (row.muted_list_description || row.blacklist_description)
          : ''
      )
    })
  }
  return {
    entries,
    truncated,
    total: response.length
  }
}

function assertFollowType (followType) {
  const type = String(followType || '')
  if (!MODERATION_FOLLOW_TYPES.includes(type)) {
    throw new Error('Unsupported moderation list type')
  }
  return type
}

export function moderationListCacheKey (account, followType) {
  return 'moderation:list:' + followType + ':' + normalizeName(account)
}

/**
 * Cached `bridge.get_follow_list` snapshot for one account and list type.
 * The snapshot keeps the list description and whether the client's bounded
 * index dropped any unique names. A partial index must be visible, not silent.
 */
export function fetchModerationListSnapshot (account, followType, { force = false } = {}) {
  const name = normalizeName(account)
  const type = assertFollowType(followType)
  if (!name) return Promise.resolve({ entries: [], truncated: false, total: 0 })
  return loadCached(moderationListCacheKey(name, type), async () => {
    const response = await bridgeRequest('get_follow_list', {
      observer: name,
      follow_type: type
    })
    return normalizeListEntries(response)
  }, {
    ttl: MODERATION_LIST_TTL_MS,
    force
  })
}

export function fetchModerationListEntries (account, followType, options = {}) {
  return fetchModerationListSnapshot(account, followType, options).then(snapshot => snapshot.entries)
}

export async function fetchModerationListNames (account, followType, { force = false } = {}) {
  const entries = await fetchModerationListEntries(account, followType, { force })
  return entries.map(entry => entry.name)
}

function emptyContext (status = 'ready') {
  return {
    status,
    muted: [],
    blacklisted: [],
    following: [],
    followedMuteOwners: [],
    followedBlacklistOwners: [],
    followedMuteLists: [],
    followedBlacklistLists: [],
    listErrors: 0,
    listTruncated: [],
    loadedAt: 0
  }
}

function truncationRow (owner, type, snapshot) {
  if (!snapshot || snapshot.truncated !== true) return null
  return {
    owner: normalizeName(owner),
    type,
    indexed: snapshot.entries.length,
    total: Math.max(snapshot.entries.length, Number(snapshot.total) || 0)
  }
}

function addTruncation (rows, row) {
  if (!row || !row.owner) return
  if (rows.some(item => item.owner === row.owner && item.type === row.type)) return
  rows.push(row)
}

/**
 * Resolve everything the skin gate needs for one viewer.
 *
 * A failure in the viewer's own mute/blacklist reads rejects; the store will
 * fail closed. A failure reading a subscribed list is counted in `listErrors`
 * so the policy can be conservative for authors that are not followed.
 */
export async function fetchViewerModerationContext (account, {
  force = false,
  maxFollowedLists = MODERATION_FOLLOWED_LIST_MAX
} = {}) {
  const viewer = normalizeName(account)
  if (!viewer) return emptyContext()

  const [following, mutedSnapshot, followMutedSnapshot] = await Promise.all([
    fetchFollowingNames(viewer, { force }),
    fetchModerationListSnapshot(viewer, 'muted', { force }),
    fetchModerationListSnapshot(viewer, 'follow_muted', { force })
  ])

  // Blacklists are warning labels, not mutes. A failure there must not block
  // every skin; Phase 1 can surface the missing warning context separately.
  const [blacklistResult, followBlacklistResult] = await Promise.allSettled([
    fetchModerationListSnapshot(viewer, 'blacklisted', { force }),
    fetchModerationListSnapshot(viewer, 'follow_blacklist', { force })
  ])
  const blacklistSnapshot = blacklistResult.status === 'fulfilled'
    ? blacklistResult.value
    : { entries: [], truncated: false, total: 0 }
  const followBlacklistSnapshot = followBlacklistResult.status === 'fulfilled'
    ? followBlacklistResult.value
    : { entries: [], truncated: false, total: 0 }

  const listTruncated = []
  addTruncation(listTruncated, truncationRow(viewer, 'muted', mutedSnapshot))
  addTruncation(listTruncated, truncationRow(viewer, 'blacklisted', blacklistSnapshot))

  const owners = followMutedSnapshot.entries
    .map(entry => entry.name)
    .filter(Boolean)
  const resolvable = owners.slice(0, Math.max(0, Number(maxFollowedLists) || 0))
  const results = await Promise.allSettled(
    resolvable.map(owner => fetchModerationListSnapshot(owner, 'muted', { force }))
  )

  const followedMuteLists = []
  let listErrors = Math.max(0, owners.length - resolvable.length)
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') {
      listErrors += 1
      return
    }
    followedMuteLists.push({
      owner: resolvable[index],
      members: result.value.entries.map(entry => entry.name)
    })
    addTruncation(listTruncated, truncationRow(resolvable[index], 'muted', result.value))
  })

  const blacklistOwners = followBlacklistSnapshot.entries.map(entry => entry.name).filter(Boolean)
  const resolvableBlacklists = blacklistOwners.slice(0, Math.max(0, Number(maxFollowedLists) || 0))
  const blacklistResults = await Promise.allSettled(
    resolvableBlacklists.map(owner => fetchModerationListSnapshot(owner, 'blacklisted', { force }))
  )
  const followedBlacklistLists = []
  listErrors += Math.max(0, blacklistOwners.length - resolvableBlacklists.length)
  blacklistResults.forEach((result, index) => {
    if (result.status !== 'fulfilled') {
      listErrors += 1
      return
    }
    followedBlacklistLists.push({
      owner: resolvableBlacklists[index],
      members: result.value.entries.map(entry => entry.name)
    })
    addTruncation(listTruncated, truncationRow(resolvableBlacklists[index], 'blacklisted', result.value))
  })

  return {
    status: 'ready',
    muted: mutedSnapshot.entries.map(entry => entry.name),
    blacklisted: blacklistSnapshot.entries.map(entry => entry.name),
    following: [...new Set((Array.isArray(following) ? following : []).map(normalizeName).filter(Boolean))],
    followedMuteOwners: followMutedSnapshot.entries,
    followedBlacklistOwners: followBlacklistSnapshot.entries,
    followedMuteLists,
    followedBlacklistLists,
    listErrors,
    listTruncated,
    loadedAt: Date.now()
  }
}
