// Reader key lifecycle for Banksia Vault (banksia.vault@1).
//
// Every origin keeps its own P-256 ECDH reader key per blog and Hive account.
// Keeping accounts separate means a second account on the same browser is a real
// subscriber: it pays with its own public key, the creator issues it its own
// grant, and switching accounts cannot reuse another account's entitlement. The
// private key never leaves the device: it is stored as a `CryptoKey` in
// IndexedDB (structured clone) or, when IndexedDB is unavailable, in a
// module-level map for the life of the page. Nothing here writes key material to
// localStorage, sessionStorage, logs or the network.
//
// Keys are generated extractable so an anonymous reader can export a
// passphrase-wrapped recovery file. The inspector can see the key only while
// this origin is open, exactly like a non-extractable IndexedDB key; the export
// is the deliberate recovery path.

import {
  VaultCryptoError,
  exportReaderPrivateJwk,
  exportReaderPublicKey,
  generateReaderKeyPair,
  importReaderPrivateKey,
  importReaderPublicKey,
  readerKeyThumbprint
} from './vaultCrypto'
import { exportReaderRecovery, importReaderRecovery } from './vaultKeys'

export const READER_KEY_DB = 'banksia-vault'
export const READER_KEY_STORE = 'reader-keys'
export const READER_KEY_ACCOUNT_STORE = 'reader-keys-by-account'

const DB_VERSION = 2
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const ACCOUNT_SEPARATOR = '\u0000'

// Memory mirror: also the whole store when IndexedDB is unavailable (tests,
// private mode, some embedded webviews). Keyed by the same id as IndexedDB.
const memory = new Map()

let dbPromise = null

function normalizeBlog (value) {
  const blog = String(value || '').trim().replace(/^@/, '').toLowerCase()
  if (!HIVE_ACCOUNT_RE.test(blog)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A valid blog account is required for a reader key.')
  }
  return blog
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function recordId (blog, account) {
  return blog + ACCOUNT_SEPARATOR + normalizeAccount(account)
}

function idFor (record) {
  if (record && typeof record.id === 'string' && record.id) return record.id
  const blog = String(record && record.blog || '').trim().replace(/^@/, '').toLowerCase()
  return recordId(blog, record && record.account)
}

function isRecord (value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.blog === 'string' &&
    typeof value.publicKeyB64 === 'string' &&
    value.publicKeyB64.startsWith('p256:') &&
    typeof value.rkt === 'string' &&
    value.rkt.length === 16 &&
    value.privateKey &&
    typeof value.privateKey === 'object' &&
    value.privateKey.type === 'private'
  )
}

function indexedDbAvailable () {
  try {
    return typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null
  } catch {
    return false
  }
}

