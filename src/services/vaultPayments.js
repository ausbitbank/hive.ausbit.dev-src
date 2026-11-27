// Payment helpers for Banksia Vault memberships.
//
// A membership is a normal Hive Open Market purchase: `recurrent_transfer` for
// the monthly plan, `transfer` for one month or a gift, and a zero-amount
// `recurrent_transfer` to cancel. The HOM memo is extended with a namespaced
// `banksia` object carrying the reader's P-256 public key, a subscription id and
// an optional gift recipient.
//
// Everything here is pure and defensive. Amounts are chain strings and are
// compared exactly; verification never throws and never trusts blog settings
// for the price — the caller passes a plan derived from the HOM product post.

import { VAULT_DEFAULT_EXECUTIONS, VAULT_DEFAULT_RECURRENCE } from '../config/blog'
import { isValidHiveAccountName } from './blogHost'
import { parseProductRef, productKey } from './shopOrders'
import { formatVaultPrice } from './vaultSettings'

const AMOUNT_RE = /^(\d+\.\d{3}) (HBD|HIVE)$/
const READER_KEY_RE = /^p256:[A-Za-z0-9_-]{40,120}$/
const SUB_RE = /^[A-Za-z0-9_-]{16,64}$/
const PLAN_RE = /^[a-z][a-z0-9_-]{0,31}$/
const MEMO_MAX_BYTES = 2048
const RECURRENCE_MIN = 24
const RECURRENCE_MAX = 8760
const EXECUTIONS_MIN = 2
const EXECUTIONS_MAX = 120
const TRANSFER_WINDOW_MS = 40 * 24 * 60 * 60 * 1000
const FUTURE_SKEW_MS = 5 * 60 * 1000
const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// The exact HF28 rule that matches a zero-amount recurrent_transfer to an
// existing pair has not been verified in this repository. The note is attached
// non-enumerably so JSON.stringify and broadcasting never see it.
export const VAULT_CANCEL_MATCHING = Object.freeze({
  rule: 'hf28',
  tested: false,
  note: 'Test the exact HF28 matching rule on Hive testnet before shipping the cancel button: with multiple recurrent transfers to the same recipient, matching by recipient, amount, memo and recurrence must be confirmed.'
})

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
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

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

function cleanPlan (value) {
  if (typeof value !== 'string') return 'member'
  const plan = value.trim().toLowerCase()
  return PLAN_RE.test(plan) ? plan : 'member'
}

function cleanRecurrence (value) {
  const hours = Number(value)
  if (!Number.isInteger(hours) || hours < RECURRENCE_MIN || hours > RECURRENCE_MAX) return null
  return hours
}

function cleanExecutions (value) {
  const count = Number(value)
  if (!Number.isInteger(count) || count < EXECUTIONS_MIN || count > EXECUTIONS_MAX) return null
  return count
}

function validMemo (memo) {
  return typeof memo === 'string' && memo.trim().length > 0 && byteLength(memo) <= MEMO_MAX_BYTES
}

/** Parse a chain amount such as `"5.000 HBD"` without changing its value. */
export function parseVaultAmount (value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const match = text.match(AMOUNT_RE)
  if (!match) return null
  const amount = match[1]
  const currency = match[2]
  return {
    value: amount,
    currency,
    label: amount + ' ' + currency,
    number: Number(amount)
  }
}

/**
 * Build the HOM memo plus the Banksia reader-key extension.
 *
 * @returns {string|null} null for an invalid product, reader key, sub or gift.
 */
export function buildVaultMemo ({ product, plan = 'member', readerKey, sub, giftFor = null } = {}) {
  const ref = parseProductRef(product)
  if (!ref) return null
  const key = typeof readerKey === 'string' ? readerKey.trim() : ''
  if (!READER_KEY_RE.test(key)) return null
  const subId = typeof sub === 'string' ? sub.trim() : ''
  if (!SUB_RE.test(subId)) return null
  let gift = null
  if (giftFor !== null && giftFor !== undefined && giftFor !== '') {
    const name = normalizeAccount(giftFor)
    if (!isValidHiveAccountName(name)) return null
    gift = name
  }
  const memo = JSON.stringify({
    product: ref.author + '/' + ref.permlink,
    quantity: 1,
    banksia: {
      v: 1,
      plan: cleanPlan(plan),
      reader_key: key,
      sub: subId,
      gift_for: gift
    }
  })
  return byteLength(memo) <= MEMO_MAX_BYTES ? memo : null
}

/**
 * Parse a Vault purchase memo. Unknown sibling keys are ignored; a bad product,
 * quantity, version, reader key or sub rejects the memo.
 */
