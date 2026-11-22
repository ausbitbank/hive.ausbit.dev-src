// Pure data shaping for the account-vitals dashboard widget.
//
// The widget fetches the account, resource credits, post reward fund and price
// feed, then hands the raw records here. Keeping the maths in one deterministic
// function means the widget is layout-only and the numbers can be unit tested.
//
// This module intentionally has no Vue imports and no timers.

import { estimateVoteValueUsd, formatRecharge, vpRechargeSeconds } from './voteValue'
import { formatHp, parseAmount, vestsToHp } from './witnesses'
import { medianPrice } from './network'

// Protocol approximations used by `components/rc.vue`. Hive does not expose a
// stable per-operation RC price, so these stay approximate and are labelled as
// such in the UI.
const RC_COST_APPROXIMATIONS = {
  comment: 1175937456,
  vote: 109514642,
  transfer: 487237759,
  claimAccount: 8541343515163
}

const VOTING_POWER_REGEN_BLOCKS = 432000

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Parse a Hive timestamp, which usually has no timezone suffix. */
function parseChainTime (value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let text = String(value).trim()
  if (!text) return null
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(text)) text += 'Z'
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : null
}

function percentLabel (percent) {
  return Number.isFinite(percent) ? percent.toFixed(2) + '%' : '—'
}

function unavailableVotingPower () {
  return {
    percent: null,
    label: '—',
    fullInSeconds: null,
    fullInLabel: '—',
    status: 'unavailable'
  }
}

function votingPowerSummary (account, now) {
  if (!account) return unavailableVotingPower()
  const base = Number(account.voting_power)
  if (!Number.isFinite(base)) return unavailableVotingPower()

  const lastVote = parseChainTime(account.last_vote_time)
  const secondsSince = lastVote === null
    ? 0
    : Math.max(0, (Number(now) - lastVote) / 1000)
  const raw = base + (10000 * secondsSince) / VOTING_POWER_REGEN_BLOCKS
  const percent = clamp(raw / 100, 0, 100)
  const fullInSeconds = vpRechargeSeconds(percent)

  return {
    percent,
    label: percentLabel(percent),
    fullInSeconds,
    fullInLabel: formatRecharge(fullInSeconds),
    status: percent >= 99.995 ? 'full' : percent < 50 ? 'low' : 'healthy'
  }
}

function effectiveVests (account) {
  if (!account) return 0
  return Math.max(0,
    parseAmount(account.vesting_shares) +
    parseAmount(account.received_vesting_shares) -
    parseAmount(account.delegated_vesting_shares) -
    parseAmount(account.vesting_withdraw_rate)
  )
}

function downvoteSummary (account) {
  const current = Number(account?.downvote_manabar?.current_mana)
  const max = (effectiveVests(account) / 4) * 1e4
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return { percent: null, label: '—' }
  }
  const percent = clamp((current / max) * 100, 0, 100)
  return { percent, label: percentLabel(percent) }
}

function compactBudget (available, cost) {
  const operations = available / cost
  if (!Number.isFinite(operations) || operations <= 0) return '0'
  if (operations >= 1e6) return '1M+'
  return Math.round(operations).toLocaleString('en-US')
}

function rcSummary (rc) {
  const max = Number(rc?.max_rc)
  const available = Number(rc?.rc_manabar?.current_mana)
  if (!Number.isFinite(max) || !Number.isFinite(available) || max <= 0) {
    return {
      percent: null,
      label: '—',
      status: 'unavailable',
      available: 0,
      max: 0,
      budget: { comments: '—', votes: '—', transfers: '—', claimAccounts: '—' }
    }
  }

  const percent = clamp((available / max) * 100, 0, 100)
  return {
    percent,
    label: percentLabel(percent),
    status: percent >= 99.995
      ? 'full'
      : percent <= 10
        ? 'critical'
        : percent <= 30
          ? 'low'
          : 'healthy',
    available,
    max,
    budget: {
      comments: compactBudget(available, RC_COST_APPROXIMATIONS.comment),
      votes: compactBudget(available, RC_COST_APPROXIMATIONS.vote),
      transfers: compactBudget(available, RC_COST_APPROXIMATIONS.transfer),
      claimAccounts: compactBudget(available, RC_COST_APPROXIMATIONS.claimAccount)
    }
  }
}

function priceUsd (prices, median) {
  const quoted = Number(prices?.hive?.usd)
  if (Number.isFinite(quoted) && quoted > 0) return quoted
  return medianPrice(median).hiveUsd
}

function usdText (value) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value < 0.01) return '<$0.01'
  return '$' + value.toFixed(value < 1 ? 3 : 2)
}

function voteValueSummary ({ account, rewardFund, median, prices, votingPower }) {
  const usd = estimateVoteValueUsd({
    account,
    rewardFund,
    medianHistory: median,
    votingPower: votingPower.percent === null ? 0 : votingPower.percent,
    weight: 10000
  })
  const hiveUsd = priceUsd(prices, median)
  const hive = hiveUsd > 0 ? usd / hiveUsd : 0

  if (!Number.isFinite(usd) || usd <= 0) {
    return {
      usd: 0,
      hive: 0,
      label: '—',
      weight: 10000,
      available: false
    }
  }

  const hiveLabel = hive > 0 ? ' · ' + hive.toFixed(3) + ' HIVE' : ''
  return {
    usd,
    hive,
    label: '≈ ' + usdText(usd) + hiveLabel,
    weight: 10000,
    available: true
  }
}

function hpSummary (account, globalProps) {
  const ownedVests = parseAmount(account?.vesting_shares)
  const receivedVests = parseAmount(account?.received_vesting_shares)
  const delegatedVests = parseAmount(account?.delegated_vesting_shares)
  // `vesting_withdraw_rate` is the weekly amount leaving the account.
  const powerdownVests = parseAmount(account?.vesting_withdraw_rate)
  const effectiveVests = Math.max(0, ownedVests + receivedVests - delegatedVests - powerdownVests)

  const owned = vestsToHp(ownedVests, globalProps)
  const received = vestsToHp(receivedVests, globalProps)
  const delegated = vestsToHp(delegatedVests, globalProps)
  const powerdown = vestsToHp(powerdownVests, globalProps)
  const effective = vestsToHp(effectiveVests, globalProps)

  return {
    owned,
    received,
    delegated,
    powerdown,
    effective,
    label: formatHp(effective, 2)
  }
}

/**
 * Summarise everything the account-vitals widget shows.
 *
 * Every input is optional: a missing account, global properties, RC record,
 * reward fund, median feed or price table returns safe zero/`unavailable`
 * values instead of throwing.
 */
export function accountVitalsSummary ({
  account = null,
  globalProps = null,
  rc = null,
  rewardFund = null,
  median = null,
  prices = null,
  now = Date.now()
} = {}) {
  const accountName = account?.name || ''
  const votingPower = votingPowerSummary(account, now)

  return {
    accountName,
    votingPower,
    downvote: downvoteSummary(account),
    rc: rcSummary(rc),
    voteValue: voteValueSummary({
      account,
      rewardFund,
      median,
      prices,
      votingPower
    }),
    hp: hpSummary(account, globalProps),
    hasAccount: Boolean(account)
  }
}

export default accountVitalsSummary
