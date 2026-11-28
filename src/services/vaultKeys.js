// Banksia Vault — creator vault at rest and reader recovery (banksia.vault@1).
//
// The creator vault holds the keyring and the current ring key. It is only ever
// written to storage as a passphrase-encrypted envelope (PBKDF2-SHA256 with
// 310,000 iterations, AES-256-GCM, account-bound AAD). No plaintext key material
// is persisted, and nothing is logged.
//
// Reader recovery exports the P-256 private JWK inside the same kind of
// passphrase envelope. A recovered reader key can unwrap future bulletins; the
// creator can always re-issue a grant instead.

import {
  VaultCryptoError,
  base64UrlDecode,
  base64UrlEncode,
  canonicalJson,
  randomBytes,
  randomKey
} from './vaultCrypto'

export const VAULT_STORAGE_PREFIX = 'banksia_vault_creator_'
export const READER_RECOVERY_TYPE = 'banksia.vault.recovery@1'
export const CREATOR_EXPORT_TYPE = 'banksia.vault.creator@1'

const STORE_ALG = 'PBKDF2-SHA256-A256GCM'
const STORE_AAD_PREFIX = 'banksia.vault.store.v1'
const RECOVERY_AAD_PREFIX = 'banksia.vault.recovery.v1'
const PBKDF2_ITERATIONS = 310000
const PBKDF2_SALT_BYTES = 16
const GCM_IV_BYTES = 12
const AES_KEY_BYTES = 32
const MIN_ITERATIONS = 10000
const MAX_ITERATIONS = 5000000
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const PERIOD_RE = /^\d{4}-\d{2}$/

function isPlainObject (value) {
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value)
  // Cross-realm plain objects: proto is that realm's Object.prototype, whose
  // own prototype is null. Class instances have a deeper chain.
  return proto === null || Object.getPrototypeOf(proto) === null
}

function subtle () {
  const api = globalThis.crypto && globalThis.crypto.subtle
  if (!api) throw new VaultCryptoError('VAULT_UNAVAILABLE', 'WebCrypto is not available in this environment.')
  return api
}

function normalizeAccount (account) {
  const name = String(account || '').trim().toLowerCase()
  if (!HIVE_ACCOUNT_RE.test(name)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'A valid Hive account is required.')
  return name
}

function requirePassphrase (passphrase) {
  if (typeof passphrase !== 'string' || !passphrase) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A vault passphrase is required.')
  }
  return passphrase
}

function normalizeDate (value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new VaultCryptoError('VAULT_BAD_INPUT', 'Invalid date.')
  return date
}

function periodFor (date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function isRawKey (value) {
  if (typeof value !== 'string' || !value) return false
  try {
    return base64UrlDecode(value).length === AES_KEY_BYTES
  } catch {
    return false
  }
}

function assertVaultShape (vault) {
  if (!isPlainObject(vault)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault must be an object.')
  if (vault.v !== 1) throw new VaultCryptoError('VAULT_BAD_INPUT', 'Unsupported vault version.')
  normalizeAccount(vault.account)
  if (typeof vault.kid !== 'string' || !PERIOD_RE.test(vault.kid)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault kid must be YYYY-MM.')
  }
  if (typeof vault.ringKid !== 'string' || !PERIOD_RE.test(vault.ringKid)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault ringKid must be YYYY-MM.')
  }
  if (!isRawKey(vault.ringKey)) throw new VaultCryptoError('VAULT_BAD_KEY', 'The vault ring key must be a 32-byte base64url string.')
  if (vault.ringId !== undefined && (typeof vault.ringId !== 'string' || !vault.ringId)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault ring id must be a non-empty string.')
  }
  if (!isPlainObject(vault.keyring)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault keyring must be an object.')
  for (const [kid, key] of Object.entries(vault.keyring)) {
    if (!PERIOD_RE.test(kid) || !isRawKey(key)) {
      throw new VaultCryptoError('VAULT_BAD_KEY', 'The vault keyring contains an invalid entry.')
    }
  }
  return vault
}

function parseEnvelope (value, label) {
  let envelope = value
  if (typeof envelope === 'string') {
    try {
      envelope = JSON.parse(envelope)
    } catch (error) {
      throw new VaultCryptoError('VAULT_BAD_INPUT', `The ${label} envelope is not valid JSON.`, { cause: error })
    }
  }
  if (!isPlainObject(envelope)) throw new VaultCryptoError('VAULT_BAD_INPUT', `The ${label} envelope must be an object.`)
  if (envelope.v !== 1) throw new VaultCryptoError('VAULT_BAD_INPUT', `Unsupported ${label} envelope version.`)
  if (envelope.alg !== STORE_ALG) throw new VaultCryptoError('VAULT_BAD_INPUT', `Unsupported ${label} algorithm.`)
  return envelope
}

function envelopeKdf (envelope) {
  const kdf = envelope.kdf
  if (!isPlainObject(kdf) || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault KDF parameters are invalid.')
  }
  const iterations = Number(kdf.iterations)
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault KDF iteration count is out of range.')
  }
  if (typeof kdf.salt !== 'string' || !kdf.salt) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault KDF salt is missing.')
  }
  return { iterations, salt: base64UrlDecode(kdf.salt) }
}

async function derivePassphraseKey (passphrase, salt, iterations) {
  try {
    const material = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
    return await subtle().deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_PASSPHRASE', 'The vault key could not be derived.', { cause: error })
  }
}

async function sealWithPassphrase (payload, passphrase, aadText) {
  const salt = randomBytes(PBKDF2_SALT_BYTES)
  const iv = randomBytes(GCM_IV_BYTES)
  const key = await derivePassphraseKey(passphrase, salt, PBKDF2_ITERATIONS)
  const plaintext = new TextEncoder().encode(canonicalJson(payload))
  const aad = new TextEncoder().encode(aadText)
  let ct
  try {
    ct = new Uint8Array(await subtle().encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      key,
      plaintext
    ))
  } catch (error) {
    throw new VaultCryptoError('VAULT_TAG', 'The vault could not be encrypted.', { cause: error })
  }
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: base64UrlEncode(salt) },
    iv: base64UrlEncode(iv),
    ct: base64UrlEncode(ct)
  }
}