export function parseVaultMemo (memo) {
  if (typeof memo !== 'string' || !memo.trim()) return null
  let parsed
  try {
    parsed = JSON.parse(memo)
  } catch {
    return null
  }
  if (!isPlainObject(parsed)) return null
  const product = parseProductRef(parsed.product)
  if (!product) return null
  const quantity = parsed.quantity
  if (!Number.isInteger(quantity) || quantity < 1) return null
  const banksia = parsed.banksia
  if (!isPlainObject(banksia)) return null
  if (banksia.v !== 1) return null
  if (typeof banksia.plan !== 'string' || !PLAN_RE.test(banksia.plan.trim().toLowerCase())) return null
  const readerKey = typeof banksia.reader_key === 'string' ? banksia.reader_key.trim() : ''
  if (!READER_KEY_RE.test(readerKey)) return null
  const sub = typeof banksia.sub === 'string' ? banksia.sub.trim() : ''
  if (!SUB_RE.test(sub)) return null
  let giftFor = null
  if (banksia.gift_for !== undefined && banksia.gift_for !== null && banksia.gift_for !== '') {
    const name = normalizeAccount(banksia.gift_for)
    if (!isValidHiveAccountName(name)) return null
    giftFor = name
  }
  return {
    product,
    quantity,
    banksia: {
      v: 1,
      plan: banksia.plan.trim().toLowerCase(),
      reader_key: readerKey,
      sub,
      gift_for: giftFor
    }
  }
}

function transferParties (from, to) {
  const sender = normalizeAccount(from)
  const recipient = normalizeAccount(to)
  if (!isValidHiveAccountName(sender) || !isValidHiveAccountName(recipient)) return null
  return { sender, recipient }
}

/** Exact `recurrent_transfer` for a monthly membership. */
export function buildRecurrentTransferOperation ({
  from,
  to,
  amount,
  recurrence = VAULT_DEFAULT_RECURRENCE,
  executions = VAULT_DEFAULT_EXECUTIONS,
  memo
} = {}) {
  const parties = transferParties(from, to)
  if (!parties) return null
  const parsed = parseVaultAmount(amount)
  if (!parsed || parsed.number <= 0) return null
  const hours = cleanRecurrence(recurrence)
  const count = cleanExecutions(executions)
  if (hours === null || count === null) return null
  if (!validMemo(memo)) return null
  return ['recurrent_transfer', {
    from: parties.sender,
    to: parties.recipient,
    amount: parsed.label,
    memo,
    recurrence: hours,
    executions: count,
    extensions: []
  }]
}

/** Exact `transfer` for one month, or a one-off gift. */
export function buildOneTimeTransferOperation ({ from, to, amount, memo } = {}) {
  const parties = transferParties(from, to)
  if (!parties) return null
  const parsed = parseVaultAmount(amount)
  if (!parsed || parsed.number <= 0) return null
  if (!validMemo(memo)) return null
  return ['transfer', {
    from: parties.sender,
    to: parties.recipient,
    amount: parsed.label,
    memo
  }]
}

/**
 * Exact zero-amount `recurrent_transfer` that cancels a membership.
 *
 * HF28 allows multiple recurrent transfers to the same recipient, so the chain
 * must reconstruct the pair being cancelled. The returned op carries a
 * non-enumerable `matching` note; verify the rule on testnet before shipping.
 *
 * @returns {[string, object]|null}
 */
export function buildCancelOperation ({
  from,
  to,
  amount = '0.000 HBD',
  recurrence = VAULT_DEFAULT_RECURRENCE,
  executions = 2,
  memo
} = {}) {
  const parties = transferParties(from, to)
  if (!parties) return null
  const parsed = parseVaultAmount(amount)
  if (!parsed || parsed.number !== 0) return null
  const hours = cleanRecurrence(recurrence)
  const count = cleanExecutions(executions)
  if (hours === null || count === null) return null
  if (!validMemo(memo)) return null
  const operation = ['recurrent_transfer', {
    from: parties.sender,
    to: parties.recipient,
    amount: parsed.label,
    memo,
    recurrence: hours,
    executions: count,
    extensions: []
  }]
  Object.defineProperty(operation, 'matching', {
    value: { ...VAULT_CANCEL_MATCHING },
    enumerable: false
  })
  return operation
}

