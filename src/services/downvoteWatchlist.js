// Locally watched downvoters.
//
// A watch is a personal reminder on this device, not a chain action and not a
// label shown to anyone else.

import { LocalStorage } from 'quasar'

const KEY_PREFIX = 'banksia:downvote-watchlist:v1:'
export const MAX_WATCHED = 200

function keyFor (scope) {
  return KEY_PREFIX + String(scope || 'guest').toLowerCase()
}

function normalize (value) {
  const name = String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0, 16)
  return name || ''
}

function persist (scope, list) {
  try {
    if (!list.length) {
      LocalStorage.remove(keyFor(scope))
      return
    }
    LocalStorage.set(keyFor(scope), JSON.stringify(list))
  } catch {
    // Leave the in-memory list usable when storage is unavailable.
  }
}

export function loadWatchlist (scope = 'guest') {
  try {
    const raw = LocalStorage.getItem(keyFor(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    const out = []
    for (const item of parsed) {
      const name = normalize(item)
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push(name)
      if (out.length >= MAX_WATCHED) break
    }
    return out
  } catch {
    return []
  }
}

export function isWatched (list, voter) {
  return (Array.isArray(list) ? list : []).includes(normalize(voter))
}

/** Add or remove a voter and return the new list. */
export function toggleWatched (scope, voter) {
  const name = normalize(voter)
  if (!name) return loadWatchlist(scope)
  const current = loadWatchlist(scope)
  const index = current.indexOf(name)
  if (index >= 0) current.splice(index, 1)
  else {
    current.unshift(name)
    if (current.length > MAX_WATCHED) current.length = MAX_WATCHED
  }
  persist(scope, current)
  return current
}
