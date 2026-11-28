// Decentralized Hive Fund (DHF) proposal helpers and API wrappers.
//
// The list endpoint returns every proposal (a few hundred) in one call, so the
// list page loads once and filters/sorts locally. The helpers below are pure
// (apart from the API wrappers) and are shared by the list card and the
// proposal detail page.
import hive from './hive'
import { loadCached } from './cache'
import { vestsToHive } from './wallet'
import moment from '../utils/time'

const DAY_MS = 24 * 60 * 60 * 1000
const RETURN_PROPOSAL_ID = 0
const STABILIZER_RECEIVER = 'hbdstabilizer'

// A daily request above this is not a plausible DHF grant. Spam proposals can
// ask for ~1e15 HBD/day; including them would overflow the funding totals and
// make the real budget unreadable. Keep them visible as outliers, never in sums.
export const MAX_PLAUSIBLE_DAILY_HBD = 1_000_000

// `database_api.*` returns typed assets (`{ amount, precision }`) while the
// condenser endpoints used by the store return strings ("12.345 HBD"). Accept
// both so helpers work with either source.
export function assetAmount (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === 'object' && value.amount !== undefined) {
    const amount = Number(value.amount)
    if (!Number.isFinite(amount)) return 0
    const precision = Number(value.precision)
    return amount / Math.pow(10, Number.isFinite(precision) ? precision : 3)
  }
  return 0
}

export function dailyPayHbd (proposal) {
  return assetAmount(proposal?.daily_pay)
}

function numericVotes (proposal) {
  const votes = Number(proposal?.total_votes)
  return Number.isFinite(votes) ? votes : 0
}

// Vote weight is stored as micro-VESTS. Convert to HP using the chain's
// total vesting shares/fund. Returns 0 until global props are loaded.
export function voteValueHp (proposal, globalProps) {
  const votes = numericVotes(proposal)
  if (!votes || !globalProps) return 0

  const totalVestingShares = assetAmount(globalProps.total_vesting_shares)
  const totalVestingFund = assetAmount(globalProps.total_vesting_fund_hive)
  if (!totalVestingShares || !totalVestingFund) return 0

  return vestsToHive(votes, totalVestingShares, totalVestingFund) / 1e6
}

