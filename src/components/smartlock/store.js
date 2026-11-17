import { encryptKey, decryptKey } from './utils'

export const LOCKER_LOCALSTORAGE_KEY = 'ausbitdev_peaklock_v2'
export const DEFAULT_SESSION_TIMEOUT_MS = 15 * 60 * 1000

// Older SmartLock versions wrote unlocked posting keys to lscache in plaintext.
// The app no longer reads or writes these entries; purge them so a later XSS
// cannot recover them.
const LEGACY_UNLOCKED_CACHE_PREFIX = 'ausbitdev_peaklock_cache_v2_'
const LEGACY_LSCACHE_PREFIX = `lscache-${LEGACY_UNLOCKED_CACHE_PREFIX}`

// Unlocked posting keys live in memory only. They are never written to
// localStorage/sessionStorage, so a reload always requires the password again.
const unlocked = {}
const lastActivity = {}

function getLocker () {
  const storedLocker = localStorage.getItem(LOCKER_LOCALSTORAGE_KEY)

  if (storedLocker) {
    try {
      return JSON.parse(storedLocker)
    } catch (error) {
      console.error("Couldn't parse stored keys", error)
    }
  }

  return {}
}

function getUser (username) {
  const locker = getLocker()
  return locker[username]
}

// One-time migration: remove plaintext unlocked-key entries written by older
// SmartLock builds. Safe to call in browsers, jsdom and private-mode contexts.
export function purgeLegacyUnlockedKeyCache () {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return 0
    }

    const legacyKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(LEGACY_UNLOCKED_CACHE_PREFIX) || key.startsWith(LEGACY_LSCACHE_PREFIX))) {
        legacyKeys.push(key)
      }
    }

    legacyKeys.forEach(key => localStorage.removeItem(key))
    return legacyKeys.length
  } catch (error) {
    console.warn('Could not purge legacy SmartLock cache', error)
    return 0
  }
}

function getAccountKey (username, role = 'posting', password) {
  const storedUser = getUser(username)
  if (!storedUser || !storedUser[role]) {
    return undefined
  }

  return decryptKey(storedUser[role], password)
}

export function allUsers () {
  const locker = getLocker()
  return Object.keys(locker)
}

export function hasPosting (username) {
  const user = getUser(username)
  return user.posting && user.posting.length
}

export function hasActive (username) {
  const user = getUser(username)
  return user.active && user.active.length
}

export function hasMemo (username) {
  const user = getUser(username)
  return user.memo && user.memo.length
}

export function getPosting (username) {
  return unlocked[username]
}

export function touchActivity (username) {
  const now = Date.now()
  if (username) {
    if (unlocked[username]) lastActivity[username] = now
    return
  }
  for (const user of Object.keys(unlocked)) lastActivity[user] = now
}

export function isUnlocked (username, timeoutMs = DEFAULT_SESSION_TIMEOUT_MS) {
  if (!unlocked[username]) return false
  const last = lastActivity[username] || 0
  if (timeoutMs > 0 && Date.now() - last > timeoutMs) {
    lock(username)
    return false
  }
  return true
}

export function lockExpired (timeoutMs = DEFAULT_SESSION_TIMEOUT_MS) {
  if (!(timeoutMs > 0)) return []
  const now = Date.now()
  const expired = Object.keys(unlocked).filter(username => now - (lastActivity[username] || 0) > timeoutMs)
  expired.forEach(lock)
  return expired
}

export function getMemo (username, password) {
  return getAccountKey(username, 'memo', password)
}

export function getActive (username, password) {
  return getAccountKey(username, 'active', password)
}

export function unlock (username, password, _keepUnlocked = false) {
  // decrypt key
  const postingKey = getAccountKey(username, 'posting', password)

  // keep it in memory only; never persist unlocked keys
  unlocked[username] = postingKey
  lastActivity[username] = Date.now()

  return true
}

export function lock (username) {
  // clear memory only
  delete unlocked[username]
  delete lastActivity[username]
  return true
}

export function save (username, password, keys) {
  // prepare user
  const storedUser = {}

  if (keys.posting) {
    storedUser.posting = encryptKey(keys.posting, password)
  }
  if (keys.active) {
    storedUser.active = encryptKey(keys.active, password)
  }
  if (keys.memo) {
    storedUser.memo = encryptKey(keys.memo, password)
  }

  // store keys
  const locker = getLocker()
  locker[username] = storedUser
  localStorage.setItem(LOCKER_LOCALSTORAGE_KEY, JSON.stringify(locker))

  // keep the newly imported posting key in memory
  unlocked[username] = keys.posting
  lastActivity[username] = Date.now()

  return true
}

export function remove (username) {
  // lock user
  lock(username)

  // remove from storage
  const locker = getLocker()
  delete locker[username]
  localStorage.setItem(LOCKER_LOCALSTORAGE_KEY, JSON.stringify(locker))

  return true
}
