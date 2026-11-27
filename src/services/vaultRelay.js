// Banksia Vault relay companion (`banksia.vault.relay@1`).
//
// The relay is optional. This module only adds creator certificate handling,
// delegated-bulletin verification and encrypted relay-bundle export. The
// self-sovereign v1 path does not import any relay behaviour.

import {
  VaultCryptoError,
  base64UrlDecode,
  base64UrlEncode,
  canonicalJson,
  randomBytes,
  sha256Hex
} from './vaultCrypto'
import { buildBulletinSigningPayload, buildDelegationSigningPayload, signDelegation } from './vaultGrant'
import { postingPublicKeys, verifyVaultPayloadForAccount } from './vaultSigning'

export const RELAY_BUNDLE_TYPE = 'banksia.vault.relay@1'
export const RELAY_CERT_ID = 'banksia.vault.delegate'
export const RELAY_BUNDLE_AAD_PREFIX = 'banksia.vault.relay@1'

const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const STM_RE = /^STM[1-9A-HJ-NP-Za-km-z]{40,60}$/
const NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/
const SIG_RE = /^[0-9a-fA-F]{130}$/
const PERIOD_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/
const PBKDF2_ITERATIONS = 310000

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function subtle () {
  const api = globalThis.crypto && globalThis.crypto.subtle
  if (!api) throw new VaultCryptoError('VAULT_UNAVAILABLE', 'WebCrypto is not available in this environment.')
  return api
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function iso (value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value || ''))
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}

function withoutSig (cert) {
  const { sig: _sig, ...rest } = cert
  return rest
}

/** Canonical certificate hash referenced by a delegated bulletin. */
export async function relayCertificateHash (cert) {
  if (!isPlainObject(cert)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay certificate must be an object.')
  return 'sha256:' + await sha256Hex(canonicalJson(withoutSig(cert)))
}

/** Structural certificate parser. Signature verification is separate. */
export function parseRelayCertificate (value) {
  if (!isPlainObject(value)) return null
  if (value.v !== 1 || value.id !== RELAY_CERT_ID) return null
  const blog = normalizeAccount(value.blog)
  const delegateAccount = normalizeAccount(value.delegate_account)
  if (!HIVE_ACCOUNT_RE.test(blog) || !HIVE_ACCOUNT_RE.test(delegateAccount)) return null
  if (typeof value.delegate !== 'string' || !STM_RE.test(value.delegate.trim())) return null
  if (!Array.isArray(value.scope) || !value.scope.includes('grant') || !value.scope.includes('bulletin')) return null
  const notBefore = iso(value.notBefore)
  const notAfter = iso(value.notAfter)
  if (!notBefore || !notAfter || Date.parse(notAfter) <= Date.parse(notBefore)) return null
  if (typeof value.nonce !== 'string' || !NONCE_RE.test(value.nonce)) return null
  if (typeof value.sig !== 'string' || !SIG_RE.test(value.sig)) return null
  return {
    v: 1,
    id: RELAY_CERT_ID,
    blog,
    delegate_account: delegateAccount,
    delegate: value.delegate.trim(),
    scope: [...new Set(value.scope.filter(item => typeof item === 'string'))],
    notBefore,
    notAfter,
    nonce: value.nonce,
    sig: value.sig
  }
}

/** Read `blog.vault.relay` from a Hive account object. */
export function relayCertificateFromAccount (account) {
  if (!account || typeof account !== 'object') return null
  let metadata = account.posting_json_metadata
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata) } catch { return null }
  }
  if (!isPlainObject(metadata)) return null
  const namespace = isPlainObject(metadata['banksia.io'])
    ? metadata['banksia.io']
    : isPlainObject(metadata.banksia_io)
        ? metadata.banksia_io
        : null
  const blog = namespace && isPlainObject(namespace.blog) ? namespace.blog : null
  const vault = blog && isPlainObject(blog.vault) ? blog.vault : null
  if (!vault || !isPlainObject(vault.relay)) return null
  return parseRelayCertificate(vault.relay)
}

