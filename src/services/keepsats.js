// Pure helpers for the undocumented v4v.app keepsats payload.
//
// The endpoint mixes top-level amount fields with an `all_transactions`
// liability object and returns numbers as strings. History arrays are not in
// the published schema, so they are read opportunistically.

// Kept out of lightning.js so the Home/tip chunks do not carry the keepsats
// parsing; only the async KeepsatsPanel/session path imports it.

function numberOrNull (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function firstArray (...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value
  }
  return []
}

function normalizeKeepsatsEntry (row) {
  if (!row || typeof row !== 'object') return null
  const msats = numberOrNull(row.msats ?? row.amount_msats)
  const sats = numberOrNull(row.sats ?? row.amount_sats ?? row.net_sats ?? (msats !== null ? msats / 1000 : null))
  return {
    at: String(row.timestamp || row.created_at || row.date || row.time || ''),
    sats,
    type: String(row.type || row.kind || row.rail || row.description || row.category || ''),
    memo: String(row.memo || row.message || ''),
    ref: String(row.parent_id || row.txid || row.tx_id || row.id || '')
  }
}

/**
 * Normalise the undocumented `GET /v2/v4vapp/keepsats` payload.
 *
 * The endpoint returns a mix of top-level amount fields and an
 * `all_transactions` liability object, with numbers sometimes as strings. The
 * history array is not in the published schema and has not been observed yet,
 * so it is read opportunistically and hidden when absent.
 */
export function normalizeKeepsats (payload = {}) {
  const tx = payload?.all_transactions && typeof payload.all_transactions === 'object'
    ? payload.all_transactions
    : {}
  const historyRows = firstArray(payload.transactions, payload.history, tx.transactions, tx.history)
  const history = historyRows.map(normalizeKeepsatsEntry).filter(Boolean).slice(0, 20)
  const inProgressMsats = numberOrNull(tx.in_progress_msats)
  const inProgressSats = numberOrNull(payload.in_progress_sats) ??
    (inProgressMsats !== null ? inProgressMsats / 1000 : null)
  return {
    account: String(payload.hive_accname || tx.sub || ''),
    netSats: numberOrNull(payload.net_sats ?? tx.sats) || 0,
    netHive: numberOrNull(payload.net_hive ?? tx.hive) || 0,
    netHbd: numberOrNull(payload.net_hbd ?? tx.hbd) || 0,
    netUsd: numberOrNull(payload.net_usd ?? tx.usd) || 0,
    inProgressSats: inProgressSats || 0,
    admin: payload.admin === true,
    lastAt: String(tx.last_transaction_date || ''),
    history,
    hasHistory: history.length > 0
  }
}

// ---------------------------------------------------------------------------
// On-chain keepsats instructions
// ---------------------------------------------------------------------------

export const KEEPSATS_TRANSFER_ID = 'v4vapp_transfer'
export const KEEPSATS_NOTIFICATION_ID = 'v4vapp_notification'
export const KEEPSATS_SERVER_ACCOUNT = 'v4vapp'
export const KEEPSATS_DEPOSIT_MEMO = '#sats'

const LIGHTNING_ADDRESS_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

export function parseKeepsatsJson (value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function isKeepsatsCustomJson (data = {}) {
  return data?.id === KEEPSATS_TRANSFER_ID || data?.id === KEEPSATS_NOTIFICATION_ID
}

/** Read a `v4vapp_transfer` / `v4vapp_notification` operation. */
export function parseKeepsatsCustomJson (data = {}) {
  if (!isKeepsatsCustomJson(data)) return null
  const json = parseKeepsatsJson(data.json) || {}
  const msats = numberOrNull(json.msats)
  const sats = numberOrNull(json.sats)
  return {
    id: data.id,
    from: String(json.from_account || json.hive_accname_from || ''),
    to: String(json.to_account || json.hive_accname_to || ''),
    sats: sats ?? (msats !== null ? msats / 1000 : null),
    msats,
    memo: String(json.memo || ''),
    invoiceMessage: String(json.invoice_message || ''),
    parentId: String(json.parent_id || ''),
    notification: data.id === KEEPSATS_NOTIFICATION_ID || json.notification === true
  }
}

/** Short label for the queue and wallet activity rows. */
export function describeKeepsatsCustomJson (data = {}) {
  const parsed = parseKeepsatsCustomJson(data)
  if (!parsed) return ''
  if (parsed.notification) {
    return 'v4vapp notification' + (parsed.parentId ? ' · ' + parsed.parentId : '')
  }
  const memo = parsed.memo
  if (/^lnbc[0-9a-z]+$/i.test(memo)) return 'Pay Lightning invoice with keepsats'
  if (LIGHTNING_ADDRESS_RE.test(memo)) return 'Send keepsats to ' + memo
  if (/^#HBD\b/i.test(memo)) return 'Convert keepsats to HBD'
  if (/^#HIVE\b/i.test(memo)) return 'Convert keepsats to HIVE'
  if (parsed.to && parsed.to !== KEEPSATS_SERVER_ACCOUNT) return 'Send keepsats to @' + parsed.to
  return 'Keepsats action'
}

/**
 * Build the custom_json payload for a keepsats instruction.
 *
 * The operation must be signed with the active key of `from_account`. `sats`
 * is omitted for a fixed-amount invoice (the invoice decides) and required for
 * a Lightning address. `to_account` is always the server for conversion,
 * address payments and invoice payments.
 */
export function buildKeepsatsTransfer ({
  from,
  to = KEEPSATS_SERVER_ACCOUNT,
  sats = null,
  memo = '',
  invoiceMessage = ''
} = {}) {
  const account = String(from || '').trim().replace(/^@/, '').toLowerCase()
  if (!account) throw new Error('A Hive account is required for a keepsats transfer.')
  const json = {
    from_account: account,
    to_account: String(to || KEEPSATS_SERVER_ACCOUNT).trim().replace(/^@/, '').toLowerCase()
  }
  const amount = Number(sats)
  if (Number.isFinite(amount) && amount > 0) json.sats = String(Math.round(amount))
  if (memo) json.memo = String(memo)
  if (invoiceMessage) json.invoice_message = String(invoiceMessage)
  return ['custom_json', {
    required_auths: [account],
    required_posting_auths: [],
    id: KEEPSATS_TRANSFER_ID,
    json: JSON.stringify(json)
  }]
}

/** Normal `transfer` instruction that credits the amount to keepsats. */
export function buildKeepsatsDeposit ({ from, amount, asset = 'HBD' } = {}) {
  const account = String(from || '').trim().replace(/^@/, '').toLowerCase()
  const value = Number(amount)
  const symbol = String(asset || 'HBD').toUpperCase() === 'HIVE' ? 'HIVE' : 'HBD'
  if (!account) throw new Error('A Hive account is required for a keepsats deposit.')
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.')
  return ['transfer', {
    from: account,
    to: KEEPSATS_SERVER_ACCOUNT,
    amount: value.toFixed(3) + ' ' + symbol,
    memo: KEEPSATS_DEPOSIT_MEMO
  }]
}

/** Convert keepsats to HIVE/HBD by transferring them back to the server. */
export function buildKeepsatsConvert ({ from, sats, asset = 'HBD' } = {}) {
  const symbol = String(asset || 'HBD').toUpperCase() === 'HIVE' ? 'HIVE' : 'HBD'
  return buildKeepsatsTransfer({
    from,
    sats,
    memo: '#' + symbol
  })
}

