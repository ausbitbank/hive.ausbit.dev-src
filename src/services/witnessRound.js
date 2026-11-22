// Pure read model for the dashboard witness-round widget.
//
// `get_witness_schedule` returns the shuffled signing order for the current
// 21-block round. Global properties supply the chain head and the witness that
// signed the head block. Rotating the shuffled list to the head block's slot
// tells the widget who is producing now and who is up next, without any timers.
//
// This module intentionally has no Vue imports and no timers.

import { parseAmount } from './witnesses'

const DEFAULT_ROUND_SIZE = 21
const DEFAULT_LIMIT = 6

function capOf (limit) {
  const value = Number(limit)
  if (!Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.max(0, Math.floor(value))
}

function roundSizeOf (schedule) {
  const value = Math.floor(Number(schedule?.num_scheduled_witnesses))
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ROUND_SIZE
}

function normalizeAccount (value) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase()
}

/**
 * Summarise the current witness round.
 *
 * `next` starts at the producer of the head block (`inBlocks: 0`,
 * `current: true`) and continues through upcoming producers, wrapping into the
 * next round when `limit` exceeds the remaining slots. The dashboard widget
 * therefore asks for one extra row so it can show `limit` upcoming producers
 * after rendering the current one separately.
 *
 * `available` requires both a non-empty shuffled schedule and a chain head;
 * without them the slot arithmetic has no meaning. `updatedAt` records the
 * caller's clock (or `Date.now()` when it is missing) so stale data can be
 * labelled.
 */
export function witnessRoundSummary ({
  schedule = null,
  globalProps = null,
  witnesses = [],
  account = '',
  limit = 6,
  now = Date.now()
} = {}) {
  const shuffled = (Array.isArray(schedule?.current_shuffled_witnesses)
    ? schedule.current_shuffled_witnesses
    : [])
    .map(name => String(name || '').trim())
    .filter(Boolean)

  const roundSize = roundSizeOf(schedule)
  const headBlock = Math.max(0, Math.floor(parseAmount(globalProps?.head_block_number)))
  const currentWitness = String(globalProps?.current_witness || '').trim()
  const available = shuffled.length > 0 && headBlock > 0
  const position = roundSize > 0 ? headBlock % roundSize : 0

  const cycle = shuffled.length
  const cap = capOf(limit)
  const next = []

  if (available && cycle > 0 && cap > 0) {
    for (let offset = 0; offset < cap; offset += 1) {
      const slot = (((position + offset) % cycle) + cycle) % cycle
      next.push({
        name: shuffled[slot],
        slot,
        inBlocks: offset,
        current: offset === 0
      })
    }
  }

  const normalizedAccount = normalizeAccount(account)
  const accountIndex = normalizedAccount
    ? shuffled.findIndex(name => name.toLowerCase() === normalizedAccount)
    : -1
  const accountInRound = accountIndex >= 0
  let accountNext = null
  if (accountInRound && cycle > 0) {
    const inBlocks = (((accountIndex - position) % cycle) + cycle) % cycle
    accountNext = {
      name: shuffled[accountIndex],
      inBlocks,
      slot: accountIndex
    }
  }

  const missedById = {}
  for (const witness of Array.isArray(witnesses) ? witnesses : []) {
    const owner = String(witness?.owner || '').trim()
    if (!owner) continue
    missedById[owner] = Math.max(0, Math.floor(Number(witness.total_missed) || 0))
  }

  const stamp = Number(now)

  return {
    available,
    roundSize,
    headBlock,
    currentWitness,
    position,
    next,
    accountNext,
    accountInRound,
    missedById,
    updatedAt: Number.isFinite(stamp) ? stamp : Date.now()
  }
}

export default witnessRoundSummary
