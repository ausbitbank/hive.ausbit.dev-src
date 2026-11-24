// Local moderation settings.
//
// Settings are per Hive account (with a `guest` fallback) and live only in the
// browser. This module is pure apart from the injected storage object, so the
// schema and normalization can be unit tested without Pinia or a component.
//
// Phase 1 extends this document with presets, lists and content overrides.
// W71 only needs the skin rules and per-author skin overrides.

import { MODERATION_PRESETS, normalizeName } from './moderationPolicy'

export const MODERATION_VERSION = 1
export const MODERATION_STORAGE_PREFIX = 'hive:moderation:v1:'
export const GUEST_SCOPE = 'guest'
export const MAX_AUTHOR_OVERRIDES = 200

export function defaultModerationPolicy () {
  return {
    version: MODERATION_VERSION,
    preset: 'balanced',
    disclosureSeen: false,
    skins: {
      blockMuted: true,
      blockNegativeReputation: true,
      followedMuteListOverride: true,
      followedReputationOverride: false
    },
    overrides: {
      showAuthors: [],
      hideAuthors: []
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

  return {
    version: MODERATION_VERSION,
    preset: MODERATION_PRESETS.includes(value.preset) ? value.preset : defaults.preset,
    disclosureSeen: value.disclosureSeen === true,
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
      hideAuthors: normalizeAuthorList(overrides.hideAuthors)
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
