// Reader key lifecycle for Banksia Vault (banksia.vault@1).
//
// Every origin keeps its own P-256 ECDH reader key. The private key never leaves
// the device: it is stored as a `CryptoKey` in IndexedDB (structured clone) or,
// when IndexedDB is unavailable, in a module-level map for the life of the page.
// Nothing here writes key material to localStorage, sessionStorage, logs or the
// network.
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

const DB_VERSION = 1
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

// Memory mirror: also the whole store when IndexedDB is unavailable (tests,
// private mode, some embedded webviews).
const memory = new Map()

let dbPromise = null

function normalizeBlog (value) {
  const blog = String(value || '').trim().replace(/^@/, '').toLowerCase()
  if (!HIVE_ACCOUNT_RE.test(blog)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A valid blog account is required for a reader key.')
  }
  return blog
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
      if (!database.objectStoreNames.contains(READER_KEY_STORE)) {
        database.createObjectStore(READER_KEY_STORE, { keyPath: 'blog' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function withStore (database, mode, run) {
  return new Promise(resolve => {
    let transaction
    try {
      transaction = database.transaction(READER_KEY_STORE, mode)
    } catch {
      resolve(null)
      return
    }
    const store = transaction.objectStore(READER_KEY_STORE)
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

async function idbGet (blog) {
  const database = await openDatabase()
  if (!database) return null
  return withStore(database, 'readonly', store => store.get(blog))
}

async function idbGetAll () {
  const database = await openDatabase()
  if (!database) return []
  const rows = await withStore(database, 'readonly', store => store.getAll())
  return Array.isArray(rows) ? rows : []
}

function withWrite (database, run) {
  return new Promise(resolve => {
    let transaction
    try {
      transaction = database.transaction(READER_KEY_STORE, 'readwrite')
    } catch {
      resolve(false)
      return
    }
    let request
    try {
      request = run(transaction.objectStore(READER_KEY_STORE))
    } catch {
      resolve(false)
      return
    }
    request.onsuccess = () => resolve(true)
    request.onerror = () => resolve(false)
    transaction.onabort = () => resolve(false)
  })
}

async function idbPut (record) {
  const database = await openDatabase()
  if (!database) return false
  return withWrite(database, store => store.put(record))
}

async function idbDelete (blog) {
  const database = await openDatabase()
  if (!database) return false
  return withWrite(database, store => store.delete(blog))
}

function remember (record) {
  if (!isRecord(record)) return null
  memory.set(record.blog, record)
  return record
}

/**
 * The reader key for a blog, or null.
 *
 * Never generates a key: a visitor who has not subscribed should only see the
 * paywall.
 */
export async function getReaderKey (blog) {
  let name
  try {
    name = normalizeBlog(blog)
  } catch {
    return null
  }
  if (memory.has(name)) return memory.get(name)
  try {
    const stored = await idbGet(name)
    if (isRecord(stored)) return remember(stored)
  } catch {
    // Fall through to the memory-only answer.
  }
  return null
}

/**
 * Load an existing reader key or generate and persist a fresh one.
 *
 * @returns {Promise<{ blog: string, publicKeyB64: string, privateKey: CryptoKey, rkt: string, createdAt: string }>}
 */
export async function ensureReaderKey (blog, { now = Date.now(), account = '' } = {}) {
  const name = normalizeBlog(blog)
  const existing = await getReaderKey(name)
  if (existing) return existing

  const pair = await generateReaderKeyPair({ extractable: true })
  const rkt = await readerKeyThumbprint(pair.publicKeyB64)
  const stamp = now instanceof Date ? now.getTime() : Number(now)
  const createdAt = new Date(Number.isFinite(stamp) ? stamp : Date.now()).toISOString()
  const record = {
    blog: name,
    publicKeyB64: pair.publicKeyB64,
    privateKey: pair.privateKey,
    rkt,
    createdAt
  }
  const readerAccount = String(account || '').trim().replace(/^@/, '').toLowerCase()
  if (readerAccount) record.account = readerAccount

  if (!(await idbPut(record))) {
    // Memory-only mode is still a working session; the recovery export remains
    // the way to move the key to another origin.
  }
  return remember(record)
}

/** Every reader key this origin knows about, newest first. */
export async function listReaderKeys () {
  const records = new Map(memory)
  try {
    for (const row of await idbGetAll()) {
      if (isRecord(row) && !records.has(row.blog)) records.set(row.blog, row)
    }
  } catch {
    // Memory records are still useful.
  }
  return [...records.values()].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || '') || 0
    const rightTime = Date.parse(right.createdAt || '') || 0
    return rightTime - leftTime
  })
}

/** Forget one blog's reader key. Returns true when something was removed. */
export async function forgetReaderKey (blog) {
  let name
  try {
    name = normalizeBlog(blog)
  } catch {
    return false
  }
  const had = memory.delete(name)
  const removed = await idbDelete(name)
  return had || removed
}

/** Replace a blog's reader key with a fresh keypair. */
export async function rotateReaderKey (blog) {
  await forgetReaderKey(blog)
  return ensureReaderKey(blog)
}

/**
 * Export a passphrase-wrapped recovery file for a blog's reader key.
 *
 * `options.account` is the reader's Hive account label inside the encrypted
 * payload; it is informational and never used as a signing authority.
 */
export async function exportReaderKeyRecovery (blog, passphrase, { account = '' } = {}) {
  const record = await getReaderKey(blog)
  if (!record) throw new Error('No reader key is stored on this device for @' + normalizeBlog(blog) + '.')
  const privateJwk = await exportReaderPrivateJwk(record.privateKey)
  const readerAccount = String(account || record.account || record.blog).trim().replace(/^@/, '').toLowerCase()
  return exportReaderRecovery({
    account: readerAccount,
    blog: record.blog,
    privateJwk,
    publicKeyB64: record.publicKeyB64,
    passphrase
  })
}

/**
 * Import a recovery file for a blog and replace the local reader key.
 *
 * The recovery payload must belong to the same blog; a file for another blog is
 * rejected rather than silently overwriting the wrong membership.
 */
export async function importReaderKeyRecovery (blog, textOrObject, passphrase) {
  const name = normalizeBlog(blog)
  const payload = await importReaderRecovery(textOrObject, passphrase)
  if (payload.blog && payload.blog !== name) {
    throw new Error('This recovery file is for @' + payload.blog + ', not @' + name + '.')
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

  const record = {
    blog: name,
    publicKeyB64,
    privateKey,
    rkt,
    createdAt: new Date().toISOString(),
    account: payload.account || ''
  }
  await idbPut(record)
  return remember(record)
}

/** Test hook: drop the memory mirror (IndexedDB rows are left untouched). */
export function clearReaderKeyMemory () {
  memory.clear()
}