function paymentRecord (input, options) {
  // get_account_history row: [index, { op: [name, data], timestamp, trx_id }]
  if (Array.isArray(input) && input.length >= 2 && isPlainObject(input[1]) && Array.isArray(input[1].op)) {
    const record = input[1]
    return { op: record.op, timestamp: record.timestamp, trxid: record.trx_id || record.trxId || '' }
  }
  // Raw op tuple: [name, data]. Timestamp/txid come from the caller.
  if (Array.isArray(input) && typeof input[0] === 'string' && isPlainObject(input[1])) {
    return {
      op: input,
      timestamp: options.timestamp || '',
      trxid: options.trx_id || options.txid || ''
    }
  }
  // Envelope: { op: [name, data], timestamp, trx_id }
  if (isPlainObject(input) && Array.isArray(input.op) && input.op.length >= 2) {
    return {
      op: input.op,
      timestamp: input.timestamp,
      trxid: input.trx_id || input.trxId || ''
    }
  }
  // Raw op data with an explicit name: { op_name, data, timestamp, trx_id }
  if (isPlainObject(input) && typeof input.op_name === 'string' && isPlainObject(input.data)) {
    return {
      op: [input.op_name, input.data],
      timestamp: input.timestamp,
      trxid: input.trx_id || input.trxId || ''
    }
  }
  return null
}

function planProductRef (plan) {
  if (typeof plan.product === 'string') return parseProductRef(plan.product)
  if (isPlainObject(plan.product) && plan.product.author && plan.product.permlink) {
    return parseProductRef(String(plan.product.author) + '/' + String(plan.product.permlink))
  }
  if (plan.author && plan.permlink) {
    return parseProductRef(String(plan.author) + '/' + String(plan.permlink))
  }
  return null
}

function planDetails (plan) {
  if (!isPlainObject(plan)) return null
  if (plan.currency !== undefined && String(plan.currency).toUpperCase() !== 'HBD') return null
  const author = normalizeAccount(plan.author || plan.recipient || plan.to)
  if (!isValidHiveAccountName(author)) return null
  const product = planProductRef(plan)
  if (!product) return null
  const amountLabel = plan.priceLabel || plan.amount ||
    (plan.price !== undefined ? formatVaultPrice(plan.price) : null)
  const amount = parseVaultAmount(amountLabel)
  if (!amount || amount.number <= 0 || amount.currency !== 'HBD') return null
  const recurrence = cleanRecurrence(plan.recurrence === undefined ? plan.recurrenceHours : plan.recurrence)
  if (recurrence === null) return null
  return { author, product, productKey: productKey(product), amount, recurrence }
}

function optionProductKey (product) {
  if (!product) return { key: '', amount: null }
  const ref = typeof product === 'string'
    ? parseProductRef(product)
    : isPlainObject(product)
        ? parseProductRef(product.product) ||
          (product.author && product.permlink
            ? parseProductRef(product.author + '/' + product.permlink)
            : null)
        : null
  let amount = null
  if (isPlainObject(product)) {
    amount = parseVaultAmount(product.priceLabel) ||
      parseVaultAmount(product.amount) ||
      parseVaultAmount(product.price === undefined ? '' : formatVaultPrice(product.price))
  }
  return { key: ref ? productKey(ref) : '', amount }
}

function seenTxid (seenTxIds, txid) {
  if (!txid || !seenTxIds) return false
  if (typeof seenTxIds.has === 'function') return seenTxIds.has(txid)
  if (Array.isArray(seenTxIds)) return seenTxIds.includes(txid)
  return false
}

function emptyResult (record) {
  return {
    ok: false,
    reason: '',
    code: '',
    readerKey: '',
    sub: '',
    amount: '',
    amountNumber: null,
    txid: record ? record.trxid || '' : '',
    timestamp: record ? record.timestamp || '' : '',
    plan: '',
    giftFor: null,
    from: '',
    to: '',
    type: record && record.op ? String(record.op[0] || '') : '',
    recurrence: 0,
    remainingExecutions: null
  }
}

/**
 * Verify one chain payment against a plan derived from the HOM product post.
 *
 * Accepts a raw op tuple, an `{ op, timestamp, trx_id }` envelope, or a
 * `get_account_history` row. Never throws.
 *
 * @param {unknown} rowOrOp
 * @param {object} plan { author, product, priceLabel|amount, recurrence }
 * @param {{ now?: number, seenTxIds?: Set<string>|string[]|null, product?: unknown,
 *   timestamp?: string, trx_id?: string, txid?: string }} [options]
 * @returns {object}
 */
