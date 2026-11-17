import { encryptKey, decryptKey } from './utils'

export const LOCKER_LOCALSTORAGE_KEY = 'ausbitdev_peaklock_v2'

// Unlocked posting keys live in memory only. They are never written to
// localStorage/sessionStorage, so a reload always requires the password again.
const unlocked = {}

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

  return true
}

export function lock (username) {
  // clear memory only
  delete unlocked[username]
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
