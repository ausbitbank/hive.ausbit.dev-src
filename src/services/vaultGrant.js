// Banksia Vault — grants, bulletins and their signatures (banksia.vault@1).
//
// A bulletin is the signed, public keyring delivery document. It carries the
// sealed keyring blob and one wrapped ring-key entry per reader. Signatures are
// produced through an injectable adapter so unit tests stay pure and the app can
// plug in Keychain, HiveAuth or SmartLock.
//
// Signing payload shapes (all UTF-8):
//   bulletin: `${BULLETIN_SIG_PREFIX}|${canonicalJson(payloadObject)}`
//   grant:    `${GRANT_SIG_PREFIX}|${canonicalJson(grantWithoutSig)}`
//
// `payloadObject` is the bulletin without `sig`, with `keyringHash` inserted
// when a keyring is present. Because the keyring object is also signed verbatim,
// swapping the keyring (or any entry) invalidates the signature.

import {
  BULLETIN_SIG_PREFIX,
  GRANT_SIG_PREFIX,
  VaultCryptoError,
  canonicalJson,
  sha256Hex
} from './vaultCrypto'

export { canonicalJson }

const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const PERIOD_RE = /^\d{4}-\d{2}$/
const THUMBPRINT_RE = /^[0-9a-f]{16}$/
const BULLETIN_PERMLINK_RE = /^vault-(\d{4}-\d{2})-(\d+)(?:-\d+)?$/

function isPlainObject (value) {
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value)
  // Cross-realm plain objects: proto is that realm's Object.prototype, whose
  // own prototype is null. Class instances have a deeper chain.
  return proto === null || Object.getPrototypeOf(proto) === null
}

function requireString (value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `The ${label} must be a non-empty string.`)
  }
  return value.trim()
}

function requireBlog (value) {
  const blog = requireString(value, 'blog account').toLowerCase()
  if (!HIVE_ACCOUNT_RE.test(blog)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `Invalid Hive account name: ${value}`)
  }
  return blog
}

function requirePeriod (value) {
  const period = requireString(value, 'period')
  if (!PERIOD_RE.test(period)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The period must be YYYY-MM.')
  }
  return period
}

function requireExpires (value) {
  const expires = requireString(value, 'expires timestamp')
  if (!Number.isFinite(Date.parse(expires))) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The expires timestamp is not a valid date.')
  }
  return expires
}

function requireRkt (value) {
  const rkt = requireString(value, 'reader key thumbprint').toLowerCase()
  if (!THUMBPRINT_RE.test(rkt)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The reader key thumbprint must be 16 lowercase hex characters.')
  }
  return rkt
}

function withoutSig (value) {
  const { sig: _sig, ...rest } = value
  return rest
}

/**
 * Build the canonical grant header that binds a wrapped ring key to a reader,
 * a blog, a period, a tier and an expiry.
 *
 * Exactly six keys are returned: `{ blog, rkt, period, tier, expires }` plus
 * the reader thumbprint under `rkt`. The same object is the HKDF info and the
 * AES-GCM AAD for the wrap.
 */
