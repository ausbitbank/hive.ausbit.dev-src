// Pure read model for the dashboard governance widget.
//
// The widget only needs a compact view of the DHF: how much of the daily budget
// is committed, which proposals are about to expire, the proposals a user chose
// to watch, and when their governance votes lapse. Everything here is derived
// from the existing proposal/governance helpers so the widget and the full
// proposals page agree on phases, funding and vote weight.

import {
  MAX_PLAUSIBLE_DAILY_HBD,
  assetAmount,
  dailyPayHbd,
  daysRemaining,
  isFunded,
  proposalPhase,
  voteValueHp
} from './proposals'
import { governanceVoteExpiry } from './governance'

const RETURN_PROPOSAL_ID = 0
const STABILIZER_RECEIVER = 'hbdstabilizer'
const EXPIRY_WINDOW_DAYS = 30

function idSet (ids) {
  if (ids instanceof Set) {
    return new Set([...ids].map(Number).filter(Number.isFinite))
  }
  return new Set((Array.isArray(ids) ? ids : [])
    .map(Number)
    .filter(Number.isFinite))
}

function capOf (limit) {
  const value = Number(limit)
  if (!Number.isFinite(value)) return 4
  return Math.max(0, Math.floor(value))
}

function proposalRow (proposal, now, returnVotes, votedIds) {
  const id = Number(proposal?.id)
  const daysLeft = Math.max(0, daysRemaining(proposal, now))
  const dailyPay = dailyPayHbd(proposal)
  return {
    id,
    subject: String(proposal?.subject || '').trim() || 'Proposal #' + id,
    daysLeft,
    dailyPayHbd: dailyPay,
    outlier: dailyPay > MAX_PLAUSIBLE_DAILY_HBD,
    funded: isFunded(proposal, returnVotes),
    phase: proposalPhase(proposal, now),
    voted: votedIds ? votedIds.has(id) : false,
    url: '/proposals/' + id
  }
}

function voteExpirySummary (account, now) {
  const expiry = governanceVoteExpiry(account, now)
  const available = Boolean(account) && expiry.expiresAt !== null
  if (!available) {
    return { available: false, daysLeft: null, label: '', expiring: false, expiresAt: null }
  }

  const days = Math.ceil(expiry.daysLeft)
  let daysLeft = days
  let label
  if (days < 0) {
    daysLeft = 0
    label = 'Your governance votes have expired.'
  } else if (days === 0) {
    daysLeft = 0
    label = 'Your governance votes expire today.'
  } else {
    label = 'Your governance votes expire in ' + days + (days === 1 ? ' day.' : ' days.')
  }

  return {
    available: true,
    daysLeft,
    label,
    expiring: Boolean(expiry.expiring),
    expiresAt: expiry.expiresAt
  }
}

/**
 * Summarise DHF funding, upcoming proposal expiries, a personal watchlist and
 * governance vote expiry.
 *
 * `dailyCommitted` deliberately excludes the return proposal (the funding
 * threshold, not a payment) and the HBD stabilizer (a market operation rather
 * than a grant), matching how the proposals page reports funded daily pay.
 * `dailyUnfunded` is the daily amount requested by active proposals that are
 * still below the return proposal.
 */
export function governanceWatchSummary ({
  proposals = [],
  account = null,
  globalProps = null,
  fundHbdBalance = 0,
  watchlist = [],
  limit = 4,
  now = Date.now(),
  votedIds = null
} = {}) {
  const list = Array.isArray(proposals) ? proposals : []
  const cap = capOf(limit)
  const watchIds = (Array.isArray(watchlist) ? watchlist : []).map(Number).filter(Number.isFinite)
  const voted = idSet(votedIds)
  const time = Number(now)
  const currentTime = Number.isFinite(time) ? time : Date.now()

  const returnProposal = list.find(proposal => Number(proposal?.id) === RETURN_PROPOSAL_ID)
  const returnVotes = Number(returnProposal?.total_votes) || 0

  let activeCount = 0
  let fundedCount = 0
  let unfundedCount = 0
  let outlierCount = 0
  let expiringSoonCount = 0
  let dailyCommitted = 0
  let dailyUnfunded = 0
  const active = []

  for (const proposal of list) {
    if (proposalPhase(proposal, currentTime) !== 'active') continue
    activeCount += 1
    active.push(proposal)

    const id = Number(proposal?.id)
    if (id === RETURN_PROPOSAL_ID) continue

    const daysLeft = daysRemaining(proposal, currentTime)
    if (daysLeft >= 0 && daysLeft <= EXPIRY_WINDOW_DAYS) expiringSoonCount += 1

    const daily = dailyPayHbd(proposal)
    if (daily > MAX_PLAUSIBLE_DAILY_HBD) {
      outlierCount += 1
      continue
    }

    const funded = isFunded(proposal, returnVotes)
    if (funded) fundedCount += 1
    else unfundedCount += 1

    if (proposal?.receiver === STABILIZER_RECEIVER) continue
    if (funded) dailyCommitted += daily
    else dailyUnfunded += daily
  }

  const expiring = active
    .filter(proposal => {
      const id = Number(proposal?.id)
      if (id === RETURN_PROPOSAL_ID) return false
      const daysLeft = daysRemaining(proposal, currentTime)
      return daysLeft >= 0 && daysLeft <= EXPIRY_WINDOW_DAYS
    })
    .sort((a, b) => {
      const diff = daysRemaining(a, currentTime) - daysRemaining(b, currentTime)
      if (diff !== 0) return diff
      return Number(a?.id || 0) - Number(b?.id || 0)
    })
    .slice(0, cap)
    .map(proposal => proposalRow(proposal, currentTime, returnVotes, voted))

  const byId = new Map(list.map(proposal => [Number(proposal?.id), proposal]))
  const watched = []
  const seen = new Set()
  for (const id of watchIds) {
    if (watched.length >= cap) break
    if (seen.has(id)) continue
    seen.add(id)
    const proposal = byId.get(id)
    if (proposal) watched.push(proposalRow(proposal, currentTime, returnVotes, voted))
  }

  const budget = Math.max(0, assetAmount(fundHbdBalance))
  const voteExpiry = voteExpirySummary(account, currentTime)

  return {
    dailyBudget: budget / 100,
    dailyCommitted,
    dailyUnfunded,
    dailyGap: Math.max(0, budget / 100 - dailyCommitted),
    projected30Days: dailyCommitted * 30,
    activeCount,
    fundedCount,
    unfundedCount,
    outlierCount,
    expiringSoonCount,
    expiring,
    watchlist: watched,
    returnVotes,
    returnHp: voteValueHp({ total_votes: returnVotes }, globalProps),
    voteExpiry,
    hasAccount: Boolean(account),
    hasFund: budget > 0,
    hasProposals: list.length > 0
  }
}

export default governanceWatchSummary