function openDatabase () {
  if (!indexedDbAvailable()) return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    let request
    try {
      request = globalThis.indexedDB.open(READER_KEY_DB, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const database = request.result
      // v1 stored one key per blog at `blog`. Keep that store readable for
      // devices that subscribed before accounts were separated; new keys go
      // into the account-scoped store.
      if (!database.objectStoreNames.contains(READER_KEY_STORE)) {
        database.createObjectStore(READER_KEY_STORE, { keyPath: 'blog' })
      }
      if (!database.objectStoreNames.contains(READER_KEY_ACCOUNT_STORE)) {
        database.createObjectStore(READER_KEY_ACCOUNT_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function withStore (database, storeName, mode, run) {
  return new Promise(resolve => {
    let transaction
    try {
      transaction = database.transaction(storeName, mode)
    } catch {
      resolve(null)
      return
    }
    const store = transaction.objectStore(storeName)
    let request
    try {
      request = run(store)
    } catch {
      resolve(null)
      return
    }
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
    transaction.onabort = () => resolve(null)
  })
}

async function idbGetAccount (id) {
  const database = await openDatabase()
  if (!database) return null
  return withStore(database, READER_KEY_ACCOUNT_STORE, 'readonly', store => store.get(id))
}

async function idbGetAllAccount () {
  const database = await openDatabase()
  if (!database) return []
  const rows = await withStore(database, READER_KEY_ACCOUNT_STORE, 'readonly', store => store.getAll())
  return Array.isArray(rows) ? rows : []
}

async function idbGetLegacy (blog) {
  const database = await openDatabase()
  if (!database) return null
  return withStore(database, READER_KEY_STORE, 'readonly', store => store.get(blog))
}

async function idbGetAllLegacy () {
  const database = await openDatabase()
  if (!database) return []
  const rows = await withStore(database, READER_KEY_STORE, 'readonly', store => store.getAll())
  return Array.isArray(rows) ? rows : []
}

function withWrite (database, storeName, run) {
  return new Promise(resolve => {
    let transaction
    try {
      transaction = database.transaction(storeName, 'readwrite')
    } catch {
      resolve(false)
      return
    }
    let request
    try {
      request = run(transaction.objectStore(storeName))
    } catch {
      resolve(false)
      return
    }
    request.onsuccess = () => resolve(true)
    request.onerror = () => resolve(false)
    transaction.onabort = () => resolve(false)
  })
}

async function idbPutAccount (record) {
  const database = await openDatabase()
  if (!database) return false
  return withWrite(database, READER_KEY_ACCOUNT_STORE, store => store.put(record))
}

async function idbDeleteAccount (id) {
  const database = await openDatabase()
  if (!database) return false
  return withWrite(database, READER_KEY_ACCOUNT_STORE, store => store.delete(id))
}

async function idbDeleteLegacy (blog) {
  const database = await openDatabase()
  if (!database) return false
  return withWrite(database, READER_KEY_STORE, store => store.delete(blog))
}

function remember (record) {
  if (!isRecord(record)) return null
  const stored = { ...record, id: idFor(record) }
  memory.set(stored.id, stored)
  return stored
}

function newestRecord (records) {
  let best = null
  for (const record of records) {
    if (!isRecord(record)) continue
    if (!best) {
      best = record
      continue
    }
    const current = Date.parse(record.createdAt || '') || 0
    const previous = Date.parse(best.createdAt || '') || 0
    if (current > previous) best = record
  }
  return best
}

/**
 * The reader key for a blog and optional Hive account, or null.
 *
 * With an account, only that account's key is returned (a legacy unbound v1 key
 * is adopted once). Without an account, the newest key for the blog is returned;
 * callers that need entitlement should always pass the signed-in account.
 *
 * Never generates a key: a visitor who has not subscribed should only see the
 * paywall.
 */
export async function getReaderKey (blog, account = '') {
  let name
  try {
    name = normalizeBlog(blog)
  } catch {
    return null
  }
  const wanted = normalizeAccount(account)
  const id = recordId(name, wanted)
  if (memory.has(id)) return memory.get(id)

  try {
    const stored = await idbGetAccount(id)
    if (isRecord(stored)) return remember(stored)
  } catch {
    // Fall through to the legacy store and the memory-only answer.
  }

  let legacy
  try {
    legacy = await idbGetLegacy(name)
  } catch {
    legacy = null
  }
  if (isRecord(legacy)) {
    const owner = normalizeAccount(legacy.account)
    if (wanted) {
      if (owner === wanted || !owner) {
        // Adopt the v1 key for this account once; the private key is unchanged
        // so existing grants keep working.
        const adopted = { ...legacy, id, ...(owner ? {} : { account: wanted }) }
        const saved = await idbPutAccount(adopted)
        if (saved) await idbDeleteLegacy(name)
        return remember(adopted)
      }
    } else {
      return remember(legacy)
    }
  }

  if (!wanted) {
    const rows = (await idbGetAllAccount()).filter(record =>
      isRecord(record) && normalizeAccount(record.blog) === name
    )
    const newest = newestRecord(rows)
    if (newest) return remember(newest)
    const memoryRows = [...memory.values()].filter(record => normalizeAccount(record.blog) === name)
    return remember(newestRecord(memoryRows))
  }

  return null
}

/**
 * Load the existing reader key for this blog/account or generate and persist a
 * fresh one.
 *
 * A different Hive account on the same device gets a different key. It does not
 * inherit the first account's grant, so its own payment is verified and issued
 * by the creator before it can read.
 *
 * @returns {Promise<{ blog: string, account?: string, publicKeyB64: string, privateKey: CryptoKey, rkt: string, createdAt: string }>}
 */
export async function ensureReaderKey (blog, { now = Date.now(), account = '' } = {}) {
  const name = normalizeBlog(blog)
  const readerAccount = normalizeAccount(account)
  const existing = readerAccount
    ? await getReaderKey(name, readerAccount)
    : await getReaderKey(name)
  if (existing) return existing

  const pair = await generateReaderKeyPair({ extractable: true })
  const rkt = await readerKeyThumbprint(pair.publicKeyB64)
  const stamp = now instanceof Date ? now.getTime() : Number(now)
  const createdAt = new Date(Number.isFinite(stamp) ? stamp : Date.now()).toISOString()
  const record = {
    id: recordId(name, readerAccount),
    blog: name,
    publicKeyB64: pair.publicKeyB64,
    privateKey: pair.privateKey,
    rkt,
    createdAt
  }
  if (readerAccount) record.account = readerAccount

  if (!(await idbPutAccount(record))) {
    // Memory-only mode is still a working session; the recovery export remains
    // the way to move the key to another origin.
  }
  return remember(record)
}

/** Every reader key this origin knows about, newest first. */
export async function listReaderKeys () {
  const records = new Map()
  try {
    for (const row of await idbGetAllLegacy()) {
      if (!isRecord(row)) continue
      const id = idFor(row)
      records.set(id, { ...row, id })
    }
  } catch {
    // The account store and memory still work.
  }
  try {
    for (const row of await idbGetAllAccount()) {
      if (!isRecord(row)) continue
      records.set(idFor(row), { ...row, id: idFor(row) })
    }
  } catch {
    // The legacy store and memory still work.
  }
  for (const [id, row] of memory) records.set(id, row)
  return [...records.values()].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || '') || 0
    const rightTime = Date.parse(right.createdAt || '') || 0
    return rightTime - leftTime
  })
}

/**
 * Forget one reader key. With an account, only that account's key is removed;
 * without one, every key for the blog is removed.
 */
export async function forgetReaderKey (blog, account = '') {
  let name
  try {
    name = normalizeBlog(blog)
  } catch {
    return false
  }
  const wanted = normalizeAccount(account)
  if (wanted) {
    const id = recordId(name, wanted)
    const had = memory.delete(id)
    const removed = await idbDeleteAccount(id)
    let legacyRemoved = false
    try {
      const legacy = await idbGetLegacy(name)
      if (isRecord(legacy) && normalizeAccount(legacy.account) === wanted) {
        legacyRemoved = await idbDeleteLegacy(name)
      }
    } catch {
      legacyRemoved = false
    }
    return had || removed || legacyRemoved
  }

  let had = false
  for (const [id, record] of memory) {
    if (normalizeAccount(record.blog) === name) {
      memory.delete(id)
      had = true
    }
  }
  let removed = false
  try {
    for (const row of await idbGetAllAccount()) {
      if (!isRecord(row) || normalizeAccount(row.blog) !== name) continue
      if (await idbDeleteAccount(idFor(row))) removed = true
    }
  } catch {
    removed = false
  }
  let legacyRemoved
  try {
    legacyRemoved = await idbDeleteLegacy(name)
  } catch {
    legacyRemoved = false
  }
  return had || removed || legacyRemoved
}

/** Replace a blog/account's reader key with a fresh keypair. */
export async function rotateReaderKey (blog, account = '') {
  await forgetReaderKey(blog, account)
  return ensureReaderKey(blog, account ? { account } : {})
}

/**
 * Export a passphrase-wrapped recovery file for a blog's reader key.
 *
 * `options.account` selects the account-scoped key and is the reader's Hive
 * account label inside the encrypted payload; it is informational and never
 * used as a signing authority.
 */
export async function exportReaderKeyRecovery (blog, passphrase, { account = '' } = {}) {
  const record = await getReaderKey(blog, account)
  if (!record) throw new Error('No reader key is stored on this device for @' + normalizeBlog(blog) + '.')
  const privateJwk = await exportReaderPrivateJwk(record.privateKey)
  const readerAccount = normalizeAccount(account) || record.account || record.blog
  return exportReaderRecovery({
    account: readerAccount,
    blog: record.blog,
    privateJwk,
    publicKeyB64: record.publicKeyB64,
    passphrase
  })
}

/**
 * Import a recovery file for a blog and replace that account's local reader key.
 *
 * Pass an empty `blog` on a new device: the encrypted payload names the blog it
 * belongs to. When a blog is supplied, a file for another blog is rejected
 * rather than silently overwriting the wrong membership.
 */
export async function importReaderKeyRecovery (blog, textOrObject, passphrase) {
  const payload = await importReaderRecovery(textOrObject, passphrase)
  const requested = String(blog || '').trim()
  let name
  if (requested) {
    name = normalizeBlog(requested)
    if (payload.blog && payload.blog !== name) {
      throw new Error('This recovery file is for @' + payload.blog + ', not @' + name + '.')
    }
  } else {
    if (!payload.blog) {
      throw new Error('This recovery file does not name the blog it belongs to.')
    }
    name = normalizeBlog(payload.blog)
  }

  const privateKey = await importReaderPrivateKey(payload.privateJwk, { extractable: true })
  const publicKey = await importReaderPublicKey({
    kty: 'EC',
    crv: 'P-256',
    x: payload.privateJwk.x,
    y: payload.privateJwk.y
  })
  const publicKeyB64 = await exportReaderPublicKey(publicKey)
  if (payload.publicKeyB64 && payload.publicKeyB64 !== publicKeyB64) {
    throw new Error('The recovery file public and private keys do not match.')
  }
  const rkt = await readerKeyThumbprint(publicKeyB64)

  const account = normalizeAccount(payload.account)
  const record = {
    id: recordId(name, account),
    blog: name,
    publicKeyB64,
    privateKey,
    rkt,
    createdAt: new Date().toISOString()
  }
  if (account) record.account = account
  await idbPutAccount(record)
  return remember(record)
}

/** Test hook: drop the memory mirror (IndexedDB rows are left untouched). */
export function clearReaderKeyMemory () {
  memory.clear()
}