async function openWithPassphrase (envelope, passphrase, aadText) {
  const { iterations, salt } = envelopeKdf(envelope)
  if (typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault envelope is missing iv or ct.')
  }
  const iv = base64UrlDecode(envelope.iv)
  if (iv.length !== GCM_IV_BYTES) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault IV must be 12 bytes.')
  const key = await derivePassphraseKey(passphrase, salt, iterations)

  let plain
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aadText), tagLength: 128 },
      key,
      base64UrlDecode(envelope.ct)
    )
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_PASSPHRASE', 'The passphrase is incorrect or the vault is corrupted.', { cause: error })
  }

  let payload
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain))
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The decrypted vault is not valid JSON.', { cause: error })
  }
  if (!isPlainObject(payload)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The decrypted vault must be an object.')
  return payload
}

function storeAad (account) {
  return `${STORE_AAD_PREFIX}|${account}`
}

function resolveStorage (storage) {
  const target = storage || (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null)
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new Error('Vault storage is unavailable.')
  }
  return target
}

/**
 * Create a fresh creator vault for one account and period.
 *
 * Generates a random 256-bit content key and a random 256-bit ring key. The
 * returned object is plaintext key material; callers must encrypt it with
 * `encryptVault` before persisting.
 */
export async function createCreatorVault ({ account, passphrase, now = new Date() } = {}) {
  const accountName = normalizeAccount(account)
  requirePassphrase(passphrase)
  const date = normalizeDate(now)
  const kid = periodFor(date)
  const contentKey = randomKey()

  return {
    v: 1,
    account: accountName,
    createdAt: date.toISOString(),
    kid,
    keyring: { [kid]: contentKey },
    ringKey: randomKey(),
    ringKid: kid,
    ringId: randomKey()
  }
}

/**
 * Encrypt a creator vault with a passphrase.
 *
 * Envelope: `{ v, account, alg, kdf, iv, ct }`. AAD binds the envelope to the
 * account (`banksia.vault.store.v1|account`), so copying a vault between
 * accounts fails closed.
 */
export async function encryptVault (vault, passphrase) {
  assertVaultShape(vault)
  requirePassphrase(passphrase)
  const account = normalizeAccount(vault.account)
  const sealed = await sealWithPassphrase(vault, passphrase, storeAad(account))
  return {
    v: 1,
    account,
    alg: STORE_ALG,
    kdf: sealed.kdf,
    iv: sealed.iv,
    ct: sealed.ct
  }
}

/**
 * Decrypt a creator vault envelope with a passphrase.
 *
 * Throws `VAULT_BAD_PASSPHRASE` when the AES-GCM tag fails (wrong passphrase or
 * corruption) and `VAULT_BAD_INPUT` for a malformed envelope.
 */
export async function decryptVault (envelope, passphrase) {
  const parsed = parseEnvelope(envelope, 'vault')
  requirePassphrase(passphrase)
  const account = normalizeAccount(parsed.account)
  const vault = await openWithPassphrase(parsed, passphrase, storeAad(account))
  assertVaultShape(vault)
  if (vault.account !== account) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault account does not match its envelope.')
  }
  return vault
}

/**
 * Persist an encrypted creator vault under `banksia_vault_creator_<account>`.
 *
 * This is the only permitted localStorage use in the vault stack. The stored
 * string is the encrypted envelope; plaintext keys never touch storage.
 * Returns the envelope that was written.
 */
export async function saveCreatorVault (account, vault, passphrase, storage) {
  const accountName = normalizeAccount(account)
  if (!isPlainObject(vault) || normalizeAccount(vault.account) !== accountName) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The vault does not belong to this account.')
  }
  const target = resolveStorage(storage)
  const envelope = await encryptVault(vault, passphrase)
  target.setItem(VAULT_STORAGE_PREFIX + accountName, JSON.stringify(envelope))
  return envelope
}

