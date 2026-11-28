// Bulletin orchestration for Banksia Vault.
//
// A bulletin is the signed, on-chain delivery document for one period: the
// keyring sealed once with the period ring key, plus one wrapped ring-key entry
// per reader. Everything here is pure except the WebCrypto calls, so the
// dashboard and the tests share one implementation and no key material is ever
// logged or stored.
//
// The creator dashboard derives subscriber rows from verified Hive payments,
// wraps the ring key to each active reader, signs the bulletin with the posting
// key through `vaultGrant.signGrant`, and queues one `comment` under the hidden
// container. The reader side only needs the published bulletin.

import {
  VAULT_WRAP_ALG,
  base64UrlDecode,
  base64UrlEncode,
  readerKeyThumbprint,
  sealKeyring,
  sha256Base64Url,
  sha256Hex,
  wrapRingKey
} from './vaultCrypto'
import { buildGrantHeader, bulletinPermlink, canonicalJson, nextBulletinSequence, parseBulletin, signGrant } from './vaultGrant'
import {
  collectVaultPayments,
  nextPaymentDate
} from './vaultPayments'
import { isValidHiveAccountName } from './blogHost'

export const BULLETIN_MAX_ENTRIES = 300
export const BULLETIN_WARN_ENTRIES = 250
export const BULLETIN_MAX_BYTES = 60000
export const BULLETIN_V2_VERSION = 2
export const BULLETIN_SHARD_TARGET = 200
export const BULLETIN_SHARD_MIN = 8
export const BULLETIN_SHARD_MAX = 1024
export const BULLETIN_SHARD_COUNTS = Object.freeze([8, 16, 32, 64, 128, 256, 512, 1024])
export const READER_REGISTRY_ID = 'banksia.vault.reader_key'

const DAY_MS = 24 * 60 * 60 * 1000
const GRACE_MS = DAY_MS
const ONE_TIME_GRACE_MS = 31 * DAY_MS
const PENDING_WINDOW_MS = DAY_MS
const P256_RE = /^p256:[A-Za-z0-9_-]{40,120}$/

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

function byteLength (value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (typeof text !== 'string') return 0
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
    return text.length
  } catch {
    return 0
  }
}

