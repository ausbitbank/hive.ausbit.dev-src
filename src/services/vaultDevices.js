// Reader device registry for Banksia Vault (banksia.vault@1).
//
// A reader who already pays for a membership can authorize another device
// without moving the private reader key or paying again. The new device stores
// its own P-256 key locally and publishes only the public key in the reader's
// account metadata:
//
//   posting_json_metadata["banksia.io"].reader.devices["<blog>"] = ["p256:..."]
//
// The creator dashboard knows the active subscriber accounts from payments and
// can fetch their metadata in bulk with `get_accounts`, so this stays O(N/1000)
// RPCs instead of scanning every reader's history. The value is public key
// material only; the private key never leaves the device.
//
// Writes use the reader's posting key through `account_update2`. The helpers
// merge into the latest metadata so a profile or blog object is preserved.

import {
  MAX_ACCOUNT_METADATA_BYTES,
  buildPostingMetadataOperation,
  parseAccountMetadata
} from './accountMetadata'
import { isValidHiveAccountName } from './blogHost'

export const VAULT_DEVICE_NAMESPACE = 'banksia.io'
export const VAULT_DEVICE_SCHEMA_VERSION = 1
export const VAULT_DEVICE_MAX_KEYS = 8

const READER_KEY_RE = /^p256:[A-Za-z0-9_-]{40,120}$/

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

function byteLength (value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(text)).length
    return String(text).length
  } catch {
    return 0
  }
}

