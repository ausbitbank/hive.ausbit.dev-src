// Small local preferences for the composer: recent tags and communities.
//
// The values are UI conveniences, not draft or chain data. They are stored per
// account and capped so the list stays useful.

import { normalizeTag } from './drafts'

export const RECENT_PREFIX = 'composeRecent:'

function ownerKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return /^[a-z][a-z0-9.-]{2,15}$/.test(account) ? account : 'guest'
}

function storageKey (kind, owner) {
  return RECENT_PREFIX + String(kind || 'values') + ':' + ownerKey(owner)
}

function storageGet (storage, key) {
  if (!storage) return null
  if (typeof storage.getItem === 'function') return storage.getItem(key)
  if (typeof storage.get === 'function') return storage.get(key)
  return null
}

function storageSet (storage, key, value) {
  if (!storage) return false
  try {
    if (typeof storage.set === 'function') {
      storage.set(key, value)
      return true
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, JSON.stringify(value))
      return true
    }
  } catch {
    return false
  }
  return false
}

function parseValues (raw) {
  if (!raw) return []
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
    } catch {
      return []
    }
  }
  return Array.isArray(parsed?.values) ? parsed.values : []
}

export function readRecentValues (storage, kind, owner = null, limit = 12) {
  return parseValues(storageGet(storage, storageKey(kind, owner)))
    .map(value => normalizeTag(value))
    .filter(Boolean)
    .slice(0, limit)
}

export function rememberRecentValue (storage, kind, owner, value, limit = 12) {
  const tag = normalizeTag(value)
  if (!tag) return readRecentValues(storage, kind, owner, limit)
  const next = [
    tag,
    ...readRecentValues(storage, kind, owner, limit).filter(item => item !== tag)
  ].slice(0, limit)
  storageSet(storage, storageKey(kind, owner), { version: 1, values: next })
  return next
}

export function clearRecentValues (storage, kind, owner = null) {
  const key = storageKey(kind, owner)
  if (!storage) return
  try {
    if (typeof storage.remove === 'function') storage.remove(key)
    else if (typeof storage.removeItem === 'function') storage.removeItem(key)
  } catch {
    // Non-critical preference.
  }
}