function codedError (code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function hexToBytes (value) {
  const text = String(value || '').toLowerCase()
  if (!/^[0-9a-f]{16}$/.test(text)) return null
  const bytes = new Uint8Array(8)
  for (let index = 0; index < 8; index += 1) {
    bytes[index] = parseInt(text.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex (bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** 16-hex rkt -> 8-byte base64url for the compact v2 tuple. */
export function compactRkt (rkt) {
  const bytes = hexToBytes(rkt)
  return bytes ? base64UrlEncode(bytes) : ''
}

/** 8-byte base64url rkt -> 16 lowercase hex. */
export function expandRkt (compact) {
  if (typeof compact !== 'string' || !compact) return ''
  try {
    const bytes = base64UrlDecode(compact)
    return bytes.length === 8 ? bytesToHex(bytes) : ''
  } catch {
    return ''
  }
}

/** Epoch seconds for a parsed ISO expiry. */
export function expiresEpoch (expires) {
  const time = Date.parse(String(expires || ''))
  return Number.isFinite(time) ? Math.floor(time / 1000) : 0
}

export function epochExpires (epoch) {
  const value = Number(epoch)
  return Number.isInteger(value) && value > 0 ? new Date(value * 1000).toISOString() : ''
}

/** Deterministic shard for a reader key thumbprint. */
export function shardIndexForRkt (rkt, shardCount) {
  const count = Math.trunc(Number(shardCount))
  if (!Number.isInteger(count) || count < 1) return -1
  const first = parseInt(String(rkt || '').slice(0, 2), 16)
  if (!Number.isFinite(first)) return -1
  return first % count
}

/** Power-of-two shard count around sqrt-scale target density. */
export function shardCountForEntries (entries) {
  const count = Math.max(1, Math.trunc(Number(entries) || 1))
  const target = Math.ceil(count / BULLETIN_SHARD_TARGET)
  let shards = BULLETIN_SHARD_MIN
  while (shards < target && shards < BULLETIN_SHARD_MAX) shards *= 2
  return Math.min(shards, BULLETIN_SHARD_MAX)
}

/** Stable permlink for one shard revision. */
export function shardPermlink (period, shard, rev) {
  const safePeriod = String(period || '').trim()
  const index = Math.trunc(Number(shard))
  const revision = Math.trunc(Number(rev))
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(safePeriod)) return ''
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(revision) || revision < 1) return ''
  return 'vault-' + safePeriod + '-s' + index + '-r' + revision
}

/** Compact v2 entry tuple `[rkt, epk, iv, ct, expiresEpoch]`. */
export function compactShardEntry (entry) {
  if (!isPlainObject(entry)) return null
  const rkt = compactRkt(entry.rkt)
  if (!rkt || typeof entry.epk !== 'string' || typeof entry.iv !== 'string' || typeof entry.ct !== 'string') return null
  const expires = expiresEpoch(entry.expires)
  if (!expires) return null
  return [rkt, entry.epk, entry.iv, entry.ct, expires]
}

/** Expand a v2 tuple into the object shape used by the reader. */
export function expandShardEntry (tuple) {
  if (!Array.isArray(tuple) || tuple.length !== 5) return null
  const rkt = expandRkt(tuple[0])
  const expires = epochExpires(tuple[4])
  if (!rkt || typeof tuple[1] !== 'string' || typeof tuple[2] !== 'string' ||
    typeof tuple[3] !== 'string' || !expires) return null
  return {
    rkt,
    epk: tuple[1],
    iv: tuple[2],
    ct: tuple[3],
    expires
  }
}

/** Build one v2 shard object from reader entries. */
export function buildBulletinShard ({ blog, period, shard, rev, entries } = {}) {
  const owner = normalizeAccount(blog)
  const index = Math.trunc(Number(shard))
  const revision = Math.trunc(Number(rev))
  if (!isValidHiveAccountName(owner) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(period || ''))) return null
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(revision) || revision < 1) return null
  const tuples = (Array.isArray(entries) ? entries : [])
    .map(entry => Array.isArray(entry) && entry.length === 5 ? entry : compactShardEntry(entry))
    .filter(Boolean)
  return {
    v: BULLETIN_V2_VERSION,
    blog: owner,
    period,
    shard: index,
    rev: revision,
    entries: tuples
  }
}

/** SHA-256 of a shard object in the compact manifest form. */
export async function shardHash (shard) {
  return sha256Base64Url(canonicalJson(shard))
}

/**
 * Plan an incremental v2 shard update.
 *
 * Existing shards whose entry tuples are unchanged keep their revision, hash and
 * permlink. Changed or new shards get revision `previous + 1` (or 1) and a fresh
 * content hash. The caller publishes only `changed` shards plus the manifest.
 */
export async function planShardUpdates ({ blog, period, shardCount, entries, existingShards = [] } = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner) || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(period || ''))) {
    throw codedError('BULLETIN_BAD_BLOG', 'A valid blog and period are required for shards.')
  }
  const count = Math.trunc(Number(shardCount))
  if (!BULLETIN_SHARD_COUNTS.includes(count)) {
    throw codedError('BULLETIN_BAD_SHARDS', 'The shard count must be a power of two between 8 and 1024.')
  }
  const existingByIndex = new Map()
  for (const shard of Array.isArray(existingShards) ? existingShards : []) {
    if (shard && Number.isInteger(shard.index) && shard.index >= 0 && shard.index < count) {
      existingByIndex.set(shard.index, shard)
    }
  }

  const grouped = new Map()
  for (const entry of Array.isArray(entries) ? entries : []) {
    const rkt = Array.isArray(entry) ? expandRkt(entry[0]) : (entry && entry.rkt)
    const tuple = Array.isArray(entry) && entry.length === 5 ? entry : compactShardEntry(entry)
    if (!tuple || !rkt) throw codedError('BULLETIN_BAD_SHARDS', 'A compact shard entry could not be built.')
    const index = shardIndexForRkt(rkt, count)
    if (index < 0) throw codedError('BULLETIN_BAD_SHARDS', 'A reader key could not be assigned to a shard.')
    const list = grouped.get(index) || []
    list.push(tuple)
    grouped.set(index, list)
  }
  for (const list of grouped.values()) list.sort((left, right) => left[0].localeCompare(right[0]))

  const shards = []
  const descriptors = []
  for (let index = 0; index < count; index += 1) {
    const tuples = grouped.get(index) || []
    if (!tuples.length) continue
    const existing = existingByIndex.get(index)
    if (existing && Array.isArray(existing.entries) && canonicalJson(existing.entries) === canonicalJson(tuples)) {
      descriptors.push([index, existing.rev, existing.hash])
      shards.push({ ...existing, changed: false })
      continue
    }
    const rev = existing ? Number(existing.rev) + 1 : 1
    const shard = buildBulletinShard({
      blog: owner,
      period,
      shard: index,
      rev,
      entries: tuples
    })
    if (!shard) throw codedError('BULLETIN_BAD_SHARDS', 'A shard could not be built.')
    const hash = await shardHash(shard)
    const permlink = shardPermlink(period, index, rev)
    descriptors.push([index, rev, hash])
    shards.push({ index, rev, hash, permlink, entries: tuples, object: shard, changed: true })
  }
  return { shards, descriptors }
}