/** Load and decrypt a creator vault, or null when nothing is stored. */
export async function loadCreatorVault (account, passphrase, storage) {
  const accountName = normalizeAccount(account)
  const target = resolveStorage(storage)
  const raw = target.getItem(VAULT_STORAGE_PREFIX + accountName)
  if (!raw) return null
  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isPlainObject(envelope)) return null
  return decryptVault(envelope, passphrase)
}

/** True when an encrypted creator vault exists for the account. */
export function hasCreatorVault (account, storage) {
  try {
    const accountName = normalizeAccount(account)
    const target = resolveStorage(storage)
    return Boolean(target.getItem(VAULT_STORAGE_PREFIX + accountName))
  } catch {
    return false
  }
}

/** Remove the stored creator vault for the account. */
export function deleteCreatorVault (account, storage) {
  const accountName = normalizeAccount(account)
  const target = resolveStorage(storage)
  if (typeof target.removeItem === 'function') target.removeItem(VAULT_STORAGE_PREFIX + accountName)
  else target.setItem(VAULT_STORAGE_PREFIX + accountName, '')
}

/**
 * Build a downloadable creator backup: `{ type, vault }` where `vault` is the
 * encrypted envelope. The passphrase is never included.
 */
export async function exportCreatorVault (vault, passphrase) {
  const envelope = await encryptVault(vault, passphrase)
  return { type: CREATOR_EXPORT_TYPE, vault: envelope }
}

/** Import a creator backup (object or JSON text) and decrypt it. */
export async function importCreatorVault (textOrObject, passphrase) {
  let value = textOrObject
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch (error) {
      throw new VaultCryptoError('VAULT_BAD_INPUT', 'The creator backup is not valid JSON.', { cause: error })
    }
  }
  if (!isPlainObject(value)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The creator backup must be an object.')
  if (value.type !== undefined && value.type !== CREATOR_EXPORT_TYPE) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Unsupported creator backup type.')
  }
  const envelope = isPlainObject(value.vault) ? value.vault : value
  return decryptVault(envelope, passphrase)
}

/**
 * Rotate to a new period: a fresh content key, a fresh ring key and a new kid,
 * while keeping every older keyring entry for the archive.
 */
export function rotatePeriod (vault, { kid, now } = {}) {
  assertVaultShape(vault)
  let nextKid = kid
  if (nextKid === undefined || nextKid === null) {
    nextKid = periodFor(normalizeDate(now === undefined ? new Date() : now))
  }
  if (typeof nextKid !== 'string' || !PERIOD_RE.test(nextKid)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The new kid must be YYYY-MM.')
  }

  const contentKey = randomKey()
  return {
    ...vault,
    kid: nextKid,
    keyring: { ...vault.keyring, [nextKid]: contentKey },
    ringKey: randomKey(),
    ringKid: nextKid,
    ringId: randomKey()
  }
}

/**
 * Export a reader recovery envelope.
 *
 * Contains `{ account, blog, privateJwk, publicKeyB64 }`, encrypted with the
 * passphrase. The reader should treat the file as the private key itself.
 */
export async function exportReaderRecovery ({ account, blog, privateJwk, publicKeyB64, passphrase } = {}) {
  const readerAccount = normalizeAccount(account)
  const blogAccount = normalizeAccount(blog)
  if (!isPlainObject(privateJwk)) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'A reader private JWK is required for recovery.')
  }
  if (typeof publicKeyB64 !== 'string' || !publicKeyB64.startsWith('p256:') || publicKeyB64.length < 80) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'A p256: reader public key is required for recovery.')
  }
  requirePassphrase(passphrase)

  const payload = {
    account: readerAccount,
    blog: blogAccount,
    privateJwk,
    publicKeyB64
  }
  const sealed = await sealWithPassphrase(payload, passphrase, RECOVERY_AAD_PREFIX)

  return {
    v: 1,
    type: READER_RECOVERY_TYPE,
    alg: STORE_ALG,
    kdf: sealed.kdf,
    iv: sealed.iv,
    ct: sealed.ct
  }
}

/** Import a reader recovery envelope (object or JSON text) and decrypt it. */
export async function importReaderRecovery (textOrObject, passphrase) {
  let value = textOrObject
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch (error) {
      throw new VaultCryptoError('VAULT_BAD_INPUT', 'The reader recovery file is not valid JSON.', { cause: error })
    }
  }
  if (!isPlainObject(value)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The reader recovery file must be an object.')
  if (value.v !== 1 || value.type !== READER_RECOVERY_TYPE) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Unsupported reader recovery file.')
  }
  const parsed = parseEnvelope(value, 'reader recovery')
  requirePassphrase(passphrase)

  const payload = await openWithPassphrase(parsed, passphrase, RECOVERY_AAD_PREFIX)
  const account = normalizeAccount(payload.account)
  const blog = normalizeAccount(payload.blog)
  if (!isPlainObject(payload.privateJwk) || typeof payload.publicKeyB64 !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The reader recovery payload is incomplete.')
  }
  return { account, blog, privateJwk: payload.privateJwk, publicKeyB64: payload.publicKeyB64 }
}
