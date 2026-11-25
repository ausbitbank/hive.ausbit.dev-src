// Local moderation settings.
//
// Settings are per Hive account (with a `guest` fallback) and live only in the
// browser. This module is pure apart from the injected storage object, so the
// schema and normalization can be unit tested without Pinia or a component.
//
// Phase 1 extends this document with presets, lists and content overrides.
// W71 only needs the skin rules and per-author skin overrides.

import { MODERATION_PRESETS, normalizeName } from './moderationPolicy'
import {
  CONTENT_CUSTOM_SURFACES,
  CONTENT_DISPLAY,
  CONTENT_SIGNALS,
  DEFAULT_CONTENT_CUSTOM
} from './moderationContent'

export const MODERATION_VERSION = 1
export const MODERATION_STORAGE_PREFIX = 'hive:moderation:v1:'
export const GUEST_SCOPE = 'guest'
export const MAX_AUTHOR_OVERRIDES = 200
export const MAX_ITEM_OVERRIDES = 300
export const MAX_IGNORED_VOTERS = 500

export function defaultModerationPolicy () {
  return {
    version: MODERATION_VERSION,
    preset: 'balanced',
    disclosureSeen: false,
    safetyFloor: {
      // On by default: a narrow, documented phishing/compromised-account list.
      enabled: true
    },
    custom: JSON.parse(JSON.stringify(DEFAULT_CONTENT_CUSTOM)),
    lists: {
      muteOwners: [],
      blacklistOwners: [],
      listsOverrideFollows: false
    },
    skins: {
      blockMuted: true,
      blockNegativeReputation: true,
      followedMuteListOverride: true,
      followedReputationOverride: false
    },
    overrides: {
      showAuthors: [],
      hideAuthors: [],
      showItems: [],
      hideItems: [],
      ignoredVoters: []
    }
  }
}

export function scopeFor (value) {
  return normalizeName(value) || GUEST_SCOPE
}

export function moderationStorageKey (scope) {
  return MODERATION_STORAGE_PREFIX + scopeFor(scope)
}

function storageRef (input) {
  if (input) return input
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

function normalizeAuthorList (value, cap = MAX_AUTHOR_OVERRIDES) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const name = normalizeName(item)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= cap) break
  }
  return out
}

function booleanOr (value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeItems (value, cap = MAX_ITEM_OVERRIDES) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const key = typeof item === 'string' ? item.trim().slice(0, 200) : ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= cap) break
  }
  return out
}

function normalizeCustom (value) {
  const result = JSON.parse(JSON.stringify(DEFAULT_CONTENT_CUSTOM))
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  for (const surface of CONTENT_CUSTOM_SURFACES) {
    const rules = value[surface]
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) continue
    for (const signal of CONTENT_SIGNALS) {
      if (CONTENT_DISPLAY.includes(rules[signal])) result[surface][signal] = rules[signal]
    }
  }
  return result
}

/**
 * Turn any stored/imported value into a safe policy document. Unknown keys are
 * dropped; a future schema version falls back to defaults rather than guessing.
 */
export function normalizeModerationPolicy (value) {
  const defaults = defaultModerationPolicy()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults

  const version = Number(value.version)
  if (Number.isFinite(version) && version > MODERATION_VERSION) return defaults

  const skins = value.skins && typeof value.skins === 'object' && !Array.isArray(value.skins)
    ? value.skins
    : {}
  const overrides = value.overrides && typeof value.overrides === 'object' && !Array.isArray(value.overrides)
    ? value.overrides
    : {}
  const lists = value.lists && typeof value.lists === 'object' && !Array.isArray(value.lists)
    ? value.lists
    : {}
  const safetyFloor = value.safetyFloor && typeof value.safetyFloor === 'object' && !Array.isArray(value.safetyFloor)
    ? value.safetyFloor
    : {}

  return {
    version: MODERATION_VERSION,
    preset: MODERATION_PRESETS.includes(value.preset) ? value.preset : defaults.preset,
    disclosureSeen: value.disclosureSeen === true,
    safetyFloor: {
      enabled: booleanOr(safetyFloor.enabled, defaults.safetyFloor.enabled)
    },
    custom: normalizeCustom(value.custom),
    lists: {
      muteOwners: normalizeAuthorList(lists.muteOwners),
      blacklistOwners: normalizeAuthorList(lists.blacklistOwners),
      listsOverrideFollows: lists.listsOverrideFollows === true
    },
    skins: {
      blockMuted: booleanOr(skins.blockMuted, defaults.skins.blockMuted),
      blockNegativeReputation: booleanOr(skins.blockNegativeReputation, defaults.skins.blockNegativeReputation),
      // Accept the pre-release single flag as a migration path.
      followedMuteListOverride: booleanOr(
        skins.followedMuteListOverride,
        booleanOr(skins.followedOverride, defaults.skins.followedMuteListOverride)
      ),
      followedReputationOverride: booleanOr(
        skins.followedReputationOverride,
        booleanOr(skins.followedOverride, defaults.skins.followedReputationOverride)
      )
    },
    overrides: {
      showAuthors: normalizeAuthorList(overrides.showAuthors),
      hideAuthors: normalizeAuthorList(overrides.hideAuthors),
      showItems: normalizeItems(overrides.showItems),
      hideItems: normalizeItems(overrides.hideItems),
      ignoredVoters: normalizeAuthorList(overrides.ignoredVoters, MAX_IGNORED_VOTERS)
    }
  }
}