/** Parse `json_metadata.banksia_vault_shard` without inventing fields. */
export function parseShard (jsonMetadata) {
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
    const raw = isPlainObject(root.banksia_vault_shard) ? root.banksia_vault_shard : root
    if (!isPlainObject(raw) || raw.v !== BULLETIN_V2_VERSION) return null
    if (!isValidHiveAccountName(normalizeAccount(raw.blog))) return null
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(raw.period || ''))) return null
    if (!Number.isInteger(raw.shard) || raw.shard < 0) return null
    if (!Number.isInteger(raw.rev) || raw.rev < 1) return null
    if (!Array.isArray(raw.entries)) return null
    return raw
  } catch {
    return null
  }
}

function planProduct (plan) {
  if (!isPlainObject(plan)) return ''
  if (typeof plan.product === 'string' && plan.product.trim()) return plan.product.trim()
  if (isPlainObject(plan.product) && plan.product.author && plan.product.permlink) {
    return String(plan.product.author) + '/' + String(plan.product.permlink)
  }
  if (plan.author && plan.permlink) return String(plan.author) + '/' + String(plan.permlink)
  return ''
}

function planRecurrence (plan, payment) {
  const fromPlan = plan && (plan.recurrence !== undefined ? plan.recurrence : plan.recurrenceHours)
  if (Number.isFinite(Number(fromPlan)) && Number(fromPlan) > 0) return Number(fromPlan)
  const fromPayment = payment && (payment.recurrence || payment.recurrenceHours)
  return Number.isFinite(Number(fromPayment)) && Number(fromPayment) > 0 ? Number(fromPayment) : 0
}

function seenSet (value) {
  if (!value) return null
  if (typeof value.has === 'function') return value
  if (Array.isArray(value)) return new Set(value)
  return null
}

/**
 * Expiry of a grant derived from one verified payment.
 *
 * Recurring payments get the plan recurrence plus a 24-hour grace window so a
 * slightly late renewal does not lock a reader out. One-time payments get 31
 * days. Returns an ISO timestamp, or '' when the payment timestamp is invalid.
 */
export function grantExpiry (payment, plan, { now: _now = Date.now() } = {}) {
  if (!isPlainObject(payment)) return ''
  const time = timestampMs(payment.timestamp || payment.lastPayment)
  if (!time) return ''
  if (payment.type === 'transfer') return new Date(time + ONE_TIME_GRACE_MS).toISOString()
  const recurrence = planRecurrence(plan, payment)
  if (!recurrence) return ''
  return new Date(time + recurrence * 60 * 60 * 1000 + GRACE_MS).toISOString()
}

function rowFromPayment (payment, plan, now) {
  const last = timestampMs(payment.timestamp)
  const recurrence = planRecurrence(plan, payment)
  const oneTime = payment.type === 'transfer'
  const nextPayment = oneTime ? '' : nextPaymentDate(payment.timestamp, recurrence)
  const expires = grantExpiry(payment, plan, { now })
  const expiryMs = timestampMs(expires)
  return {
    account: payment.from,
    readerKey: payment.readerKey,
    sub: payment.sub,
    plan: payment.plan,
    amount: payment.amount,
    lastPayment: last ? new Date(last).toISOString() : '',
    nextPayment,
    expires,
    executionsRemaining: payment.remainingExecutions === null || payment.remainingExecutions === undefined
      ? (oneTime ? 0 : null)
      : payment.remainingExecutions,
    txid: payment.txid,
    active: Boolean(expiryMs) && expiryMs > now,
    giftFor: payment.giftFor || null
  }
}