export function buildGrantHeader (entry, context) {
  if (!isPlainObject(entry)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The grant entry must be an object.')
  if (!isPlainObject(context)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The grant context must be an object.')

  const tier = entry.tier === undefined || entry.tier === null
    ? (context.tier === undefined || context.tier === null ? 'member' : context.tier)
    : entry.tier

  return {
    blog: requireBlog(context.blog),
    rkt: requireRkt(entry.rkt),
    period: requirePeriod(context.period),
    tier: requireString(tier, 'tier').slice(0, 64),
    expires: requireExpires(entry.expires)
  }
}

/**
 * Async bulletin payload object: the bulletin without `sig`, with a
 * `keyringHash` of `sha256:<hex>` over `canonicalJson(bulletin.keyring)`
 * inserted when a keyring is present.
 *
 * Verification must call this again rather than trusting an inbound
 * `keyringHash`; the computed value always wins.
 */
export async function bulletinPayloadObject (bulletin) {
  if (!isPlainObject(bulletin)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The bulletin must be an object.')
  }
  const payload = withoutSig(bulletin)
  if (payload.keyring !== undefined && payload.keyring !== null) {
    payload.keyringHash = `sha256:${await sha256Hex(canonicalJson(payload.keyring))}`
  }
  return payload
}

/** The exact UTF-8 string a bulletin signature covers. */
export async function buildBulletinSigningPayload (bulletin) {
  return `${BULLETIN_SIG_PREFIX}|${canonicalJson(await bulletinPayloadObject(bulletin))}`
}

/** The exact UTF-8 string a standalone grant signature covers. */
export function buildGrantSigningPayload (grant) {
  if (!isPlainObject(grant)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The grant must be an object.')
  return `${GRANT_SIG_PREFIX}|${canonicalJson(withoutSig(grant))}`
}

function isBulletinShape (grant) {
  return isPlainObject(grant) &&
    (Object.prototype.hasOwnProperty.call(grant, 'keyring') ||
      Object.prototype.hasOwnProperty.call(grant, 'entries'))
}

async function signingPayloadFor (grant) {
  return isBulletinShape(grant)
    ? buildBulletinSigningPayload(grant)
    : buildGrantSigningPayload(grant)
}

/**
 * Sign a grant or bulletin. Returns a shallow copy with `sig` appended.
 *
 * `signerAdapter` is `{ sign: async (text) => signatureString }`.
 */
export async function signGrant (grant, signerAdapter) {
  if (!isPlainObject(grant)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The grant must be an object.')
  if (!signerAdapter || typeof signerAdapter.sign !== 'function') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'A signer adapter with sign(text) is required.')
  }
  const payload = await signingPayloadFor(grant)
  const sig = await signerAdapter.sign(payload)
  if (typeof sig !== 'string' || !sig) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The signer did not return a signature.')
  }
  return { ...grant, sig }
}

/**
 * Verify a grant or bulletin signature. Recomputes the payload, including the
 * keyring hash when present. Returns false on malformed input rather than
 * throwing so a tampered bulletin renders a safe error.
 *
 * `verifierAdapter` is `{ verify: async (text, sig) => boolean }`.
 */
export async function verifyGrant (grant, verifierAdapter) {
  try {
    if (!isPlainObject(grant)) return false
    if (typeof grant.sig !== 'string' || !grant.sig) return false
    if (!verifierAdapter || typeof verifierAdapter.verify !== 'function') return false
    const payload = await signingPayloadFor(grant)
    return Boolean(await verifierAdapter.verify(payload, grant.sig))
  } catch {
    return false
  }
}

/**
 * Verify a relay delegation certificate.
 *
 * Checks `v === 1`, that `scope` includes `grant`, that the current time is
 * within `notBefore`/`notAfter`, then verifies the signature against any of the
 * creator's posting keys. The payload is the grant prefix over the certificate
 * without `sig`. Never throws; returns false on malformed input.
 *
 * `verifierAdapter.verify(text, sig, publicKey)` may ignore the third argument
 * when it is already bound to a key.
 */
export async function verifyDelegation (cert, creatorPostingKeys, verifierAdapter) {
  try {
    if (!isPlainObject(cert) || cert.v !== 1) return false
    if (!Array.isArray(cert.scope) || !cert.scope.includes('grant')) return false
    if (typeof cert.sig !== 'string' || !cert.sig) return false
    if (!verifierAdapter || typeof verifierAdapter.verify !== 'function') return false

    const now = Date.now()
    const notBefore = cert.notBefore === undefined ? NaN : Date.parse(cert.notBefore)
    const notAfter = cert.notAfter === undefined ? NaN : Date.parse(cert.notAfter)
    if (!Number.isFinite(notAfter)) return false
    if (Number.isFinite(notBefore) && now < notBefore) return false
    if (now > notAfter) return false

    const keys = (Array.isArray(creatorPostingKeys) ? creatorPostingKeys : [creatorPostingKeys])
      .filter(key => typeof key === 'string' && key)
    if (!keys.length) return false

    const payload = buildGrantSigningPayload(cert)
    for (const key of keys) {
      if (await verifierAdapter.verify(payload, cert.sig, key)) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Cheap local grant check used before any crypto work.
 *
 * Confirms the blog, period and reader thumbprint match and that `expires`
 * parses to a future timestamp. `now` may be a number or a Date. Never throws.
 */
export function isGrantValid (grantOrEntry, { blog, period, rkt, now = Date.now() } = {}) {
  try {
    if (!isPlainObject(grantOrEntry)) return false
    if (typeof blog === 'string' && grantOrEntry.blog !== blog.toLowerCase()) return false
    if (typeof period === 'string' && grantOrEntry.period !== period) return false
    if (typeof rkt === 'string' && String(grantOrEntry.rkt || '').toLowerCase() !== rkt.toLowerCase()) return false

    const expires = Date.parse(grantOrEntry.expires)
    if (!Number.isFinite(expires)) return false
    const current = now instanceof Date ? now.getTime() : Number(now)
    if (!Number.isFinite(current)) return false
    return expires > current
  } catch {
    return false
  }
}

function normalizeKeyring (keyring) {
  if (!isPlainObject(keyring)) return null
  if (typeof keyring.iv !== 'string' || typeof keyring.ct !== 'string') return null
  return { ...keyring }
}

function normalizeEntry (entry) {
  if (!isPlainObject(entry)) return null
  if (typeof entry.rkt !== 'string' || !entry.rkt) return null
  if (typeof entry.epk !== 'string' || typeof entry.iv !== 'string' || typeof entry.ct !== 'string') return null
  return { ...entry }
}

/**
 * Parse `json_metadata.banksia_vault_bulletin` (or the unwrapped bulletin).
 *
 * Validates the version, account, period, sequence, keyring blob and entries
 * array. The returned object preserves every field of the source bulletin so a
 * parsed bulletin can still be signature-verified: canonical JSON ignores key
 * order, so the only risk would be dropping or inventing fields. Malformed
 * entries are dropped; signatures are NOT verified here. Use `verifyGrant` with
 * a real verifier afterwards. Returns null on invalid input.
 */
export function parseBulletin (jsonMetadata) {
  try {
    let root = jsonMetadata
    if (typeof root === 'string') {
      try {
        root = JSON.parse(root)
      } catch {
        return null
      }
    }
    if (!isPlainObject(root)) return null

    const raw = isPlainObject(root.banksia_vault_bulletin) ? root.banksia_vault_bulletin : root
    if (!isPlainObject(raw)) return null
    if (raw.v !== 1) return null
    if (typeof raw.blog !== 'string' || !HIVE_ACCOUNT_RE.test(raw.blog)) return null
    if (typeof raw.period !== 'string' || !PERIOD_RE.test(raw.period)) return null

    const seq = raw.seq
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) return null

    const keyring = normalizeKeyring(raw.keyring)
    if (!keyring) return null
    if (!Array.isArray(raw.entries)) return null

    const entries = raw.entries.map(normalizeEntry).filter(Boolean)

    return {
      ...raw,
      v: 1,
      blog: raw.blog,
      period: raw.period,
      seq,
      keyring,
      entries
    }
  } catch {
    return null
  }
}

/**
 * Next bulletin sequence for a period.
 *
 * Scans comment permlinks shaped `vault-YYYY-MM-N` or `vault-YYYY-MM-N-P` and
 * returns the highest sequence + 1 (default 1). Pass `period` to ignore other
 * periods; without it the caller is expected to pass replies for one period.
 */
export function nextBulletinSequence (replies, period = null) {
  let max = 0
  for (const reply of Array.isArray(replies) ? replies : []) {
    const permlink = typeof reply === 'string' ? reply : (reply && reply.permlink)
    if (typeof permlink !== 'string') continue
    const match = permlink.match(BULLETIN_PERMLINK_RE)
    if (!match) continue
    if (typeof period === 'string' && match[1] !== period) continue
    max = Math.max(max, Number(match[2]))
  }
  return max + 1
}

/** Deterministic bulletin permlink: `vault-<period>-<seq>[-<part>]`. */
export function bulletinPermlink (period, seq, part = null) {
  const safePeriod = requirePeriod(period)
  const safeSeq = Number(seq)
  if (!Number.isInteger(safeSeq) || safeSeq < 1) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The bulletin sequence must be a positive integer.')
  }
  if (part === null || part === undefined) return `vault-${safePeriod}-${safeSeq}`
  const safePart = Number(part)
  if (!Number.isInteger(safePart) || safePart < 1) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The bulletin part must be a positive integer.')
  }
  return `vault-${safePeriod}-${safeSeq}-${safePart}`
}