function toTime (value) {
  if (!value) return null
  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

export function daysTotal (proposal) {
  const start = toTime(proposal?.start_date)
  const end = toTime(proposal?.end_date)
  if (start === null || end === null) return 0
  return Math.max(0, Math.ceil((end - start) / DAY_MS))
}

// Elapsed/remaining are derived from the same whole-day total so the two
// projections never add up to more than the requested duration.
export function daysElapsed (proposal, now = new Date()) {
  const total = daysTotal(proposal)
  const start = toTime(proposal?.start_date)
  const time = toTime(now)
  if (start === null || time === null || total === 0) return 0
  const elapsed = Math.floor((time - start) / DAY_MS)
  return Math.min(total, Math.max(0, elapsed))
}

export function daysRemaining (proposal, now = new Date()) {
  return daysTotal(proposal) - daysElapsed(proposal, now)
}

/** Whole days until an upcoming proposal's start; 0 once it has started. */
export function daysUntilStart (proposal, now = new Date()) {
  const start = toTime(proposal?.start_date)
  const time = toTime(now)
  if (start === null || time === null || start <= time) return 0
  return (start - time) / DAY_MS
}

export function paidHbd (proposal, now = new Date()) {
  return dailyPayHbd(proposal) * daysElapsed(proposal, now)
}

export function toPayHbd (proposal, now = new Date()) {
  return dailyPayHbd(proposal) * daysRemaining(proposal, now)
}

// The return proposal itself is the funding threshold, so treat it as part of
// the funded section. Normal proposals are funded when they gather at least as
// much stake as the return proposal.
export function isFunded (proposal, returnVotes) {
  if (Number(proposal?.id) === RETURN_PROPOSAL_ID) return true
  const threshold = Number(returnVotes)
  if (!Number.isFinite(threshold) || threshold <= 0) return false
  return numericVotes(proposal) >= threshold
}

export function proposalPhase (proposal, now = new Date()) {
  const status = String(proposal?.status || '').toLowerCase()
  const start = toTime(proposal?.start_date)
  const end = toTime(proposal?.end_date)
  const time = toTime(now)

  if (time === null) return 'active'
  if (status === 'expired' || (end !== null && time > end)) return 'expired'
  if (status === 'inactive' || (start !== null && time < start)) return 'upcoming'
  return 'active'
}

export function proposalStatus (proposal, returnVotes, now = new Date()) {
  if (Number(proposal?.id) === RETURN_PROPOSAL_ID) {
    return { label: 'Return proposal', color: 'purple' }
  }
  const phase = proposalPhase(proposal, now)
  if (phase === 'expired') return { label: 'Expired', color: 'grey' }
  if (phase === 'upcoming') return { label: 'Upcoming', color: 'blue' }
  return isFunded(proposal, returnVotes)
    ? { label: 'Funded', color: 'green' }
    : { label: 'Active', color: 'orange' }
}

const SORT_KEYS = {
  votes: 'votes',
  daily: 'daily',
  daily_pay: 'daily',
  newest: 'newest',
  ending: 'ending',
  ending_soon: 'ending'
}

export function sortProposals (proposals = [], sort = 'votes') {
  const key = SORT_KEYS[sort] || 'votes'
  return [...proposals].sort((a, b) => {
    if (key === 'daily') {
      const diff = dailyPayHbd(b) - dailyPayHbd(a)
      if (diff !== 0) return diff
      return numericVotes(b) - numericVotes(a)
    }
    if (key === 'newest') {
      const diff = (toTime(b?.start_date) || 0) - (toTime(a?.start_date) || 0)
      if (diff !== 0) return diff
      return numericVotes(b) - numericVotes(a)
    }
    if (key === 'ending') {
      const aPhase = proposalPhase(a)
      const bPhase = proposalPhase(b)
      const aExpired = aPhase === 'expired' ? 1 : 0
      const bExpired = bPhase === 'expired' ? 1 : 0
      if (aExpired !== bExpired) return aExpired - bExpired

      const aEnd = toTime(a?.end_date) || 0
      const bEnd = toTime(b?.end_date) || 0
      if (aEnd !== bEnd) return aExpired ? bEnd - aEnd : aEnd - bEnd
      return numericVotes(b) - numericVotes(a)
    }
    const diff = numericVotes(b) - numericVotes(a)
    if (diff !== 0) return diff
    return Number(a?.id || 0) - Number(b?.id || 0)
  })
}

export function filterProposals (proposals = [], { tab = 'all', search = '', votedIds = null } = {}) {
  let filtered = proposals

  if (tab === 'active' || tab === 'upcoming' || tab === 'expired') {
    filtered = filtered.filter(proposal => proposalPhase(proposal) === tab)
  } else if (tab === 'voted') {
    if (!votedIds) return []
    const ids = votedIds instanceof Set ? votedIds : new Set(votedIds)
    filtered = filtered.filter(proposal => ids.has(Number(proposal?.id)))
  }

  const query = String(search || '').trim().toLowerCase()
  if (query) {
    filtered = filtered.filter(proposal => {
      return String(proposal?.subject || '').toLowerCase().includes(query) ||
        String(proposal?.creator || '').toLowerCase().includes(query) ||
        String(proposal?.receiver || '').toLowerCase().includes(query) ||
        String(proposal?.permlink || '').toLowerCase().includes(query) ||
        String(proposal?.id || '') === query
    })
  }

  return filtered
}

// Funding context for the stats strip. `globalProps` is accepted for symmetry
// with the other helpers; the fund balance comes from the `hive.fund` account
// and must be passed in options (it is not part of global props).
export function fundingSummary (proposals = [], _globalProps = null, options = {}) {
  const list = Array.isArray(proposals) ? proposals : []
  const opts = options && typeof options === 'object' ? options : {}
  const now = opts.now ? new Date(opts.now) : new Date()

  let returnVotes = Number(opts.returnVotes)
  if (!Number.isFinite(returnVotes) || returnVotes <= 0) {
    const returnProposal = list.find(proposal => Number(proposal?.id) === RETURN_PROPOSAL_ID)
    returnVotes = numericVotes(returnProposal)
  }

  let dailyFunded = 0
  let hbdStabilizerDaily = 0
  let activeCount = 0

  for (const proposal of list) {
    if (proposalPhase(proposal, now) !== 'active') continue
    activeCount += 1

    if (Number(proposal?.id) === RETURN_PROPOSAL_ID) continue

    const daily = dailyPayHbd(proposal)
    if (proposal?.receiver === STABILIZER_RECEIVER) {
      hbdStabilizerDaily += daily
      continue
    }
    if (isFunded(proposal, returnVotes)) dailyFunded += daily
  }

  const totalBudget = assetAmount(opts.fundHbdBalance ?? opts.fundBalance ?? 0)

  return {
    dailyFunded,
    hbdStabilizerDaily,
    maxDailyBudget: totalBudget / 100,
    totalBudget,
    returnVotes,
    activeCount
  }
}

function numberFormatter (digits) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits })
}