/**
 * One row per reader key and payer account, newest payment wins.
 *
 * Older devices could share one reader key between two Hive accounts; keeping
 * both payer accounts visible means neither disappears from the dashboard. The
 * bulletin still wraps one entry per reader key. Gifts are not subscriber rows
 * (they are handled by claims), and a creator paying their own product is never
 * a subscriber. `seenTxIds` may carry transactions already granted elsewhere;
 * those payments are skipped.
 */
export function subscriberRows (history, plan, { now = Date.now(), seenTxIds = null } = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const seen = seenSet(seenTxIds)
  const author = normalizeAccount(plan && (plan.author || plan.recipient || plan.to))
  const result = collectVaultPayments(history, plan, { now: nowMs })
  const latest = new Map()

  for (const payment of result.payments) {
    if (!payment || payment.giftFor) continue
    if (author && normalizeAccount(payment.from) === author) continue
    if (seen && payment.txid && seen.has(payment.txid)) continue
    const key = payment.readerKey
      ? 'key:' + payment.readerKey + ':account:' + normalizeAccount(payment.from)
      : 'account:' + normalizeAccount(payment.from) + ':' + (payment.sub || '')
    const existing = latest.get(key)
    if (!existing || timestampMs(payment.timestamp) > timestampMs(existing.timestamp)) {
      latest.set(key, payment)
    }
  }

  const rows = []
  for (const payment of latest.values()) {
    if (!planProduct(plan)) continue
    rows.push(rowFromPayment(payment, plan, nowMs))
  }
  return rows.sort((a, b) => timestampMs(b.lastPayment) - timestampMs(a.lastPayment))
}

/**
 * Wrap the ring key for every reader.
 *
 * Each entry is bound to `{ blog, rkt, period, tier, expires }` by both the
 * HKDF info and the AES-GCM AAD, so it cannot be moved to another blog, period,
 * tier or expiry. The caller splits large lists across parts.
 */
export async function buildBulletinEntries ({
  blog,
  period,
  ringKey,
  readers,
  now: _now = Date.now(),
  tier = 'member',
  compact = false,
  existingEntries = []
} = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) throw codedError('BULLETIN_BAD_BLOG', 'A valid blog account is required.')
  if (typeof period !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) {
    throw codedError('BULLETIN_BAD_PERIOD', 'The period must be YYYY-MM with a real month.')
  }
  if (typeof ringKey !== 'string' || !ringKey) throw codedError('BULLETIN_BAD_RING_KEY', 'The ring key is missing.')
  const list = Array.isArray(readers) ? readers : []

  const existingByRkt = new Map()
  for (const entry of Array.isArray(existingEntries) ? existingEntries : []) {
    if (isPlainObject(entry) && typeof entry.rkt === 'string' && entry.rkt) {
      existingByRkt.set(entry.rkt, entry)
    }
  }
  const seen = new Set()
  const entries = []
  for (const reader of list) {
    if (!isPlainObject(reader)) continue
    const readerKey = typeof reader.readerKey === 'string' ? reader.readerKey.trim() : ''
    if (!P256_RE.test(readerKey) || seen.has(readerKey)) continue
    const expiresInput = reader.expires || reader.expiry
    const expiresDate = new Date(expiresInput)
    if (typeof expiresInput !== 'string' || !Number.isFinite(expiresDate.getTime())) {
      throw codedError('BULLETIN_BAD_EXPIRY', 'Every reader needs an expires timestamp before a grant can be wrapped.')
    }
    // Canonical milliseconds keep the v2 epoch tuple reversible. Readers rebuild
    // the grant header from `expires`, so the writer and reader strings must be
    // identical, not merely the same instant.
    const expires = expiresDate.toISOString()
    seen.add(readerKey)
    const rkt = await readerKeyThumbprint(readerKey)
    const existing = existingByRkt.get(rkt)
    if (existing && Number.isFinite(Date.parse(existing.expires)) &&
      Date.parse(existing.expires) === Date.parse(expiresInput) &&
      typeof existing.epk === 'string' && typeof existing.iv === 'string' && typeof existing.ct === 'string') {
      // Reuse the wrapped ring key when neither the reader key nor the expiry
      // instant changed. This is what makes incremental shard digests stable.
      const reused = {
        rkt,
        epk: existing.epk,
        iv: existing.iv,
        ct: existing.ct,
        expires: existing.expires
      }
      if (!compact) reused.alg = existing.alg || VAULT_WRAP_ALG
      if (!compact || tier !== 'member') reused.tier = existing.tier || tier
      entries.push(reused)
      continue
    }
    const header = buildGrantHeader({ rkt, tier, expires }, { blog: owner, period, tier })
    const wrapped = await wrapRingKey(ringKey, readerKey, header)
    const entry = {
      rkt,
      epk: wrapped.epk,
      iv: wrapped.iv,
      ct: wrapped.ct,
      expires
    }
    // Compact entries omit fields whose v1 defaults are unambiguous. Readers
    // already default `alg` to the wrap construction and `tier` to `member`.
    if (!compact) entry.alg = VAULT_WRAP_ALG
    if (!compact || tier !== 'member') entry.tier = tier
    entries.push(entry)
  }
  return entries
}

