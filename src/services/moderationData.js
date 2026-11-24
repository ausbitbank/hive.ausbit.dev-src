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
  for (const row of response) {
    const name = normalizeName(row && typeof row === 'object' ? row.name : row)
    if (!name || seen.has(name)) continue
    seen.add(name)
    entries.push({
      name,
      description: normalizeDescription(
        row && typeof row === 'object'
          ? (row.muted_list_description || row.blacklist_description)
          : ''
      )
    })
    if (entries.length >= MODERATION_LIST_MAX) break
  }
  return entries
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
 * Cached `bridge.get_follow_list` entries for one account and list type.
 * Entries keep the list description when the node provides one.
 */
export function fetchModerationListEntries (account, followType, { force = false } = {}) {
  const name = normalizeName(account)
  const type = assertFollowType(followType)
  if (!name) return Promise.resolve([])
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
    listErrors: 0,
    loadedAt: 0
  }
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

  const [following, mutedEntries, followMuted] = await Promise.all([
    fetchFollowingNames(viewer, { force }),
    fetchModerationListEntries(viewer, 'muted', { force }),
    fetchModerationListEntries(viewer, 'follow_muted', { force })
  ])

  // Blacklists are warning labels, not mutes. A failure there must not block
  // every skin; Phase 1 can surface the missing warning context separately.
  const [blacklistResult, followBlacklistResult] = await Promise.allSettled([
    fetchModerationListEntries(viewer, 'blacklisted', { force }),
    fetchModerationListEntries(viewer, 'follow_blacklist', { force })
  ])
  const blacklistEntries = blacklistResult.status === 'fulfilled' ? blacklistResult.value : []
  const followBlacklist = followBlacklistResult.status === 'fulfilled' ? followBlacklistResult.value : []

  const owners = followMuted
    .map(entry => entry.name)
    .filter(Boolean)
  const resolvable = owners.slice(0, Math.max(0, Number(maxFollowedLists) || 0))
  const results = await Promise.allSettled(
    resolvable.map(owner => fetchModerationListEntries(owner, 'muted', { force }))
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
      members: result.value.map(entry => entry.name)
    })
  })

  return {
    status: 'ready',
    muted: mutedEntries.map(entry => entry.name),
    blacklisted: blacklistEntries.map(entry => entry.name),
    following: [...new Set((Array.isArray(following) ? following : []).map(normalizeName).filter(Boolean))],
    followedMuteOwners: followMuted,
    followedBlacklistOwners: followBlacklist,
    followedMuteLists,
    listErrors,
    loadedAt: Date.now()
  }
}
