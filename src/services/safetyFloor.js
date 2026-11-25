// Default-on local safety floor for known phishing and compromised accounts.
//
// The floor is deliberately narrow: it reads one documented public phishing
// list and collapses matching content. It does not hide political, social or
// merely unpopular content, and every match carries a visible source, an
// explanation and a local override. The read is cached and never blocks a page.

import { reactive } from 'vue'
import { bridgeRequest } from './api'
import { loadCached } from './cache'
import { normalizeName } from './moderationPolicy'

export const SAFETY_FLOOR_MAX = 10000
export const SAFETY_FLOOR_TTL_MS = 5 * 60 * 1000
export const SAFETY_FLOOR_CACHE_KEY = 'moderation:safety-floor:hive-blog'
export const SAFETY_FLOOR_STORAGE_KEY = 'hive:safety-floor:v1'
export const SAFETY_FLOOR_STORAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const ACCOUNT_NAME = /^[a-z][a-z0-9.-]{2,15}$/

// Keep this in sync with the `hive-blog-phishing` entry in
// `src/services/accountSafety.js`, but do not import the whole catalogue here:
// every route loads this chunk for the default-on floor.
export const SAFETY_FLOOR_SOURCE = Object.freeze({
  id: 'hive-blog-phishing',
  owner: 'hive.blog',
  followType: 'muted',
  listType: 'mute',
  title: 'hive.blog phishing and hacked-account list',
  asOf: '2026-11-24',
  caution: 'Narrow phishing and compromised-account list.',
  url: '/@hive.blog'
})

export const safetyFloorState = reactive({
  status: 'idle',
  names: [],
  total: 0,
  truncated: false,
  error: '',
  loadedAt: 0,
  source: SAFETY_FLOOR_SOURCE
})

let inflight = null

function storage () {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

function validCachedNames (value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const names = []
  for (const item of value) {
    const raw = String(item ?? '').trim().replace(/^@+/, '').toLowerCase()
    if (!ACCOUNT_NAME.test(raw)) continue
    const name = normalizeName(raw)
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
    if (names.length >= SAFETY_FLOOR_MAX) break
  }
  return names
}

/** Latest cached public list, used to protect repeat visits before refresh. */
export function readSafetyFloorCache ({ now = Date.now() } = {}) {
  const store = storage()
  if (!store) return null
  try {
    const parsed = JSON.parse(store.getItem(SAFETY_FLOOR_STORAGE_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.sourceId !== SAFETY_FLOOR_SOURCE.id) return null
    const savedAt = Number(parsed.savedAt)
    if (!Number.isFinite(savedAt) || now - savedAt > SAFETY_FLOOR_STORAGE_MAX_AGE_MS) return null
    const names = validCachedNames(parsed.names)
    if (!names.length) return null
    return {
      names,
      total: Math.max(names.length, Number(parsed.total) || 0),
      truncated: parsed.truncated === true,
      savedAt
    }
  } catch {
    return null
  }
}

function writeSafetyFloorCache (snapshot) {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(SAFETY_FLOOR_STORAGE_KEY, JSON.stringify({
      sourceId: SAFETY_FLOOR_SOURCE.id,
      savedAt: Date.now(),
      names: snapshot.names,
      total: snapshot.total,
      truncated: snapshot.truncated === true
    }))
    return true
  } catch {
    return false
  }
}

const cachedAtBoot = readSafetyFloorCache()
if (cachedAtBoot) {
  safetyFloorState.names = cachedAtBoot.names
  safetyFloorState.total = cachedAtBoot.total
  safetyFloorState.truncated = cachedAtBoot.truncated
  safetyFloorState.status = 'ready'
  safetyFloorState.loadedAt = cachedAtBoot.savedAt
}

/**
 * Normalize a `bridge.get_follow_list` response into the bounded set the
 * policy checks. A list above the cap is partial and must be visible as such.
 */
export function normalizeSafetyFloorResponse (response) {
  if (!Array.isArray(response)) {
    throw new Error('Unexpected safety floor response')
  }
  const seen = new Set()
  const names = []
  let truncated = false
  for (const row of response) {
    const raw = String(row && typeof row === 'object' ? row.name : row)
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
    if (!ACCOUNT_NAME.test(raw)) continue
    const name = normalizeName(raw)
    if (!name || seen.has(name)) continue
    if (names.length >= SAFETY_FLOOR_MAX) {
      truncated = true
      break
    }
    seen.add(name)
    names.push(name)
  }
  return {
    names,
    total: response.length,
    truncated
  }
}

export function resetSafetyFloorState () {
  inflight = null
  safetyFloorState.status = 'idle'
  safetyFloorState.names = []
  safetyFloorState.total = 0
  safetyFloorState.truncated = false
  safetyFloorState.error = ''
  safetyFloorState.loadedAt = 0
  safetyFloorState.source = SAFETY_FLOOR_SOURCE
  const store = storage()
  if (store) {
    try {
      store.removeItem(SAFETY_FLOOR_STORAGE_KEY)
    } catch {
      // Private mode or blocked storage.
    }
  }
}

/**
 * Load the safety floor once per cache window. The promise never rejects: a
 * failure leaves the state available so content can fail open with a visible
 * explanation instead of disappearing.
 */
export function ensureSafetyFloor ({ force = false } = {}) {
  if (inflight) return inflight
  if (safetyFloorState.status !== 'ready') safetyFloorState.status = 'loading'

  const request = loadCached(SAFETY_FLOOR_CACHE_KEY, async () => {
    const response = await bridgeRequest('get_follow_list', {
      observer: SAFETY_FLOOR_SOURCE.owner,
      follow_type: SAFETY_FLOOR_SOURCE.followType
    })
    return normalizeSafetyFloorResponse(response)
  }, {
    ttl: SAFETY_FLOOR_TTL_MS,
    force
  })
    .then(snapshot => {
      safetyFloorState.names = snapshot.names
      safetyFloorState.total = snapshot.total
      safetyFloorState.truncated = snapshot.truncated === true
      safetyFloorState.status = 'ready'
      safetyFloorState.error = ''
      safetyFloorState.loadedAt = Date.now()
      writeSafetyFloorCache(snapshot)
      return safetyFloorState
    })
    .catch(error => {
      safetyFloorState.error = error?.message || 'The phishing safety floor could not be loaded'
      if (!safetyFloorState.loadedAt) {
        safetyFloorState.names = []
        safetyFloorState.total = 0
        safetyFloorState.truncated = false
        safetyFloorState.status = 'error'
      }
      return safetyFloorState
    })
    .finally(() => {
      if (inflight === request) inflight = null
    })

  inflight = request
  return request
}
