// Vote value and voting-power helpers shared by the account menu and tests.
//
// The estimate mirrors the condenser formula: a 100% vote spends 1/50 of the
// current voting power, and rshares convert to HIVE through the post reward
// fund. The result is an estimate, not a promise of the payout.

import { accountEffectiveVests, parseAmount } from './witnesses'
import { medianPrice } from './network'

/** Regeneration is 20% of the bar per day (100% in five days). */
export const VP_REGEN_PERCENT_PER_DAY = 20

export function estimateVoteValueUsd ({
  account,
  rewardFund,
  medianHistory,
  votingPower = 100,
  weight = 10000
} = {}) {
  const vests = accountEffectiveVests(account)
  const recentClaims = parseAmount(rewardFund?.recent_claims)
  const rewardBalance = parseAmount(rewardFund?.reward_balance)
  const hiveUsd = medianPrice(medianHistory).hiveUsd
  const vp = Math.max(0, Math.min(100, Number(votingPower) || 0))
  const voteWeight = Math.max(0, Math.min(10000, Number(weight) || 0))
  if (!vests || !recentClaims || !rewardBalance || !hiveUsd || !vp || !voteWeight) return 0
  const rshares = 2 * vp * vests * (voteWeight / 10000)
  return (rshares / recentClaims) * rewardBalance * hiveUsd
}

/** Seconds until the voting bar reaches 100%. */
export function vpRechargeSeconds (votingPower) {
  const vp = Math.max(0, Math.min(100, Number(votingPower) || 0))
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