/**
 * Build and sign a bulletin. The keyring is sealed once with the ring key; the
 * signature covers the keyring blob hash and every wrapped entry.
 */
export async function buildVaultBulletin ({
  blog,
  period,
  seq,
  keyring,
  ringKey,
  entries,
  signer,
  issued,
  delegation = null,
  signAdapter
} = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) throw codedError('BULLETIN_BAD_BLOG', 'A valid blog account is required.')
  if (!Number.isInteger(Number(seq)) || Number(seq) < 1) {
    throw codedError('BULLETIN_BAD_SEQ', 'The bulletin sequence must be a positive integer.')
  }
  if (!isPlainObject(keyring)) throw codedError('BULLETIN_BAD_KEYRING', 'The keyring must be an object.')
  const signingAccount = normalizeAccount(signer || owner)
  if (!isValidHiveAccountName(signingAccount)) throw codedError('BULLETIN_BAD_SIGNER', 'The bulletin signer is invalid.')

  const sealed = await sealKeyring(keyring, ringKey, { blog: owner, period })
  const bulletin = {
    v: 1,
    blog: owner,
    period,
    seq: Number(seq),
    issued: issued || new Date().toISOString(),
    keyring: sealed,
    entries: Array.isArray(entries) ? entries : [],
    claims: [],
    signer: signingAccount,
    delegation: delegation || null
  }
  return signGrant(bulletin, signAdapter)
}

/**
 * Build a signed bulletin bundle, splitting entries across part comments when
 * the single-comment budget would be exceeded.
 *
 * The manifest is signed and contains the sealed keyring plus a hash of every
 * part object. Parts are ordinary comments under the container and contain only
 * entries; the signature on the manifest binds them by hash.
 */