/** Build an unsigned certificate; call `signRelayCertificate` with a signer. */
export function buildRelayCertificate ({
  blog,
  delegateAccount,
  delegatePublicKey,
  scope = ['grant', 'bulletin'],
  notBefore,
  notAfter,
  now = Date.now(),
  days = 90,
  nonce
} = {}) {
  const owner = normalizeAccount(blog)
  const relay = normalizeAccount(delegateAccount)
  if (!HIVE_ACCOUNT_RE.test(owner) || !HIVE_ACCOUNT_RE.test(relay)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A valid blog and relay account are required.')
  }
  if (owner === relay) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay account must be separate from the blog.')
  if (typeof delegatePublicKey !== 'string' || !STM_RE.test(delegatePublicKey.trim())) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay posting public key is invalid.')
  }
  if (!Array.isArray(scope) || !scope.includes('grant') || !scope.includes('bulletin')) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The certificate scope must include grant and bulletin.')
  }
  const start = notBefore ? iso(notBefore) : new Date(now).toISOString()
  const end = notAfter ? iso(notAfter) : new Date(now + Math.max(1, Number(days) || 90) * 86400000).toISOString()
  if (!start || !end || Date.parse(end) <= Date.parse(start)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The certificate validity window is invalid.')
  }
  return {
    v: 1,
    id: RELAY_CERT_ID,
    blog: owner,
    delegate_account: relay,
    delegate: delegatePublicKey.trim(),
    scope: [...new Set(scope)],
    notBefore: start,
    notAfter: end,
    nonce: nonce || base64UrlEncode(randomBytes(16))
  }
}

/** Sign a certificate with the creator's posting-key adapter. */
export async function signRelayCertificate (cert, signerAdapter) {
  return signDelegation(cert, signerAdapter)
}

/**
 * Verify a certificate against the creator's posting authority and, when
 * supplied, the current relay account authority.
 */
export async function verifyRelayCertificate ({
  cert,
  blog,
  relayAccount = '',
  relayPublicKey = '',
  creatorAccount = null,
  creatorPostingKeys = null,
  relayAccountObject = null,
  certHash = '',
  now = Date.now(),
  verify = verifyVaultPayloadForAccount
} = {}) {
  const parsed = parseRelayCertificate(cert)
  if (!parsed) return { ok: false, reason: 'malformed-certificate' }
  const owner = normalizeAccount(blog)
  if (!HIVE_ACCOUNT_RE.test(owner) || parsed.blog !== owner) return { ok: false, reason: 'wrong-blog' }
  if (relayAccount && parsed.delegate_account !== normalizeAccount(relayAccount)) {
    return { ok: false, reason: 'wrong-delegate-account' }
  }
  if (relayPublicKey && parsed.delegate !== relayPublicKey) return { ok: false, reason: 'wrong-delegate-key' }
  if (now < Date.parse(parsed.notBefore)) return { ok: false, reason: 'not-yet-valid' }
  if (now > Date.parse(parsed.notAfter)) return { ok: false, reason: 'expired' }
  const hash = await relayCertificateHash(parsed)
  if (certHash && certHash !== hash) return { ok: false, reason: 'cert-hash-mismatch' }

  const keys = Array.isArray(creatorPostingKeys) && creatorPostingKeys.length
    ? creatorPostingKeys
    : postingPublicKeys(creatorAccount)
  if (!keys.length) return { ok: false, reason: 'no-creator-posting-key' }
  let signed = false
  for (const key of keys) {
    if (await verify({
      payload: buildDelegationSigningPayload(parsed),
      signature: parsed.sig,
      account: creatorAccount,
      publicKeys: [key]
    })) {
      signed = true
      break
    }
  }
  if (!signed) return { ok: false, reason: 'bad-creator-signature' }

  if (relayAccountObject) {
    const relayKeys = postingPublicKeys(relayAccountObject)
    if (relayKeys.length && !relayKeys.includes(parsed.delegate)) {
      return { ok: false, reason: 'relay-authority-mismatch' }
    }
  }
  return { ok: true, reason: '', certificate: parsed, hash }
}

