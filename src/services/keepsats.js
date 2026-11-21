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