export async function buildVaultBulletinBundle ({
  blog,
  period,
  seq,
  keyring,
  ringKey,
  entries,
  signer,
  issued,
  delegation = null,
  signAdapter,
  maxEntries = BULLETIN_MAX_ENTRIES,
  maxBytes = BULLETIN_MAX_BYTES,
  compact = false,
  ringId = ''
} = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) throw codedError('BULLETIN_BAD_BLOG', 'A valid blog account is required.')
  if (!Number.isInteger(Number(seq)) || Number(seq) < 1) {
    throw codedError('BULLETIN_BAD_SEQ', 'The bulletin sequence must be a positive integer.')
  }
  if (!isPlainObject(keyring)) throw codedError('BULLETIN_BAD_KEYRING', 'The keyring must be an object.')
  const signingAccount = normalizeAccount(signer || owner)
  if (!isValidHiveAccountName(signingAccount)) throw codedError('BULLETIN_BAD_SIGNER', 'The bulletin signer is invalid.')
  const list = Array.isArray(entries) ? entries : []
  const sealedFull = await sealKeyring(keyring, ringKey, { blog: owner, period })
  const sealed = compact ? { iv: sealedFull.iv, ct: sealedFull.ct } : sealedFull
  const body = compact
    ? {
        v: 1,
        blog: owner,
        period,
        seq: Number(seq),
        issued: issued || new Date().toISOString(),
        keyring: sealed,
        signer: signingAccount,
        ...(ringId ? { ringId: String(ringId) } : {}),
        ...(delegation ? { delegation } : {})
      }
    : {
        v: 1,
        blog: owner,
        period,
        seq: Number(seq),
        issued: issued || new Date().toISOString(),
        keyring: sealed,
        claims: [],
        signer: signingAccount,
        ...(ringId ? { ringId: String(ringId) } : {}),
        delegation: delegation || null
      }

  // Split by both entry count and encoded part size.
  const chunks = []
  let current = []
  for (const entry of list) {
    const candidate = [...current, entry]
    const wrapper = { app: 'banksia.io', banksia_vault_bulletin_part: {
      v: 1, blog: owner, period, seq: Number(seq), part: chunks.length + 1,
      parts: 0, entries: candidate
    } }
    const tooMany = candidate.length > maxEntries
    const tooBig = byteLength(wrapper) > maxBytes
    if (current.length && (tooMany || tooBig)) {
      chunks.push(current)
      current = [entry]
    } else {
      current = candidate
    }
  }
  if (current.length) chunks.push(current)
  if (!chunks.length) chunks.push([])

  const singleWrapper = { app: 'banksia.io', banksia_vault_bulletin: { ...body, entries: list } }
  if (chunks.length === 1 && list.length <= maxEntries && byteLength(singleWrapper) <= maxBytes) {
    const bulletin = await signGrant({ ...body, entries: list }, signAdapter)
    return { bulletin, parts: [] }
  }

  const parts = []
  for (let index = 0; index < chunks.length; index++) {
    const part = {
      v: 1,
      blog: owner,
      period,
      seq: Number(seq),
      part: index + 1,
      parts: chunks.length,
      entries: chunks[index]
    }
    parts.push({
      permlink: bulletinPermlink(period, Number(seq), index + 1),
      hash: 'sha256:' + await sha256Hex(canonicalJson(part)),
      entries: chunks[index].length,
      part
    })
  }

  const manifest = await signGrant({
    ...body,
    entries: [],
    parts: parts.map(({ permlink, hash, entries: count }) =>
      compact ? { permlink, hash } : { permlink, hash, entries: count }
    )
  }, signAdapter)
  return { bulletin: manifest, parts }
}

/**
 * Sign a v2 sharded manifest. Shard comments are built separately from
 * `buildBulletinShard` / `buildVaultShardOperation`; their content hashes go in
 * `shards` as compact `[index, rev, hash]` descriptors.
 */
export async function buildVaultShardedBulletin ({
  blog,
  period,
  seq,
  keyring,
  ringKey,
  shardCount,
  shards,
  signer,
  issued,
  delegation = null,
  signAdapter,
  compact = true,
  ringId = ''
} = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) throw codedError('BULLETIN_BAD_BLOG', 'A valid blog account is required.')
  if (!Number.isInteger(Number(seq)) || Number(seq) < 1) {
    throw codedError('BULLETIN_BAD_SEQ', 'The bulletin sequence must be a positive integer.')
  }
  if (!isPlainObject(keyring)) throw codedError('BULLETIN_BAD_KEYRING', 'The keyring must be an object.')
  const count = Math.trunc(Number(shardCount))
  if (!BULLETIN_SHARD_COUNTS.includes(count)) {
    throw codedError('BULLETIN_BAD_SHARDS', 'The shard count must be a power of two between 8 and 1024.')
  }
  const signingAccount = normalizeAccount(signer || owner)
  if (!isValidHiveAccountName(signingAccount)) throw codedError('BULLETIN_BAD_SIGNER', 'The bulletin signer is invalid.')
  const descriptors = (Array.isArray(shards) ? shards : []).map(descriptor => {
    if (!Array.isArray(descriptor) || descriptor.length < 3) {
      throw codedError('BULLETIN_BAD_SHARDS', 'Every shard descriptor needs an index, revision and hash.')
    }
    const index = Math.trunc(Number(descriptor[0]))
    const rev = Math.trunc(Number(descriptor[1]))
    const hash = String(descriptor[2] || '')
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw codedError('BULLETIN_BAD_SHARDS', 'A shard index is outside the shard count.')
    }
    if (!Number.isInteger(rev) || rev < 1 || !/^[A-Za-z0-9_-]{43}$/.test(hash)) {
      throw codedError('BULLETIN_BAD_SHARDS', 'A shard revision or hash is invalid.')
    }
    return [index, rev, hash]
  })
  const sealedFull = await sealKeyring(keyring, ringKey, { blog: owner, period })
  const sealed = compact ? { iv: sealedFull.iv, ct: sealedFull.ct } : sealedFull
  const body = {
    v: BULLETIN_V2_VERSION,
    blog: owner,
    period,
    seq: Number(seq),
    issued: issued || new Date().toISOString(),
    keyring: sealed,
    shardCount: count,
    shards: descriptors,
    signer: signingAccount,
    ...(ringId ? { ringId: String(ringId) } : {}),
    ...(delegation ? { delegation } : {})
  }
  return signGrant(body, signAdapter)
}