function normalizeKeys (value) {
  const list = Array.isArray(value)
    ? value
    : (isPlainObject(value) && Array.isArray(value.keys) ? value.keys : [])
  const keys = []
  const seen = new Set()
  for (const entry of list) {
    const key = typeof entry === 'string' ? entry.trim() : (isPlainObject(entry) ? String(entry.key || '').trim() : '')
    if (!READER_KEY_RE.test(key) || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
    if (keys.length >= VAULT_DEVICE_MAX_KEYS) break
  }
  return keys
}

function deviceMap (value) {
  const namespace = isPlainObject(value) && isPlainObject(value[VAULT_DEVICE_NAMESPACE])
    ? value[VAULT_DEVICE_NAMESPACE]
    : null
  const reader = namespace && isPlainObject(namespace.reader) ? namespace.reader : null
  return reader && isPlainObject(reader.devices) ? reader.devices : null
}

/**
 * Public reader keys registered by an account for one creator blog.
 *
 * Accepts raw `posting_json_metadata` or an already-parsed object. Unknown keys
 * and malformed entries are ignored; no private material is ever present.
 */
export function readReaderDevices (metadata, blog) {
  const name = normalizeAccount(blog)
  if (!name) return []
  const parsed = parseAccountMetadata(metadata)
  if (!parsed.ok) return []
  const devices = deviceMap(parsed.value)
  return devices ? normalizeKeys(devices[name]) : []
}

/** True when the metadata already contains this reader key for the blog. */
export function hasReaderDevice (metadata, blog, readerKey) {
  const key = typeof readerKey === 'string' ? readerKey.trim() : ''
  return Boolean(key) && readReaderDevices(metadata, blog).includes(key)
}

function finish (root, account, { changed }) {
  const text = JSON.stringify(root)
  const bytes = byteLength(text)
  if (bytes > MAX_ACCOUNT_METADATA_BYTES) {
    return {
      ok: false,
      changed: false,
      error: 'The merged account metadata is too large to add another device.',
      metadata: null,
      text: '',
      operation: null,
      bytes
    }
  }
  return {
    ok: true,
    changed,
    error: '',
    metadata: root,
    text,
    operation: changed ? buildPostingMetadataOperation(account, text) : null,
    bytes
  }
}

/**
 * Add a device key to an account's metadata, preserving every other field.
 *
 * @returns {{ ok: boolean, changed: boolean, error: string, metadata: object|null,
 *   text: string, operation: array|null, bytes: number }}
 */
export function mergeReaderDevice ({ account, metadata, blog, readerKey } = {}) {
  const name = normalizeAccount(account)
  const blogName = normalizeAccount(blog)
  const key = typeof readerKey === 'string' ? readerKey.trim() : ''
  if (!isValidHiveAccountName(name)) {
    return { ok: false, changed: false, error: 'A valid Hive account is required.', metadata: null, text: '', operation: null, bytes: 0 }
  }
  if (!isValidHiveAccountName(blogName)) {
    return { ok: false, changed: false, error: 'A valid creator blog is required.', metadata: null, text: '', operation: null, bytes: 0 }
  }
  if (!READER_KEY_RE.test(key)) {
    return { ok: false, changed: false, error: 'A valid p256 reader key is required.', metadata: null, text: '', operation: null, bytes: 0 }
  }
  const parsed = parseAccountMetadata(metadata)
  if (!parsed.ok) {
    return { ok: false, changed: false, error: parsed.error, metadata: null, text: '', operation: null, bytes: 0 }
  }

  const root = clone(parsed.value)
  const namespace = isPlainObject(root[VAULT_DEVICE_NAMESPACE]) ? root[VAULT_DEVICE_NAMESPACE] : {}
  const reader = isPlainObject(namespace.reader) ? namespace.reader : {}
  const devices = isPlainObject(reader.devices) ? reader.devices : {}
  const current = normalizeKeys(devices[blogName])
  if (current.includes(key)) {
    return { ok: true, changed: false, error: '', metadata: root, text: JSON.stringify(root), operation: null, bytes: byteLength(root) }
  }
  if (current.length >= VAULT_DEVICE_MAX_KEYS) {
    return { ok: false, changed: false, error: 'This account already has the maximum of ' + VAULT_DEVICE_MAX_KEYS + ' devices for @' + blogName + '.', metadata: null, text: '', operation: null, bytes: 0 }
  }

  devices[blogName] = [...current, key]
  reader.v = VAULT_DEVICE_SCHEMA_VERSION
  reader.devices = devices
  namespace.reader = reader
  root[VAULT_DEVICE_NAMESPACE] = namespace
  return finish(root, name, { changed: true })
}

/** Remove a device key while preserving the rest of the metadata. */
export function removeReaderDevice ({ account, metadata, blog, readerKey } = {}) {
  const name = normalizeAccount(account)
  const blogName = normalizeAccount(blog)
  const key = typeof readerKey === 'string' ? readerKey.trim() : ''
  if (!isValidHiveAccountName(name) || !isValidHiveAccountName(blogName) || !key) {
    return { ok: false, changed: false, error: 'A valid account, blog and reader key are required.', metadata: null, text: '', operation: null, bytes: 0 }
  }
  const parsed = parseAccountMetadata(metadata)
  if (!parsed.ok) {
    return { ok: false, changed: false, error: parsed.error, metadata: null, text: '', operation: null, bytes: 0 }
  }
  const root = clone(parsed.value)
  const namespace = isPlainObject(root[VAULT_DEVICE_NAMESPACE]) ? root[VAULT_DEVICE_NAMESPACE] : null
  const reader = namespace && isPlainObject(namespace.reader) ? namespace.reader : null
  const devices = reader && isPlainObject(reader.devices) ? reader.devices : null
  const current = devices ? normalizeKeys(devices[blogName]) : []
  if (!current.includes(key)) {
    return { ok: true, changed: false, error: '', metadata: root, text: JSON.stringify(root), operation: null, bytes: byteLength(root) }
  }

  const next = current.filter(item => item !== key)
  if (next.length) devices[blogName] = next
  else delete devices[blogName]
  if (devices && Object.keys(devices).length) {
    reader.devices = devices
    namespace.reader = reader
  } else {
    delete namespace.reader
  }
  if (namespace && Object.keys(namespace).length) root[VAULT_DEVICE_NAMESPACE] = namespace
  else delete root[VAULT_DEVICE_NAMESPACE]
  return finish(root, name, { changed: true })
}

/**
 * Fetch the latest account metadata and merge the device key into it.
 *
 * `fetchAccount` is injected so the helper stays testable and the caller keeps
 * control of the chain cache. Returns the same shape as `mergeReaderDevice`
 * plus the fetched account.
 */
export async function requestReaderDevice ({ account, blog, readerKey, fetchAccount } = {}) {
  if (typeof fetchAccount !== 'function') {
    return { ok: false, changed: false, error: 'Account loading is unavailable.', metadata: null, text: '', operation: null, bytes: 0, account: null }
  }
  let accountData
  try {
    accountData = await fetchAccount(normalizeAccount(account), { force: true })
  } catch {
    accountData = null
  }
  if (!accountData) {
    return { ok: false, changed: false, error: 'The reader account could not be loaded.', metadata: null, text: '', operation: null, bytes: 0, account: null }
  }
  return {
    ...mergeReaderDevice({ account, metadata: accountData.posting_json_metadata, blog, readerKey }),
    account: accountData
  }
}

/** `account_update2` for a metadata object built above. Posting authority. */
export function buildReaderDeviceOperation (account, metadata) {
  const name = normalizeAccount(account)
  if (!isValidHiveAccountName(name) || !isPlainObject(metadata)) return null
  const text = JSON.stringify(metadata)
  if (byteLength(text) > MAX_ACCOUNT_METADATA_BYTES) return null
  return buildPostingMetadataOperation(name, text)
}
