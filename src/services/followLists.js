// Follow-list subscriptions.
//
// Subscribing to a mute or blacklist list is a normal Hive `follow` custom_json
// with `follow_muted` or `follow_blacklist` in `what`. The whole `what` array
// must be sent, so this uses the same preserving followOps helper as an
// individual mute/follow.

import { followOperation } from './followOps'
import { normalizeName } from './moderationPolicy'

export const LIST_TYPES = {
  mute: {
    value: 'mute',
    label: 'Mute list',
    flag: 'follow_muted',
    contextKey: 'followedMuteOwners',
    membersKey: 'followedMuteLists',
    policyKey: 'muteOwners'
  },
  blacklist: {
    value: 'blacklist',
    label: 'Blacklist / warning list',
    flag: 'follow_blacklist',
    contextKey: 'followedBlacklistOwners',
    membersKey: 'followedBlacklistLists',
    policyKey: 'blacklistOwners'
  }
}

export function listTypeConfig (type) {
  return LIST_TYPES[type] || LIST_TYPES.mute
}

export function isValidListOwner (value) {
  return /^[a-z][a-z0-9.-]{2,15}$/.test(normalizeName(value))
}

export function ownerRelationship (owner, context = {}) {
  const name = normalizeName(owner)
  const includes = (list, key = 'name') => Array.isArray(list) &&
    list.some(item => normalizeName(item && typeof item === 'object' ? item[key] : item) === name)
  return {
    follows: (context.following || []).includes(name),
    ignores: (context.muted || []).includes(name),
    blacklists: (context.blacklisted || []).includes(name),
    follows_muted: includes(context.followedMuteOwners),
    follows_blacklists: includes(context.followedBlacklistOwners)
  }
}

/**
 * Build a queue-ready posting operation for a list subscription change.
 * `changes` preserves every other relationship flag.
 */
export function buildListSubscription (follower, owner, type, {
  subscribe = true,
  context = {}
} = {}) {
  const account = normalizeName(follower)
  const listOwner = normalizeName(owner)
  if (!account || !isValidListOwner(listOwner) || account === listOwner) {
    return null
  }
  const config = listTypeConfig(type)
  return followOperation(account, listOwner, ownerRelationship(listOwner, context), {
    [config.flag]: subscribe === true
  })
}

export function isSubscribed (owner, type, context = {}) {
  const name = normalizeName(owner)
  const config = listTypeConfig(type)
  return (context[config.contextKey] || []).some(item => {
    const value = item && typeof item === 'object' ? item.name : item
    return normalizeName(value) === name
  })
}

export function listMemberCount (owner, type, context = {}) {
  const name = normalizeName(owner)
  const config = listTypeConfig(type)
  const row = (context[config.membersKey] || []).find(item => normalizeName(item?.owner) === name)
  return Array.isArray(row?.members) ? row.members.length : null
}