/** `comment` operation for one bulletin part (manifest holds its hash). */
export function buildVaultBulletinPartOperation ({ part, author, containerAuthor, containerPermlink } = {}) {
  if (!isPlainObject(part)) return null
  const owner = normalizeAccount(author || part.blog)
  const container = String(containerPermlink || '').trim().toLowerCase()
  if (!isValidHiveAccountName(owner) || !/^[a-z0-9][a-z0-9._-]{0,255}$/.test(container)) return null
  const seq = Number(part.seq)
  const number = Number(part.part)
  if (!Number.isInteger(seq) || seq < 1 || !Number.isInteger(number) || number < 1) return null
  return ['comment', {
    parent_author: normalizeAccount(containerAuthor || owner),
    parent_permlink: container,
    author: owner,
    permlink: bulletinPermlink(part.period, seq, number),
    title: '',
    body: 'Vault grant bulletin part.',
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      banksia_vault_bulletin_part: part
    })
  }]
}

/** `comment` operation for one v2 grant shard. */
export function buildVaultShardOperation ({ shard, author, containerAuthor, containerPermlink } = {}) {
  if (!isPlainObject(shard)) return null
  const owner = normalizeAccount(author || shard.blog)
  const container = String(containerPermlink || '').trim().toLowerCase()
  const permlink = shardPermlink(shard.period, shard.shard, shard.rev)
  if (!isValidHiveAccountName(owner) || !/^[a-z0-9][a-z0-9._-]{0,255}$/.test(container) || !permlink) return null
  return ['comment', {
    parent_author: normalizeAccount(containerAuthor || owner),
    parent_permlink: container,
    author: owner,
    permlink,
    title: '',
    body: 'Vault grant shard.',
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      banksia_vault_shard: shard
    })
  }]
}

/** `comment` operation that publishes a bulletin under the hidden container. */
export function buildVaultBulletinOperation ({ bulletin, containerAuthor, containerPermlink } = {}) {
  if (!isPlainObject(bulletin)) return null
  const author = normalizeAccount(containerAuthor || bulletin.blog)
  const parent = String(containerPermlink || '').trim().toLowerCase()
  if (!isValidHiveAccountName(author) || !/^[a-z0-9][a-z0-9._-]{0,255}$/.test(parent)) return null
  if (typeof bulletin.period !== 'string' || !/^\d{4}-\d{2}$/.test(bulletin.period)) return null
  const seq = Number(bulletin.seq)
  if (!Number.isInteger(seq) || seq < 1) return null
  const permlink = bulletinPermlink(bulletin.period, seq)
  return ['comment', {
    parent_author: author,
    parent_permlink: parent,
    author: normalizeAccount(bulletin.signer || bulletin.blog),
    permlink,
    title: '',
    body: 'Vault grant bulletin.',
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      banksia_vault_bulletin: bulletin
    })
  }]
}

function replyBulletin (reply) {
  if (!isPlainObject(reply)) return null
  const metadata = reply.json_metadata !== undefined ? reply.json_metadata : reply
  return parseBulletin(metadata)
}

/**
 * Newest bulletin in a `get_content_replies` list: highest period, then highest
 * sequence. Returns null when no reply carries a valid bulletin.
 */
