// Pure read model for the dashboard delegation-snapshot widget.
//
// Outgoing delegations come straight from the chain. Incoming delegations have
// no delegatee index, so `services/delegations` reconstructs them from recent
// account history and verifies them against the delegators' current lists. This
// module only shapes both lists into the compact rows the widget renders.
//
// Effective HP comes from the account record alone. Hive stores
// `delegated_vesting_shares` and `received_vesting_shares` on the account, and
// those fields already include every delegation in the outgoing/incoming
// lists. Adding (or subtracting) the list totals again would double count them,
// so the lists are display detail, not an adjustment to effective HP.
//
// This module intentionally has no Vue imports and no timers.

import { delegationVests, summarizeDelegations } from './delegations'
import { accountEffectiveVests, formatHp, vestsToHp } from './witnesses'

const DEFAULT_LIMIT = 5

function capOf (limit) {
  const value = Number(limit)
  if (!Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.max(0, Math.floor(value))
}

function accountNameOf (account) {
  if (!account) return ''
  if (typeof account === 'string') return account.replace(/^@/, '').trim()
  return String(account.name || '').replace(/^@/, '').trim()
}

/**
 * Keep only delegations that name a counterparty, so rows never render blank.
 * `summarizeDelegations` derives HP from `vesting_shares`; normalising the
 * numeric `vests` back onto that field keeps both the totals and the rows
 * correct when a caller supplies already-shaped delegation objects.
 */
function namedRows (list, key) {
  return (Array.isArray(list) ? list : [])
    .filter(row => {
      if (!row || typeof row !== 'object') return false
      return Boolean(String(row[key] || row.name || '').trim())
    })
    .map(row => {
      const direct = Number(row.vests)
      const vests = Number.isFinite(direct) && direct > 0 ? direct : delegationVests(row)
      return { ...row, vests, vesting_shares: String(vests) + ' VESTS' }
    })
}

function shapeRows (rows, key) {
  return rows.map(row => ({
    name: String(row[key] || row.name || '').trim(),
    vests: Number(row.vests) || 0,
    hp: Number(row.hp) || 0,
    label: formatHp(row.hp, 2)
  }))
}

/**
 * Summarise one account's current delegations for a compact dashboard widget.
 *
 * `outgoing` and `incoming` are the raw lists from `listOutgoingDelegations`
 * and `resolveInboundDelegations` (or compatible delegation records). Rows are
 * sorted high to low, and `limit` caps only the `topOutgoing`/`topIncoming`
 * slices, not the totals.
 */
export function delegationSnapshotSummary ({
  account = null,
  outgoing = [],
  incoming = [],
  globalProps = null,
  limit = 5
} = {}) {
  const outgoingRows = namedRows(outgoing, 'delegatee')
  const incomingRows = namedRows(incoming, 'delegator')
  const summary = summarizeDelegations(outgoingRows, incomingRows, globalProps, account)

  const outgoingShaped = shapeRows(summary.outgoing, 'delegatee')
  const incomingShaped = shapeRows(summary.inbound, 'delegator')
  const cap = capOf(limit)
  const accountName = accountNameOf(account)

  return {
    accountName,
    outgoing: outgoingShaped,
    incoming: incomingShaped,
    outgoingHp: summary.outgoingHp,
    incomingHp: summary.inboundHp,
    // Account fields already contain the list totals; see the module comment.
    effectiveHp: vestsToHp(accountEffectiveVests(account), globalProps),
    topOutgoing: outgoingShaped.slice(0, cap),
    topIncoming: incomingShaped.slice(0, cap),
    hasOutgoing: outgoingShaped.length > 0,
    hasIncoming: incomingShaped.length > 0,
    hasData: Boolean(accountName || outgoingShaped.length > 0 || incomingShaped.length > 0)
  }
}

export default delegationSnapshotSummary