const FORMAT_0 = numberFormatter(0)
const FORMAT_1 = numberFormatter(1)
const FORMAT_2 = numberFormatter(2)
const FORMAT_3 = numberFormatter(3)

export function formatNumber (value, maximumFractionDigits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  const digits = Math.min(3, Math.max(0, Number(maximumFractionDigits) || 0))
  const formatter = digits === 0 ? FORMAT_0 : digits === 1 ? FORMAT_1 : digits === 2 ? FORMAT_2 : FORMAT_3
  return formatter.format(number)
}

export function formatHbd (value) {
  return formatNumber(value, 2)
}

export function formatHp (value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return formatNumber(number, Math.abs(number) >= 100 ? 0 : 2)
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------


// Proposal votes are an active-authority operation (`update_proposal_votes`
// declares get_required_active_authorities in Hive core). Centralise the queue
// item so both the list and detail pages cannot accidentally use posting.
export function proposalVoteQueueItem (username, proposalId, approve) {
  return [
    username,
    'active',
    ['update_proposal_votes', {
      voter: username,
      proposal_ids: [Number(proposalId)],
      approve: Boolean(approve),
      extensions: []
    }]
  ]
}

export async function listProposals (options = {}) {
  const {
    limit = 1000,
    order = 'by_total_votes',
    orderDirection = 'descending',
    status = 'all',
    force = false
  } = options

  return loadCached('proposals:list:' + [limit, order, orderDirection, status].join(':'), async () => {
    const response = await hive.api.callAsync('database_api.list_proposals', {
      start: ['-1'],
      limit,
      order,
      order_direction: orderDirection,
      status
    })
    return response?.proposals || []
  }, { ttl: 60 * 1000, force })
}

export async function findProposal (id) {
  const proposalId = Number(id)
  if (!Number.isInteger(proposalId) || proposalId < 0) return null

  const response = await hive.api.callAsync('database_api.find_proposals', {
    proposal_ids: [proposalId]
  })
  return response?.proposals?.[0] || null
}

export async function listProposalVotes (id, options = {}) {
  const proposalId = Number(id)
  if (!Number.isInteger(proposalId) || proposalId < 0) return []

  const { limit = 1000 } = options
  const response = await hive.api.callAsync('database_api.list_proposal_votes', {
    start: [proposalId],
    limit,
    order: 'by_proposal_voter',
    order_direction: 'ascending',
    status: 'all'
  })
  // `list_proposal_votes` paginates past the requested proposal. Keep only the
  // rows for this proposal instead of attributing the next proposals' voters.
  return (response?.proposal_votes || []).filter(vote => {
    const voteId = Number(vote?.proposal?.id ?? vote?.proposal?.proposal_id)
    return voteId === proposalId
  })
}

// Returns a Set of proposal ids the account has voted for (up to 1000, which
// covers every current proposal). The endpoint paginates past the requested
// voter, so rows for other voters are filtered out.
export async function getVoterVoteIds (username, options = {}) {
  if (!username) return new Set()

  const { limit = 1000 } = options
  const response = await hive.api.callAsync('database_api.list_proposal_votes', {
    start: [username],
    limit,
    order: 'by_voter_proposal',
    order_direction: 'ascending',
    status: 'all'
  })

  const target = String(username).trim().replace(/^@/, '').toLowerCase()
  const ids = new Set()
  const votes = response?.proposal_votes || []
  votes.forEach(vote => {
    if (String(vote?.voter || '').trim().replace(/^@/, '').toLowerCase() !== target) return
    const id = Number(vote?.proposal?.id ?? vote?.proposal?.proposal_id)
    if (Number.isInteger(id)) ids.add(id)
  })
  return ids
}

export async function getProposalPost (author, permlink, observer) {
  if (!author || !permlink) return null
  const params = { author, permlink }
  if (observer) params.observer = observer
  return hive.api.callAsync('bridge.get_post', params)
}
