// Read-only order and subscription helpers for the Hive Open Market.
//
// A purchase is a `transfer` or `recurrent_transfer` whose memo is JSON:
//
//   {"product":"author/permlink","quantity":N}
//
// The memo may also carry an optional `custom` key; it is ignored. Everything
// here is pure and works on rows returned by `condenser_api.get_account_history`
// and `condenser_api.find_recurrent_transfers`. Amounts are chain strings and
// are never recomputed from URL or client state.

import { isValidHiveAccountName } from './blogHost'

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/i
const AMOUNT_RE = /^(\d+(?:\.\d+)?)\s+(HIVE|HBD)$/i
const TRANSFER_OPS = new Set(['transfer', 'recurrent_transfer'])
const ZERO_AMOUNT = '0.000'

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

/** Parse one `author/permlink` product reference, or return null. */
export function parseProductRef (value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const slash = text.indexOf('/')
  if (slash < 1 || slash === text.length - 1) return null
  if (text.indexOf('/', slash + 1) !== -1) return null
  const author = normalizeAccount(text.slice(0, slash))
  const permlink = text.slice(slash + 1)
  if (!isValidHiveAccountName(author) || !PERMLINK_RE.test(permlink)) return null
  return { author, permlink }
}

/**
 * Stable product key. Account names and permlinks are matched
 * case-insensitively so one product cannot appear under two keys.
 */
export function productKey (value) {
  if (!value) return ''
  const ref = typeof value === 'string'
    ? parseProductRef(value)
    : parseProductRef(String(value.author || '') + '/' + String(value.permlink || ''))
  return ref ? ref.author + '/' + ref.permlink.toLowerCase() : ''
}

/** Safe display fallback for a product reference: `author/permlink` or ''. */
export function productRefLabel (value) {
  const ref = typeof value === 'string'
    ? parseProductRef(value)
    : parseProductRef(String(value && value.author || '') + '/' + String(value && value.permlink || ''))
  return ref ? ref.author + '/' + ref.permlink : ''
}

/** Parse a chain amount such as `"50.000 HBD"` without changing its value. */
export function parseAmount (value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(AMOUNT_RE)
  if (!match) return null
  const currency = match[2].toUpperCase()
  const amount = match[1]
  return { value: amount, currency, label: amount + ' ' + currency }
}

/**
 * Parse a Hive Open Market purchase memo.
 *
 * Rejects invalid JSON, non-object roots, unsafe account/permlink pairs and
 * quantities that are not positive whole numbers. Unknown keys (including
 * `custom`) are ignored.
 *
 * @returns {{ product: { author: string, permlink: string }, quantity: number } | null}
 */
export function parsePurchaseMemo (memo) {
  if (typeof memo !== 'string' || !memo.trim()) return null
  let parsed
  try {
    parsed = JSON.parse(memo)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const product = parseProductRef(parsed.product)
  if (!product) return null
  const quantity = parsed.quantity
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) return null
  return { product, quantity: Math.floor(quantity) }
}

function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

function newestFirst (a, b) {
  return timestampMs(b.timestamp) - timestampMs(a.timestamp) || String(b.id).localeCompare(String(a.id))
}

/** Format a chain timestamp for display; '' when absent or invalid. */
export function formatOrderDate (value, { locale = 'en' } = {}) {
  const time = timestampMs(value)
  if (!time) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    }).format(new Date(time))
  } catch {
    return new Date(time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  }
}

/** Human recurrence label, e.g. `730 hours (30.4 days)` or `7 days`. */
export function formatRecurrence (hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return ''
  const days = value / 24
  if (Math.abs(days - Math.round(days)) < 1e-9) {
    const whole = Math.round(days)
    return whole + (whole === 1 ? ' day' : ' days')
  }
  return value + ' hours (' + days.toFixed(1) + ' days)'
}

function rowIndex (row) {
  const index = Number(Array.isArray(row) ? row[0] : NaN)
  return Number.isInteger(index) ? index : null
}

/**
 * Turn one `get_account_history` row into an order, or return null.
 *
 * Outgoing product payments are purchases; incoming product payments are
 * sales. The memo must parse as a Hive Open Market purchase memo and the amount
 * must be a positive HIVE/HBD amount.
 */
