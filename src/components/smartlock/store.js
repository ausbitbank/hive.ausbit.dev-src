import lscache from 'lscache'
import base58 from 'bs58'
import { encryptKey, decryptKey } from './utils'

export const LOCKER_LOCALSTORAGE_KEY = 'ausbitdev_peaklock_v2'
export const LOCKER_CACHE_KEY = 'ausbitdev_peaklock_cache_v2'
export const UNLOCK_POLICY_INTERVAL = 60 * 24 * 7

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
  if (unlocked[username]) {
    return unlocked[username]
  }

  if (lscache.get(`${LOCKER_CACHE_KEY}_${username}`)) {
    const bytes = base58.decode(lscache.get(`${LOCKER_CACHE_KEY}_${username}`))
    unlocked[username] = bytes.toString('utf8')
    return unlocked[username]
  }

  return undefined
}

export function getMemo (username, password) {
  return getAccountKey(username, 'memo', password)
}

export function getActive (username, password) {
  return getAccountKey(username, 'active', password)
}

export function unlock (username, password, keepUnlocked = false) {
  // decrypt keys
  const postingKey = getAccountKey(username, 'posting', password)

  // cache posting key
  unlocked[username] = postingKey
  if (keepUnlocked) {
    const bytes = Buffer.from(postingKey, 'utf8')
    const encoded = base58.encode(bytes)
    lscache.set(`${LOCKER_CACHE_KEY}_${username}`, encoded, UNLOCK_POLICY_INTERVAL)
  }

  return true
}

export function lock (username) {
  // clear memory
  delete unlocked[username]
  // clear cached keys
  lscache.remove(`${LOCKER_CACHE_KEY}_${username}`)
  return true
}

export function save (username, password, keys) {
  // prepare user
  let storedUser = {} // eslint-disable-line prefer-const

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

  // cache posting key
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
