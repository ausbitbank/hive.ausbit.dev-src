// Reconcile a failed active broadcast before it can be retried.
//
// A wallet can broadcast a transaction and then lose the response (closed
// extension, dropped network, reloaded tab). The queue records the failure but
// cannot know whether the operation landed. Re-broadcasting blind can move
// funds twice, so a failed active item is checked against the chain first:
// `transaction_status_api.find_transaction` when a tx id is known, plus a
// bounded account-history match for operations with a stable identity.
//
// History matching is deliberately narrow. It only covers operations whose
// body can be compared field by field (`transfer`, `recurrent_transfer`) and
// only inside a bounded window around the attempt. A truncated history, a
// missing attempt time or an empty response is `uncertain`, never `absent`.

import { operationData, operationType } from './queue'

/** Newest rows requested from `condenser_api.get_account_history`. */
export const HISTORY_LOOKUP_LIMIT = 200

/** Local clock can drift from the chain; widen the attempt cutoff by this much. */
export const RECONCILE_CLOCK_SKEW_MS = 5 * 60 * 1000

/** A queue is discarded after 24 hours, so an older match is not this attempt. */
export const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Give indexers this long before an empty history is treated as absence. */
export const RECONCILE_INDEXING_GRACE_MS = 2 * 60 * 1000

const IDENTITY_FIELDS = {
  transfer: ['from', 'to', 'amount', 'memo'],
  recurrent_transfer: ['from', 'to', 'amount', 'memo', 'recurrence']
}

function normalizeField (field, value) {
  const text = String(value ?? '')
  // Memos are case-sensitive; account names and asset strings are not.
  return field === 'memo' ? text : text.trim().toLowerCase()
}

/**
 * The operation fields that identify a queued action in account history.
 * Returns `null` when the operation cannot be matched safely.
 */
export function reconcileIdentity (action) {
  const kind = operationType(action)
  const fields = IDENTITY_FIELDS[kind]
  if (!fields) return null
  const data = operationData(action)
  const values = {}
  for (const field of fields) values[field] = normalizeField(field, data[field])
  if (!values.from || !values.to || !values.amount) return null
  return { kind, fields: values }
}

function rowTimestamp (row) {
  return Date.parse(row?.[1]?.timestamp || '')
}

function rowOperation (row) {
  return row?.[1]?.op
}

function matches (identity, operation) {
  if (!Array.isArray(operation) || operation[0] !== identity.kind) return false
  const data = operation[1]
  if (!data || typeof data !== 'object') return false
  return Object.entries(identity.fields).every(([field, expected]) =>
    normalizeField(field, data[field]) === expected
  )
}

/** `transaction_status_api.find_transaction` marks inclusion with a block number. */
export function transactionLookupFound (status) {
  const block = Number(status?.block_num)
  return Number.isFinite(block) && block > 0
}

/**
 * Match one queued action against account-history rows.
 *
 * @param {object} input
 * @param {Array} input.action Queue item in `[owner, authority, operation]` form.
 * @param {Array} input.rows `get_account_history` rows, newest last.
 * @param {number} input.attemptedAt Epoch ms when the broadcast was attempted.
 * @param {number} [input.now] Current epoch ms, for the match window.
 * @returns {{ verdict: 'found'|'absent'|'uncertain'|'unsupported', txId: string, reason: string }}
 */
export function reconcileHistory ({ action, rows, attemptedAt, now = Date.now() }) {
  const identity = reconcileIdentity(action)
  if (!identity) return { verdict: 'unsupported', txId: '', reason: '' }

  const attempted = Number(attemptedAt)
  if (!Number.isFinite(attempted) || attempted <= 0) {
    return { verdict: 'uncertain', txId: '', reason: 'No broadcast attempt time was recorded.' }
  }
  if (!Array.isArray(rows)) {
    return { verdict: 'uncertain', txId: '', reason: 'Account history could not be read.' }
  }

  const cutoff = attempted - RECONCILE_CLOCK_SKEW_MS
  const ceiling = Math.min(Number.isFinite(Number(now)) ? Number(now) : Date.now(), attempted + RECONCILE_WINDOW_MS) + RECONCILE_CLOCK_SKEW_MS

  let sawRow = false
  let oldest = Infinity
  for (const row of rows) {
    const timestamp = rowTimestamp(row)
    if (!Number.isFinite(timestamp)) continue
    sawRow = true
    if (timestamp < oldest) oldest = timestamp
    if (timestamp < cutoff || timestamp > ceiling) continue
    if (matches(identity, rowOperation(row))) {
      return {
        verdict: 'found',
        txId: String(row?.[1]?.trx_id || ''),
        reason: 'A matching operation is already in account history.'
      }
    }
  }

  if (!sawRow) {
    const current = Number.isFinite(Number(now)) ? Number(now) : Date.now()
    if (current - attempted > RECONCILE_INDEXING_GRACE_MS) {
      // A successful but empty history after the indexing grace means the
      // account has no operation matching this attempt.
      return { verdict: 'absent', txId: '', reason: 'Account history is empty past the attempt.' }
    }
    return { verdict: 'uncertain', txId: '', reason: 'Account history has not caught up yet.' }
  }
  if (oldest > cutoff) {
    // Every returned row is newer than the attempt: the history page may have
    // skipped rows this action could be in. Absence is not proven.
    return { verdict: 'uncertain', txId: '', reason: 'Account history does not reach back to the attempt.' }
  }
  return { verdict: 'absent', txId: '', reason: 'No matching operation is in account history.' }
}

/**
 * Combine the optional transaction lookup and the history match.
 *
 * - A found tx or history row means the broadcast landed.
 * - A successful lookup that reports no block is proof of absence.
 * - Otherwise, uncertainty fails closed: the caller must not re-broadcast.
 * - Operations without a history identity are unsupported and keep the
 *   existing manual-retry warning rather than a false verdict.
 *
 * @param {object} input
 * @param {Array} input.action
 * @param {number} input.attemptedAt
 * @param {{ ok: boolean, status?: object, txId?: string }|null} [input.tx]
 * @param {Array|undefined} [input.rows]
 * @returns {{ verdict: 'found'|'absent'|'uncertain'|'unsupported', txId: string, reason: string, source: string }}
 */
export function reconcileFailedBroadcast ({ action, attemptedAt, tx = null, rows, now = Date.now() }) {
  const identity = reconcileIdentity(action)
  if (!identity) {
    return { verdict: 'unsupported', txId: '', reason: 'This operation has no safe history identity.', source: '' }
  }

  if (tx?.ok && transactionLookupFound(tx.status)) {
    return { verdict: 'found', txId: String(tx.txId || ''), reason: 'Transaction is included in a block.', source: 'tx' }
  }

  const history = reconcileHistory({ action, rows, attemptedAt, now })
  if (history.verdict === 'found') return { ...history, source: 'history' }

  // `find_transaction` is authoritative for the recent window when it answers
  // without an error, even if history was truncated or unavailable.
  if (tx?.ok) {
    return { verdict: 'absent', txId: '', reason: 'The transaction is not on chain.', source: 'tx' }
  }
  if (history.verdict === 'absent') return { ...history, source: 'history' }

  return { ...history, source: '' }
}