export function bulletinFromReplies (replies) {
  let best = null
  for (const reply of Array.isArray(replies) ? replies : []) {
    const bulletin = replyBulletin(reply)
    if (!bulletin) continue
    if (!best) {
      best = bulletin
      continue
    }
    if (bulletin.period > best.period) {
      best = bulletin
    } else if (bulletin.period === best.period && bulletin.seq > best.seq) {
      best = bulletin
    }
  }
  return best
}

/** Next sequence for a period (`nextBulletinSequence` re-export with replies). */
export function nextSeq (replies, period) {
  return nextBulletinSequence(replies, period)
}

/** UTF-8 byte length of the full comment metadata object. */
export function bulletinSize (bulletin) {
  return byteLength({ app: 'banksia.io', banksia_vault_bulletin: bulletin })
}

/**
 * Size policy for a single bulletin. Above 60 KB it must be split; above 250
 * entries the dashboard warns before the hard 300-entry cap.
 */
export function isBulletinTooLarge (bulletin, max = BULLETIN_MAX_BYTES) {
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : BULLETIN_MAX_BYTES
  const bytes = bulletinSize(bulletin)
  const entries = isPlainObject(bulletin) && Array.isArray(bulletin.entries) ? bulletin.entries.length : 0
  const tooLarge = bytes > limit
  let reason = ''
  if (tooLarge) {
    reason = 'The bulletin is ' + bytes + ' bytes; the limit is ' + limit + '. Split it into parts before publishing.'
  } else if (entries > BULLETIN_WARN_ENTRIES) {
    reason = 'This bulletin has ' + entries + ' entries. Over ' + BULLETIN_WARN_ENTRIES + ' entries, plan a split into parts.'
  }
  return { tooLarge, bytes, reason }
}

/**
 * Reader key registry schema (`banksia.vault.reader_key`, post-MVP).
 *
 * Returns null when the blog account is invalid. Malformed key entries are
 * dropped rather than published.
 */
export function buildReaderRegistry ({ blog, keys = [], revoked = [] } = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) return null
  const normalizedKeys = []
  for (const entry of Array.isArray(keys) ? keys : []) {
    const key = typeof entry === 'string' ? entry.trim() : (isPlainObject(entry) ? String(entry.key || '').trim() : '')
    if (!P256_RE.test(key)) continue
    const label = isPlainObject(entry) && typeof entry.label === 'string'
      ? entry.label.trim().slice(0, 64)
      : ''
    const created = isPlainObject(entry) && typeof entry.created === 'string' && Number.isFinite(Date.parse(entry.created))
      ? entry.created
      : new Date().toISOString()
    normalizedKeys.push({ key, label, created })
  }
  const revokedKeys = (Array.isArray(revoked) ? revoked : [])
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
  return {
    v: 1,
    blog: owner,
    keys: normalizedKeys,
    revoked: [...new Set(revokedKeys)]
  }
}

/** `custom_json` operation for the reader key registry. Posting authority. */
export function readerRegistryOperation ({ account, registry } = {}) {
  const owner = normalizeAccount(account)
  if (!isValidHiveAccountName(owner) || !isPlainObject(registry)) return null
  return ['custom_json', {
    required_auths: [],
    required_posting_auths: [owner],
    id: READER_REGISTRY_ID,
    json: JSON.stringify(registry)
  }]
}

/**
 * True when a subscriber needs a new wrapped entry: no entry for their reader
 * key, or the existing entry expires within a day.
 */
export async function pendingGrants ({ bulletin, subscriber, now = Date.now() } = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const entries = isPlainObject(bulletin) && Array.isArray(bulletin.entries) ? bulletin.entries : []
  let rkt = isPlainObject(subscriber) && typeof subscriber.rkt === 'string' ? subscriber.rkt : ''
  if (!rkt && isPlainObject(subscriber) && typeof subscriber.readerKey === 'string' && subscriber.readerKey) {
    try {
      rkt = await readerKeyThumbprint(subscriber.readerKey)
    } catch {
      return true
    }
  }
  if (!rkt) return true
  const entry = entries.find(item => isPlainObject(item) && item.rkt === rkt)
  if (!entry) return true
  const expires = timestampMs(entry.expires)
  return !expires || expires <= nowMs + PENDING_WINDOW_MS
}