/**
 * Verify a relay-authored bulletin after its creator certificate has passed.
 * The signature is checked with exactly the delegate key named by the
 * certificate, not with any current relay posting key.
 */
export async function verifyDelegatedBulletin ({
  bulletin,
  certificate,
  certHash = '',
  creatorAccount = null,
  relayAccount = null,
  now = Date.now(),
  verify = verifyVaultPayloadForAccount
} = {}) {
  if (!isPlainObject(bulletin)) return { ok: false, reason: 'bulletin' }
  if (!isPlainObject(certificate)) return { ok: false, reason: 'certificate' }
  const signer = normalizeAccount(bulletin.signer)
  if (!HIVE_ACCOUNT_RE.test(signer) || signer !== certificate.delegate_account) {
    return { ok: false, reason: 'signer' }
  }
  if (!isPlainObject(bulletin.delegation)) return { ok: false, reason: 'delegation' }
  if (bulletin.delegation.delegate_account !== certificate.delegate_account ||
    bulletin.delegation.delegate !== certificate.delegate) {
    return { ok: false, reason: 'delegation' }
  }
  const expectedHash = certHash || await relayCertificateHash(certificate)
  if (bulletin.delegation.certHash !== expectedHash) return { ok: false, reason: 'cert-hash' }

  const certCheck = await verifyRelayCertificate({
    cert: certificate,
    blog: bulletin.blog,
    relayAccount: signer,
    relayPublicKey: certificate.delegate,
    creatorAccount,
    relayAccountObject: relayAccount,
    certHash: expectedHash,
    now,
    verify
  })
  if (!certCheck.ok) return { ok: false, reason: certCheck.reason }

  let payload
  try {
    payload = await buildBulletinSigningPayload(bulletin)
  } catch {
    return { ok: false, reason: 'bulletin' }
  }
  let ok
  try {
    ok = Boolean(await verify({
      payload,
      signature: bulletin.sig,
      account: relayAccount,
      publicKeys: [certificate.delegate]
    }))
  } catch {
    ok = false
  }
  return ok ? { ok: true, reason: '' } : { ok: false, reason: 'signature' }
}

export function relayBundleAad (blog, relayAccount) {
  return RELAY_BUNDLE_AAD_PREFIX + '|' + normalizeAccount(blog) + '|' + normalizeAccount(relayAccount)
}

async function deriveBundleKey (passphrase, salt, iterations) {
  const material = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt the relay bundle the operator imports into the relay. Plaintext is
 * `{ keyring, ringKid, ringKey, period, createdAt }`; the passphrase is never
 * included.
 */
export async function createRelayBundle ({
  blog,
  relayAccount,
  keyring,
  ringKid,
  ringKey,
  period,
  passphrase,
  now = new Date(),
  iterations = PBKDF2_ITERATIONS
} = {}) {
  const owner = normalizeAccount(blog)
  const relay = normalizeAccount(relayAccount)
  if (!HIVE_ACCOUNT_RE.test(owner) || !HIVE_ACCOUNT_RE.test(relay)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A valid blog and relay account are required.')
  }
  if (!isPlainObject(keyring)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring is missing.')
  if (typeof ringKey !== 'string' || !ringKey) throw new VaultCryptoError('VAULT_BAD_KEY', 'The ring key is missing.')
  const ringPeriod = String(period || ringKid || '')
  if (!PERIOD_RE.test(ringPeriod)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The bundle period must be YYYY-MM.')
  if (typeof passphrase !== 'string' || passphrase.length < 12) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Use a relay-bundle passphrase of at least 12 characters.')
  }
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveBundleKey(passphrase, salt, iterations)
  const plaintext = {
    keyring,
    ringKid: ringKid || ringPeriod,
    ringKey,
    period: ringPeriod,
    createdAt: (now instanceof Date ? now : new Date(now)).toISOString()
  }
  const ct = new Uint8Array(await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(relayBundleAad(owner, relay)), tagLength: 128 },
    key,
    new TextEncoder().encode(canonicalJson(plaintext))
  ))
  return {
    v: 1,
    type: RELAY_BUNDLE_TYPE,
    blog: owner,
    relay_account: relay,
    alg: 'PBKDF2-SHA256-A256GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: base64UrlEncode(salt) },
    iv: base64UrlEncode(iv),
    ct: base64UrlEncode(ct)
  }
}

