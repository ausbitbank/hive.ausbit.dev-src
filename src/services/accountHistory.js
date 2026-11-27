// Paginated account-history reads for Vault.
//
// `get_account_history` returns at most 1,000 rows per call. A busy account can
// push a payment past that window, so grant issuance and the reader manager walk
// backwards until they reach the requested time window, run out of rows, or hit
// a page cap. The helper is injectable so it can be tested without a Hive node.

const DEFAULT_PAGE_LIMIT = 1000
const DEFAULT_PAGES = 10

/**
 * Hive operation bitmask for Vault payments and plans:
 * transfer (2), recurrent_transfer (49), fill_recurrent_transfer (83),
 * failed_recurrent_transfer (84). Operation ids below 64 live in the low half.
 */
export const VAULT_HISTORY_FILTER = Object.freeze({
  low: 2 ** 2 + 2 ** 49,
  high: 2 ** 19 + 2 ** 20
})

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

function rowIndex (row) {
  const index = Number(Array.isArray(row) ? row[0] : NaN)
  return Number.isInteger(index) ? index : null
}

function rowTime (row) {
  return Array.isArray(row) && row[1] ? timestampMs(row[1].timestamp) : 0
}

/**
 * Walk account history backwards.
 *
 * `fetchPage(account, { from, limit, force })` must return rows shaped
 * `[index, { op, timestamp, trx_id }]`. `since` may be epoch ms, a Date or an
 * ISO string; older rows stop the scan. `pages` is the safety cap.
 *
 * @returns {Promise<{ rows: object[], pages: number, scanned: number,
 *   complete: boolean, truncated: boolean }>}
 */
export async function collectAccountHistory ({
  account,
  fetchPage,
  pages = DEFAULT_PAGES,
  limit = DEFAULT_PAGE_LIMIT,
  since = 0,
  force = true
} = {}) {
  const name = normalizeAccount(account)
  const pageCount = Math.max(1, Math.min(50, Number(pages) || DEFAULT_PAGES))
  const pageSize = Math.max(1, Math.min(1000, Number(limit) || DEFAULT_PAGE_LIMIT))
  const sinceMs = since instanceof Date
    ? since.getTime()
    : (typeof since === 'number' ? since : timestampMs(since))
  if (!name || typeof fetchPage !== 'function') {
    return { rows: [], pages: 0, scanned: 0, complete: true, truncated: false }
  }

  let cursor = -1
  let scanned = 0
  let usedPages = 0
  let complete = false
  const byIndex = new Map()

  while (usedPages < pageCount) {
    const batch = await fetchPage(name, { from: cursor, limit: pageSize, force })
    usedPages++
    if (!Array.isArray(batch) || batch.length === 0) {
      complete = true
      break
    }
    for (const row of batch) {
      const index = rowIndex(row)
      if (index === null || byIndex.has(index)) continue
      byIndex.set(index, row)
    }
    scanned += batch.length

    const oldest = batch[0]
    const oldestTime = rowTime(oldest)
    const oldestIndex = rowIndex(oldest)
    if (sinceMs && oldestTime && oldestTime <= sinceMs) {
      complete = true
      break
    }
    if (batch.length < pageSize) {
      complete = true
      break
    }
    if (oldestIndex === null || oldestIndex <= 0) {
      complete = true
      break
    }
    cursor = oldestIndex - 1
  }

  const rows = [...byIndex.values()].sort((a, b) => (rowIndex(a) || 0) - (rowIndex(b) || 0))
  return {
    rows,
    pages: usedPages,
    scanned,
    complete,
    truncated: !complete
  }
}

/** Default 400-day window: covers annual grants plus grace. */
export function vaultHistorySince (now = Date.now(), days = 400) {
  return now - Math.max(1, days) * 24 * 60 * 60 * 1000
}