export function orderFromHistoryRow (row, account) {
  if (!Array.isArray(row) || row.length < 2) return null
  const accountName = normalizeAccount(account)
  const index = rowIndex(row)
  if (!accountName || index === null) return null

  const record = row[1]
  if (!record || typeof record !== 'object' || !Array.isArray(record.op)) return null
  const [opName, opBody] = record.op
  if (!TRANSFER_OPS.has(opName)) return null
  const body = opBody && typeof opBody === 'object' ? opBody : null
  if (!body) return null

  const from = normalizeAccount(body.from)
  const to = normalizeAccount(body.to)
  if (!from || !to) return null

  let kind
  let direction
  let counterparty
  if (from === accountName) {
    kind = 'purchase'
    direction = 'out'
    counterparty = to
  } else if (to === accountName) {
    kind = 'sale'
    direction = 'in'
    counterparty = from
  } else {
    return null
  }
  if (!isValidHiveAccountName(counterparty)) return null

  const amount = parseAmount(body.amount)
  if (!amount || Number(amount.value) <= 0) return null

  const parsedMemo = parsePurchaseMemo(body.memo)
  if (!parsedMemo) return null

  const recurring = opName === 'recurrent_transfer'
  const recurrence = Number(body.recurrence)
  const recurrenceHours = recurring && Number.isFinite(recurrence) && recurrence > 0
    ? recurrence
    : 0
  const trxId = record.trx_id ? String(record.trx_id) : ''
  const id = trxId
    ? trxId + ':' + index
    : String(record.block || '') + ':' + index

  return {
    id,
    kind,
    direction,
    counterparty,
    author: parsedMemo.product.author,
    permlink: parsedMemo.product.permlink,
    quantity: parsedMemo.quantity,
    amount: amount.label,
    currency: amount.currency,
    timestamp: String(record.timestamp || ''),
    memo: String(body.memo || ''),
    recurring,
    recurrenceHours
  }
}

/**
 * Split products from an account's history into purchases and sales.
 * Rows are deduplicated by `trx_id:index` and returned newest first.
 *
 * @returns {{ purchases: object[], sales: object[] }}
 */
export function collectOrders (rows, account) {
  const purchases = []
  const sales = []
  const seen = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    const order = orderFromHistoryRow(row, account)
    if (!order) continue
    if (seen.has(order.id)) continue
    seen.add(order.id)
    if (order.kind === 'purchase') purchases.push(order)
    else sales.push(order)
  }
  return {
    purchases: purchases.sort(newestFirst),
    sales: sales.sort(newestFirst)
  }
}

/**
 * Normalise one row from `condenser_api.find_recurrent_transfers`.
 *
 * Returns null for cancelled (zero-amount) rows, malformed amounts, missing
 * accounts/recurrence and rows whose memo is not a product purchase memo.
 */
export function subscriptionFromRecurrent (row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const from = normalizeAccount(row.from)
  const to = normalizeAccount(row.to)
  if (!isValidHiveAccountName(from) || !isValidHiveAccountName(to)) return null

  const amount = parseAmount(row.amount)
  if (!amount || Number(amount.value) <= 0) return null

  const memo = typeof row.memo === 'string' ? row.memo : ''
  const parsedMemo = parsePurchaseMemo(memo)
  if (!parsedMemo) return null

  const recurrence = Number(row.recurrence)
  if (!Number.isFinite(recurrence) || recurrence <= 0) return null

  const remaining = Number(row.remaining_executions)
  const pairId = Math.trunc(Number(row.pair_id)) || 0

  return {
    id: row.id !== undefined && row.id !== null ? String(row.id) : from + ':' + to + ':' + memo,
    to,
    from,
    amount: amount.label,
    currency: amount.currency,
    memo,
    recurrenceHours: recurrence,
    remainingExecutions: Number.isFinite(remaining) ? Math.max(0, Math.trunc(remaining)) : null,
    nextExecution: typeof row.trigger_date === 'string' ? row.trigger_date : '',
    pairId,
    product: parsedMemo.product
  }
}

/**
 * Build the exact `recurrent_transfer` that cancels a subscription.
 *
 * Cancellation repeats the original transfer with a zero amount and the same
 * memo/recurrence. HF28 expects `executions: 2`; `pair_id` is carried through
 * `extensions` so the chain can find the pair it replaces.
 *
 * @returns {[string, object] | null}
 */
export function buildCancelOperation (subscription, username) {
  if (!subscription || typeof subscription !== 'object') return null
  const from = normalizeAccount(subscription.from)
  const to = normalizeAccount(subscription.to)
  const name = normalizeAccount(username)
  if (!name || name !== from) return null
  if (!isValidHiveAccountName(from) || !isValidHiveAccountName(to)) return null

  const amount = parseAmount(subscription.amount)
  if (!amount || Number(amount.value) <= 0) return null

  const memo = typeof subscription.memo === 'string' ? subscription.memo : ''
  if (!memo.trim()) return null

  const recurrence = Math.trunc(Number(subscription.recurrenceHours))
  if (!Number.isFinite(recurrence) || recurrence <= 0) return null

  const pairId = Math.trunc(Number(subscription.pairId)) || 0
  const extensions = pairId > 0
    ? [{ type: 1, value: { pair_id: pairId } }]
    : []

  return ['recurrent_transfer', {
    to,
    from,
    amount: ZERO_AMOUNT + ' ' + amount.currency,
    memo,
    recurrence,
    executions: 2,
    extensions
  }]
}