export function verifyVaultPayment (rowOrOp, plan, options = {}) {
  const opts = isPlainObject(options) ? options : {}
  const now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now()
  let record = null
  const failed = (code, reason) => ({ ...emptyResult(record), code, reason })

  try {
    record = paymentRecord(rowOrOp, opts)
    if (!record) {
      return { ...emptyResult(null), code: 'malformed', reason: 'Payment must be an operation, an op envelope or an account-history row' }
    }
    const [name, body] = record.op
    if (name === 'recurrent_transfer') {
      const amount = isPlainObject(body) ? parseVaultAmount(body.amount) : null
      return {
        ...emptyResult(record),
        code: 'not-payment',
        reason: amount && amount.number === 0
          ? 'A zero-amount recurrent_transfer is a cancellation, not a payment'
          : 'An open recurrent_transfer is a plan, not a payment; wait for fill_recurrent_transfer'
      }
    }
    if (name !== 'transfer' && name !== 'fill_recurrent_transfer') {
      return failed('unsupported', 'Only transfer and fill_recurrent_transfer are payments (' + String(name) + ')')
    }
    if (!isPlainObject(body)) return failed('malformed', 'Payment operation data must be an object')

    const details = planDetails(plan)
    if (!details) return failed('plan', 'Plan needs a valid author, HBD amount, product reference and recurrence')

    const from = normalizeAccount(body.from)
    const to = normalizeAccount(body.to)
    if (!isValidHiveAccountName(from)) return failed('from', 'Payment sender must be a valid Hive account')
    if (to !== details.author) {
      return failed('recipient', 'Payment recipient @' + (to || '?') + ' does not match @' + details.author)
    }

    const amount = parseVaultAmount(body.amount)
    if (!amount) return failed('amount', 'Payment amount must look like "5.000 HBD"')
    if (amount.currency !== 'HBD') return failed('amount', 'Vault memberships are paid in HBD')
    if (amount.label !== details.amount.label) {
      return failed('amount', 'Payment amount ' + amount.label + ' does not match the plan ' + details.amount.label)
    }

    const memo = parseVaultMemo(body.memo)
    if (!memo) return failed('memo', 'Payment memo is not a valid Vault purchase memo')
    if (productKey(memo.product) !== details.productKey) {
      return failed('product', 'Memo product does not match the plan product')
    }

    const expected = optionProductKey(opts.product)
    if (opts.product) {
      if (!expected.key) return failed('product', 'Expected product reference is invalid')
      if (expected.key !== details.productKey) {
        return failed('product', 'Plan product does not match the expected product')
      }
      if (expected.amount && expected.amount.label !== amount.label) {
        return failed('amount', 'Payment amount ' + amount.label + ' does not match the chain product price ' + expected.amount.label)
      }
    }

    if (seenTxid(opts.seenTxIds, record.trxid)) {
      return failed('duplicate', 'This transaction has already been used for a grant')
    }

    const time = timestampMs(record.timestamp)
    if (!time) return failed('timestamp', 'Payment timestamp is missing or invalid')
    if (time - now > FUTURE_SKEW_MS) return failed('future', 'Payment timestamp is in the future')
    if (name === 'transfer' && now - time > TRANSFER_WINDOW_MS) {
      return failed('expired', 'One-time payment is older than the 40-day grant window')
    }

    let remaining = null
    if (name === 'fill_recurrent_transfer') {
      remaining = Number(body.remaining_executions)
      if (!Number.isFinite(remaining) || remaining < 0) {
        return failed('recurrence', 'fill_recurrent_transfer needs remaining_executions >= 0')
      }
      remaining = Math.trunc(remaining)
    }

    return {
      ok: true,
      reason: '',
      code: 'ok',
      readerKey: memo.banksia.reader_key,
      sub: memo.banksia.sub,
      amount: amount.label,
      amountNumber: amount.number,
      txid: record.trxid || '',
      timestamp: String(record.timestamp),
      plan: memo.banksia.plan,
      giftFor: memo.banksia.gift_for,
      from,
      to,
      type: name,
      recurrence: details.recurrence,
      remainingExecutions: remaining
    }
  } catch {
    return { ...emptyResult(record), code: 'error', reason: 'Payment could not be verified' }
  }
}

/** First day of the UTC month for a date, as `YYYY-MM`; '' when invalid. */
export function periodFor (date) {
  const time = date instanceof Date
    ? date.getTime()
    : typeof date === 'number'
        ? date
        : timestampMs(date)
  return Number.isFinite(time) && time ? new Date(time).toISOString().slice(0, 7) : ''
}

/** ISO timestamp `recurrenceHours` after a chain timestamp; '' when invalid. */
export function nextPaymentDate (timestamp, recurrenceHours) {
  const time = timestampMs(timestamp)
  const hours = Number(recurrenceHours)
  if (!time || !Number.isFinite(hours) || hours <= 0) return ''
  return new Date(time + hours * 60 * 60 * 1000).toISOString()
}