export function readModerationPolicy (scope, { storage = null } = {}) {
  const store = storageRef(storage)
  if (!store) return defaultModerationPolicy()
  try {
    const raw = store.getItem(moderationStorageKey(scope))
    if (!raw) return defaultModerationPolicy()
    return normalizeModerationPolicy(JSON.parse(raw))
  } catch {
    return defaultModerationPolicy()
  }
}

export function writeModerationPolicy (scope, policy, { storage = null } = {}) {
  const store = storageRef(storage)
  if (!store) return false
  try {
    store.setItem(moderationStorageKey(scope), JSON.stringify(normalizeModerationPolicy(policy)))
    return true
  } catch {
    return false
  }
}

export function clearModerationPolicy (scope, { storage = null } = {}) {
  const store = storageRef(storage)
  if (!store) return false
  try {
    store.removeItem(moderationStorageKey(scope))
    return true
  } catch {
    return false
  }
}

export const MODERATION_EXPORT_TYPE = 'hive-moderation-policy'

export function serializeModerationExport (policy, { subscriptions = null } = {}) {
  const normalized = normalizeModerationPolicy(policy)
  const exported = {
    app: 'hive.ausbit.dev',
    type: MODERATION_EXPORT_TYPE,
    version: MODERATION_VERSION,
    exportedAt: new Date().toISOString(),
    policy: normalized
  }
  if (subscriptions && typeof subscriptions === 'object') {
    exported.subscriptions = {
      muteOwners: normalizeAuthorList(subscriptions.muteOwners),
      blacklistOwners: normalizeAuthorList(subscriptions.blacklistOwners)
    }
  }
  return JSON.stringify(exported, null, 2)
}

/**
 * Parse an exported policy. Accepts the envelope, a bare policy object or a
 * JSON string. Never throws; returns a normal policy or a clear error.
 */
export function parseModerationExport (input) {
  let value = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input)
    } catch {
      return { policy: null, error: 'That file is not valid JSON.' }
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { policy: null, error: 'That file does not contain a moderation policy.' }
  }
  if (value.type && value.type !== MODERATION_EXPORT_TYPE) {
    return { policy: null, error: 'That file is not a hive.ausbit.dev moderation policy.' }
  }
  const version = Number(value.version)
  if (Number.isFinite(version) && version > MODERATION_VERSION) {
    return { policy: null, error: 'That policy was made by a newer version of this site.' }
  }
  const payload = value.policy && typeof value.policy === 'object' ? value.policy : value
  const policy = normalizeModerationPolicy(payload)
  const subscriptions = value.subscriptions && typeof value.subscriptions === 'object'
    ? {
        muteOwners: normalizeAuthorList(value.subscriptions.muteOwners || policy.lists.muteOwners),
        blacklistOwners: normalizeAuthorList(value.subscriptions.blacklistOwners || policy.lists.blacklistOwners)
      }
    : {
        muteOwners: policy.lists.muteOwners,
        blacklistOwners: policy.lists.blacklistOwners
      }
  return { policy, subscriptions, error: '' }
}
