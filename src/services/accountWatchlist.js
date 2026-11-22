// Pure summary for the account-watchlist dashboard widget.
//
// The widget stores a list of names in its settings and fetches the matching
// account records and global properties. This module keeps the requested
// order, converts VESTS to Hive Power and normalises balances, so the widget
// is layout-only and every edge case (unknown names, string amounts, missing
// global properties) is unit tested.
//
// This module intentionally has no Vue imports and no timers.

import { formatReputation } from './comments'
import { tidyNumber, toNumber, vestToHive } from './wallet'
import { hiveAvatarUrl } from 'src/utils/avatar'

function normalizeName (value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase()
}

function recordMap (records) {
  const map = new Map()
  if (Array.isArray(records)) {
    for (const record of records) {
      if (!record || typeof record !== 'object') continue
      const name = normalizeName(record.name)
      if (name) map.set(name, record)
    }
    return map
  }
  if (records && typeof records === 'object') {
    for (const [key, record] of Object.entries(records)) {
      if (!record || typeof record !== 'object') continue
      const name = normalizeName(record.name || key)
      if (name) map.set(name, record)
    }
  }
  return map
}

function label (value) {
  return tidyNumber(value)
}

/**
 * Summarise the requested accounts in the order they were configured.
 *
 * Rows are only produced for accounts that resolved to a record; `found` and
 * `missing` count the requested names so the widget can explain gaps. A
 * missing `globalProps` or an unknown account never throws.
 */
export function accountWatchlistSummary ({ accounts = [], records = {}, globalProps = null } = {}) {
  const requested = []
  const seen = new Set()
  const limit = 20

  for (const raw of Array.isArray(accounts) ? accounts : []) {
    const name = normalizeName(raw)
    if (!name || seen.has(name)) continue
    seen.add(name)
    requested.push(name)
    if (requested.length >= limit) break
  }

  const byName = recordMap(records)
  const rows = []

  for (const name of requested) {
    const record = byName.get(name)
    if (!record) continue

    const hp = vestToHive(toNumber(record.vesting_shares), globalProps)
    const hive = toNumber(record.balance)
    const hbd = toNumber(record.hbd_balance)

    rows.push({
      name,
      reputation: formatReputation(record.reputation),
      hp,
      hive,
      hbd,
      hpLabel: label(hp),
      hiveLabel: label(hive),
      hbdLabel: label(hbd),
      postCount: Math.max(0, Math.floor(toNumber(record.post_count))),
      created: String(record.created || ''),
      link: '/@' + name,
      avatar: hiveAvatarUrl(name)
    })
  }

  const found = rows.length
  return {
    rows,
    found,
    missing: requested.length - found,
    hasData: found > 0
  }
}

export default accountWatchlistSummary
