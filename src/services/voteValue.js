// Vote value and voting-power helpers shared by the account menu, the
// downvote transparency page and tests.
//
// The estimate mirrors the chain's vote evaluation: a 100% vote spends 2% of
// the manabar and rshares convert to HIVE through the post reward fund. The
// result is an estimate, not a promise of the payout.
//
// Hive's `vesting_shares` are whole VESTS while the chain's manabars and
// rshares use micro-VESTS, so the manabar value below has to be scaled by 1e6
// before applying the 2% spend.

import { accountEffectiveVests, parseAmount } from './witnesses'
import { medianPrice } from './network'

/** Regeneration is 20% of the bar per day (100% in five days). */
export const VP_REGEN_PERCENT_PER_DAY = 20

/** HF21 downvote pool: 25% of the upvote manabar. */
export const DOWNVOTE_POOL_PERCENT = 25

/** A 100% vote spends 1/50 (2%) of the applicable manabar. */
export const VOTE_MANA_SPEND_PERCENT = 2

function clamp (value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

/**
 * rshares for a vote at `votingPower` percent and `weight` basis points.
 *
 * `votingPower` is a percentage of a full manabar (0-100). Downvotes pass the
 * equivalent downvote-pool percentage, which makes the same formula valid.
 */
export function estimateVoteRshares ({ account, votingPower = 100, weight = 10000 } = {}) {
  const vests = accountEffectiveVests(account)
  const vp = clamp(votingPower, 0, 100)
  const voteWeight = clamp(weight, 0, 10000)
  if (!vests || !vp || !voteWeight) return 0
  const microVests = vests * 1e6
  return (VOTE_MANA_SPEND_PERCENT / 100) * (vp / 100) * microVests * (voteWeight / 10000)
}

/** Convert rshares to an estimated USD reward using the post reward fund. */
export function rsharesToUsd (rshares, rewardFund = null, medianHistory = null) {
  const claims = Math.abs(Number(rshares) || 0)
  const recentClaims = parseAmount(rewardFund?.recent_claims)
  const rewardBalance = parseAmount(rewardFund?.reward_balance)
  const hiveUsd = medianPrice(medianHistory).hiveUsd
  if (!claims || !recentClaims || !rewardBalance || !hiveUsd) return 0
  return (claims / recentClaims) * rewardBalance * hiveUsd
}

export function estimateVoteValueUsd ({
  account,
  rewardFund,
  medianHistory,
  votingPower = 100,
  weight = 10000
} = {}) {
  return rsharesToUsd(
    estimateVoteRshares({ account, votingPower, weight }),
    rewardFund,
    medianHistory
  )
}

/**
 * Equivalent upvote-power percentage for a downvote.
 *
 * A downvote uses the larger of the downvote pool (25% of the upvote bar,
 * scaled back to a full manabar) and the upvote manabar, matching the chain's
 * `max(downvote_mana * 100 / downvote_pool_percent, voting_mana)` rule.
 */
export function downvotePowerPercent (account, downvotePoolPercent = DOWNVOTE_POOL_PERCENT) {
  const vests = accountEffectiveVests(account)
  if (!vests) return 0
  const max = vests * 1e6
  const upMana = Number(account?.voting_manabar?.current_mana)
  const downMana = Number(account?.downvote_manabar?.current_mana)
  const pool = Number(downvotePoolPercent)
  const scale = Number.isFinite(pool) && pool > 0 && pool <= 100 ? 100 / pool : 4
  const candidates = []
  if (Number.isFinite(downMana)) candidates.push(downMana * scale)
  if (Number.isFinite(upMana)) candidates.push(upMana)
  if (!candidates.length) return 0
  return clamp((Math.max(0, ...candidates) / max) * 100, 0, 100)
}

/**
 * Estimate a downvote's rshares and USD impact at the voter's current stake
 * and mana. History vote rows carry only the signed weight, so the mana at the
 * time of the vote cannot be recovered from the chain read alone.
 */
export function estimateDownvoteValueUsd ({
  account,
  rewardFund,
  medianHistory,
  weight = 10000,
  downvotePoolPercent = DOWNVOTE_POOL_PERCENT
} = {}) {
  const rshares = estimateVoteRshares({
    account,
    votingPower: downvotePowerPercent(account, downvotePoolPercent),
    weight
  })
  return {
    rshares,
    usd: rsharesToUsd(rshares, rewardFund, medianHistory)
  }
}

/** Seconds until the voting bar reaches 100%. */
export function vpRechargeSeconds (votingPower) {
  const vp = clamp(votingPower, 0, 100)
  if (vp >= 100) return 0
  return ((100 - vp) / VP_REGEN_PERCENT_PER_DAY) * 24 * 60 * 60
}

/** Compact duration such as "2d 4h" or "18m". */
export function formatRecharge (seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total === 0) return 'full'
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return days + 'd ' + hours + 'h'
  if (hours > 0) return hours + 'h ' + minutes + 'm'
  return Math.max(1, Math.round(total / 60)) + 'm'
}

export function formatVoteValue (value, symbol = '$') {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '—'
  if (number < 0.01) return '<' + symbol + '0.01'
  return symbol + number.toFixed(number < 1 ? 3 : 2)
}
