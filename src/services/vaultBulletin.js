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

import { VAULT_WRAP_ALG, readerKeyThumbprint, sealKeyring, wrapRingKey } from './vaultCrypto'
import { buildGrantHeader, bulletinPermlink, nextBulletinSequence, parseBulletin, signGrant } from './vaultGrant'
import {
  collectVaultPayments,
  nextPaymentDate
} from './vaultPayments'
import { isValidHiveAccountName } from './blogHost'

export const BULLETIN_MAX_ENTRIES = 300
export const BULLETIN_WARN_ENTRIES = 250
export const BULLETIN_MAX_BYTES = 60000
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
 * One row per reader key, newest payment wins.
 *
 * Gifts are not subscriber rows (they are handled by claims), and a creator
 * paying their own product is never a subscriber. `seenTxIds` may carry
 * transactions already granted elsewhere; those payments are skipped.
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
      ? 'key:' + payment.readerKey
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
 * tier or expiry. Throws above `BULLETIN_MAX_ENTRIES`; split into parts first.
 */
export async function buildBulletinEntries ({ blog, period, ringKey, readers, now: _now = Date.now(), tier = 'member' } = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) throw codedError('BULLETIN_BAD_BLOG', 'A valid blog account is required.')
  if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) {
    throw codedError('BULLETIN_BAD_PERIOD', 'The period must be YYYY-MM.')
  }
  if (typeof ringKey !== 'string' || !ringKey) throw codedError('BULLETIN_BAD_RING_KEY', 'The ring key is missing.')
  const list = Array.isArray(readers) ? readers : []
  if (list.length > BULLETIN_MAX_ENTRIES) {
    throw codedError('BULLETIN_TOO_MANY_ENTRIES', 'A single bulletin supports at most ' + BULLETIN_MAX_ENTRIES + ' entries; split it into parts.')
  }

  const seen = new Set()
  const entries = []
  for (const reader of list) {
    if (!isPlainObject(reader)) continue
    const readerKey = typeof reader.readerKey === 'string' ? reader.readerKey.trim() : ''
    if (!P256_RE.test(readerKey) || seen.has(readerKey)) continue
    const expires = reader.expires || reader.expiry
    if (typeof expires !== 'string' || !Number.isFinite(Date.parse(expires))) {
      throw codedError('BULLETIN_BAD_EXPIRY', 'Every reader needs an expires timestamp before a grant can be wrapped.')
    }
    seen.add(readerKey)
    const rkt = await readerKeyThumbprint(readerKey)
    const header = buildGrantHeader({ rkt, tier, expires }, { blog: owner, period, tier })
    const wrapped = await wrapRingKey(ringKey, readerKey, header)
    entries.push({
      rkt,
      alg: VAULT_WRAP_ALG,
      epk: wrapped.epk,
      iv: wrapped.iv,
      ct: wrapped.ct,
      tier,
      expires
    })
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