/** Decrypt a relay bundle. Mainly used by operator tooling and tests. */
export async function openRelayBundle ({ bundle, passphrase, blog, relayAccount } = {}) {
  let value = bundle
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay bundle is not valid JSON.') }
  }
  if (!isPlainObject(value) || value.v !== 1 || value.type !== RELAY_BUNDLE_TYPE) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'This is not a banksia.vault.relay@1 bundle.')
  }
  if (value.blog !== normalizeAccount(blog) || value.relay_account !== normalizeAccount(relayAccount)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay bundle belongs to a different blog or relay account.')
  }
  const kdf = value.kdf
  if (!isPlainObject(kdf) || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay bundle KDF is invalid.')
  }
  const iterations = Number(kdf.iterations)
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 5000000) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay bundle KDF iterations are out of range.')
  }
  const key = await deriveBundleKey(passphrase, base64UrlDecode(kdf.salt), iterations)
  let plain
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(value.iv), additionalData: new TextEncoder().encode(relayBundleAad(blog, relayAccount)), tagLength: 128 },
      key,
      base64UrlDecode(value.ct)
    )
  } catch {
    throw new VaultCryptoError('VAULT_BAD_PASSPHRASE', 'The passphrase is incorrect or the bundle is corrupted.')
  }
  const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain))
  if (!isPlainObject(payload) || !isPlainObject(payload.keyring) || !PERIOD_RE.test(String(payload.period || ''))) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The relay bundle payload is invalid.')
  }
  return payload
}

/** Human status for the dashboard, without throwing on malformed input. */
export function relayCertificateStatus (cert, { now = Date.now(), relayAccount = '' } = {}) {
  const parsed = parseRelayCertificate(cert)
  if (!parsed) return { state: 'none', valid: false, expiresAt: '', reason: 'not-configured' }
  if (relayAccount && parsed.delegate_account !== normalizeAccount(relayAccount)) {
    return { state: 'mismatch', valid: false, expiresAt: parsed.notAfter, reason: 'relay-account-mismatch' }
  }
  if (now < Date.parse(parsed.notBefore)) {
    return { state: 'not-yet-valid', valid: false, expiresAt: parsed.notAfter, reason: 'not-yet-valid' }
  }
  if (now > Date.parse(parsed.notAfter)) {
    return { state: 'expired', valid: false, expiresAt: parsed.notAfter, reason: 'expired' }
  }
  return { state: 'valid', valid: true, expiresAt: parsed.notAfter, reason: '' }
}

/** Latest delegated bulletin in a reply list, newest period then seq. */
export function latestDelegatedBulletin (replies, { blog, relayAccount = '' } = {}) {
  const owner = normalizeAccount(blog)
  let best = null
  for (const reply of Array.isArray(replies) ? replies : []) {
    if (!reply || typeof reply !== 'object') continue
    const author = normalizeAccount(reply.author)
    if (author !== owner && (!relayAccount || author !== normalizeAccount(relayAccount))) continue
    let metadata = reply.json_metadata
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata) } catch { continue }
    }
    const bulletin = isPlainObject(metadata) && isPlainObject(metadata.banksia_vault_bulletin)
      ? metadata.banksia_vault_bulletin
      : null
    if (!bulletin || bulletin.v !== 1 || normalizeAccount(bulletin.blog) !== owner) continue
    if (!isPlainObject(bulletin.delegation)) continue
    if (!best || String(bulletin.period) > String(best.period) ||
      (bulletin.period === best.period && Number(bulletin.seq) > Number(best.seq))) {
      best = bulletin
    }
  }
  return best
}
