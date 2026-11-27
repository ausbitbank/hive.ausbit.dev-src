// Delegation explorer data.
//
// Hive exposes outgoing delegations directly. Incoming delegations have no
// delegatee index, so they are reconstructed from recent account history and
// then verified against each delegator's current outgoing list. The page labels
// that limitation instead of implying the list is exhaustive for all time.

import { rpcRequest } from './api'
import { parseAmount, vestsToHp } from './witnesses'
import moment from '../utils/time'

const DEFAULT_HISTORY_LIMIT = 1000

function numberFrom (value) {
  return parseAmount(value)
}

export function delegationVests (delegation) {
  return Math.max(0, numberFrom(delegation?.vesting_shares))
}

export function delegationHp (delegation, globalProps) {
  return vestsToHp(delegationVests(delegation), globalProps)
}

function historyEntry (item) {
  if (!Array.isArray(item) || item.length < 2) return null
  const payload = item[1]
  if (!payload || !Array.isArray(payload.op) || payload.op.length < 2) return null
  return {
    index: Number(item[0]),
    operation: payload.op[0],
    data: payload.op[1] || {},
    timestamp: payload.timestamp || null,
    trxId: payload.trx_id || ''
  }
}

/**
 * Turn raw account history into delegation events for one account.
 * Events are returned newest-first.
 */
export function extractDelegationEvents (history, account) {
  const name = String(account || '').toLowerCase()
  if (!name) return []
  const events = []

  for (const item of Array.isArray(history) ? history : []) {
    const entry = historyEntry(item)
    if (!entry) continue

    if (entry.operation === 'delegate_vesting_shares') {
      const delegator = String(entry.data.delegator || '').toLowerCase()
      const delegatee = String(entry.data.delegatee || '').toLowerCase()
      if (delegator !== name && delegatee !== name) continue
      const direction = delegatee === name ? 'in' : 'out'
      const counterparty = direction === 'in' ? delegator : delegatee
      events.push({
        type: 'delegate',
        direction,
        counterparty,
        vests: Math.max(0, numberFrom(entry.data.vesting_shares)),
        timestamp: entry.timestamp,
        trxId: entry.trxId,
        index: entry.index
      })
    } else if (entry.operation === 'return_vesting_delegation') {
      const owner = String(entry.data.account || '').toLowerCase()
      if (owner !== name) continue
      events.push({
        type: 'return',
        direction: 'return',
        counterparty: '',
        vests: Math.max(0, numberFrom(entry.data.vesting_shares)),
        timestamp: entry.timestamp,
        trxId: entry.trxId,
        index: entry.index
      })
    }
  }

  return events.sort((a, b) => {
    const left = a.timestamp ? moment.utc(a.timestamp).valueOf() : 0
    const right = b.timestamp ? moment.utc(b.timestamp).valueOf() : 0
    if (left !== right) return right - left
    return b.index - a.index
  })
}

export async function listOutgoingDelegations (account, options = {}) {
  if (!account) return []
  const limit = Math.max(1, Math.min(1000, Number(options.limit) || 1000))
  const start = String(options.start || '').toLowerCase()
  const response = await rpcRequest('condenser_api.get_vesting_delegations', [account, start, limit], options)
  return (Array.isArray(response) ? response : [])
    .filter(delegation => delegation?.delegatee)
    .filter(delegation => !start || String(delegation.delegatee).toLowerCase() >= start)
    .map(delegation => ({
      ...delegation,
      vests: delegationVests(delegation)
    }))
    .filter(delegation => delegation.vests > 0)
    .sort((a, b) => b.vests - a.vests)
}

export async function fetchDelegationHistory (account, options = {}) {
  if (!account) return []
  const limit = Math.max(1, Math.min(DEFAULT_HISTORY_LIMIT, Number(options.limit) || DEFAULT_HISTORY_LIMIT))
  const history = await rpcRequest('condenser_api.get_account_history', [account, -1, limit], options)
  return extractDelegationEvents(history, account)
}

/**
 * Verify recent incoming delegation events against the delegators' current
 * outgoing lists. A delegation may have been cancelled inside the history
 * window, so the history scan alone is not enough.
 */
export async function resolveInboundDelegations (account, events, options = {}) {
  const name = String(account || '').toLowerCase()
  const maxCandidates = Math.max(1, Math.min(100, Number(options.maxCandidates) || 60))
  const candidates = [...new Set((Array.isArray(events) ? events : [])
    .filter(event => event.direction === 'in' && event.vests > 0 && event.counterparty)
    .map(event => event.counterparty))].slice(0, maxCandidates)
  if (candidates.length === 0 || !name) return []

  const concurrency = Math.max(1, Math.min(6, Number(options.concurrency) || 4))
  const found = []
  let cursor = 0

  async function worker () {
    while (cursor < candidates.length) {
      const delegator = candidates[cursor++]
      try {
        // `get_vesting_delegations` is sorted by delegatee and accepts a start
        // cursor. Ask for the five rows at this delegatee instead of the
        // delegator's whole list (which can be 1,000 rows for a busy account).
        const outgoing = await listOutgoingDelegations(delegator, { ...options, limit: 5, start: name })
        const match = outgoing.find(delegation => String(delegation.delegatee).toLowerCase() === name)
        if (match) {
          found.push({
            delegator,
            delegatee: name,
            vests: match.vests,
            vesting_shares: match.vesting_shares,
            min_delegation_time: match.min_delegation_time
          })
        }
      } catch {
        // One dead lookup must not hide the rest of the inbound list.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker))
  return found.sort((a, b) => b.vests - a.vests)
}

export function summarizeDelegations (outgoing = [], inbound = [], globalProps = null, account = null) {
  const outRows = (Array.isArray(outgoing) ? outgoing : []).map(delegation => ({
    ...delegation,
    vests: delegation.vests ?? delegationVests(delegation),
    hp: delegationHp(delegation, globalProps)
  })).sort((a, b) => b.vests - a.vests)

  const inRows = (Array.isArray(inbound) ? inbound : []).map(delegation => ({
    ...delegation,
    vests: delegation.vests ?? delegationVests(delegation),
    hp: delegationHp(delegation, globalProps)
  })).sort((a, b) => b.vests - a.vests)

  const outgoingVests = outRows.reduce((sum, row) => sum + row.vests, 0)
  const inboundVests = inRows.reduce((sum, row) => sum + row.vests, 0)
  const ownedVests = Math.max(0, numberFrom(account?.vesting_shares))
  const effectiveVests = Math.max(0,
    ownedVests +
    numberFrom(account?.received_vesting_shares) -
    numberFrom(account?.delegated_vesting_shares) -
    numberFrom(account?.vesting_withdraw_rate)
  )

  return {
    outgoing: outRows,
    inbound: inRows,
    outgoingVests,
    inboundVests,
    outgoingHp: vestsToHp(outgoingVests, globalProps),
    inboundHp: vestsToHp(inboundVests, globalProps),
    netHp: vestsToHp(inboundVests - outgoingVests, globalProps),
    outgoingCount: outRows.length,
    inboundCount: inRows.length,
    outgoingShare: ownedVests > 0 ? Math.min(1, outgoingVests / ownedVests) : 0,
    inboundShare: effectiveVests > 0 ? Math.min(1, inboundVests / effectiveVests) : 0,
    topOutgoing: outRows[0] || null,
    topInbound: inRows[0] || null
  }
}