/** ISO expiry for one payment under a plan; '' when it cannot be computed. */
export function subscriptionExpiry (payment, plan) {
  if (!isPlainObject(payment)) return ''
  const timestamp = payment.timestamp || payment.lastPayment
  const hours = plan && (plan.recurrence !== undefined ? plan.recurrence : plan.recurrenceHours)
  const recurrence = Number.isFinite(Number(hours)) && Number(hours) > 0
    ? Number(hours)
    : Number(payment.recurrence || payment.recurrenceHours)
  return nextPaymentDate(timestamp, recurrence)
}

function subscriberFrom (payment, plan, now) {
  const recurrence = Number(payment.recurrence) ||
    (plan && (Number(plan.recurrence) || Number(plan.recurrenceHours))) ||
    0
  const next = nextPaymentDate(payment.timestamp, recurrence)
  const last = timestampMs(payment.timestamp)
  return {
    account: payment.from,
    readerKey: payment.readerKey,
    sub: payment.sub,
    plan: payment.plan,
    amount: payment.amount,
    lastPayment: last ? new Date(last).toISOString() : '',
    nextPayment: next,
    executionsRemaining: payment.remainingExecutions === null
      ? (payment.type === 'transfer' ? 0 : null)
      : payment.remainingExecutions,
    txid: payment.txid,
    active: Boolean(next) && Date.parse(next) > now
  }
}

/**
 * Collect verified payments and one subscriber per reader key from history.
 *
 * History rows are sorted newest first, deduplicated by txid, and split into
 * payments, subscribers (gifts excluded), gifts, duplicates and invalid rows.
 */
export function collectVaultPayments (history, plan, { now = Date.now(), limit = 3000 } = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const rows = Array.isArray(history) ? history.slice(0, Math.max(0, limit)) : []
  const ordered = rows.slice().sort((a, b) => {
    const ta = timestampMs(Array.isArray(a) && isPlainObject(a[1]) ? a[1].timestamp : a && a.timestamp)
    const tb = timestampMs(Array.isArray(b) && isPlainObject(b[1]) ? b[1].timestamp : b && b.timestamp)
    return tb - ta
  })

  const seen = new Set()
  const payments = []
  const duplicates = []
  const invalid = []
  const gifts = []
  for (const row of ordered) {
    const record = paymentRecord(row, {})
    if (!record) continue
    const name = record.op[0]
    if (name !== 'transfer' && name !== 'fill_recurrent_transfer') continue
    const result = verifyVaultPayment(row, plan, { now: nowMs, seenTxIds: seen })
    if (!result.ok) {
      if (result.code === 'duplicate') duplicates.push(result)
      else invalid.push(result)
      continue
    }
    if (result.txid) seen.add(result.txid)
    payments.push(result)
    if (result.giftFor) gifts.push(result)
  }

  const latestByReader = new Map()
  for (const payment of payments) {
    if (payment.giftFor) continue
    if (!latestByReader.has(payment.readerKey)) latestByReader.set(payment.readerKey, payment)
  }
  const subscribers = []
  for (const payment of latestByReader.values()) {
    subscribers.push(subscriberFrom(payment, plan, nowMs))
  }

  return { payments, subscribers, gifts, duplicates, invalid }
}

/**
 * Aggregate subscriber health for a dashboard.
 *
 * `expiring` means active with a renewal in the next seven days. `mrr` is the
 * HBD value of active subscriptions, returned as a number for display only.
 */
export function summarizeSubscribers (subscribers, { now = Date.now() } = {}) {
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const list = Array.isArray(subscribers) ? subscribers : []
  let active = 0
  let expiring = 0
  let expired = 0
  let milli = 0
  const currencies = new Set()
  for (const subscriber of list) {
    if (!isPlainObject(subscriber)) continue
    const next = timestampMs(subscriber.nextPayment)
    if (!next || next <= nowMs) {
      expired++
      continue
    }
    active++
    if (next - nowMs <= EXPIRING_WINDOW_MS) expiring++
    const amount = parseVaultAmount(subscriber.amount)
    if (amount) {
      currencies.add(amount.currency)
      if (amount.currency === 'HBD') {
        milli += Number(amount.value.replace('.', ''))
      }
    }
  }
  return {
    active,
    expiring,
    expired,
    mrr: milli / 1000,
    currency: currencies.size === 1 ? [...currencies][0] : 'HBD'
  }
}
