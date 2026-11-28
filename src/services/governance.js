// Read-only analytics for witnesses, DHF proposals and community governance.
//
// Everything here is pure so the pages can render the same numbers from tests
// without mounting Vue or touching the network. API calls stay in the small
// service modules that own them (`witnesses.js`, `proposals.js`,
// `delegations.js`, `community.js`).

import {
  CONSENSUS_WITNESSES,
  parseAmount,
  vestsToHp,
  witnessVotesHp,
  versionParts
} from './witnesses'
import moment from '../utils/time'
import {
  MAX_PLAUSIBLE_DAILY_HBD,
  dailyPayHbd,
  isFunded,
  paidHbd,
  proposalPhase,
  toPayHbd,
  voteValueHp
} from './proposals'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const FEED_FRESH_HOURS = 6
export const FEED_AGING_HOURS = 24
export const GOVERNANCE_VOTE_WARNING_DAYS = 30

const TOPIC_KEYWORDS = [
  ['development', ['develop', 'code', 'coding', 'software', 'api', 'sdk', 'bug', 'engineer', 'programming', 'github', 'release', 'app']],
  ['infrastructure', ['infrastructure', 'node', 'server', 'rpc', 'hosting', 'seed', 'validator', 'network', 'haf', 'database', 'indexer']],
  ['marketing', ['marketing', 'promotion', 'growth', 'advertis', 'campaign', 'brand', 'outreach', 'social media']],
  ['community', ['community', 'moderator', 'curation', 'meetup', 'event', 'ambassador', 'onboarding', 'welcome', 'engagement']],
  ['education', ['education', 'tutorial', 'documentation', 'docs', 'course', 'learn', 'guide', 'workshop', 'translation', 'translate']],
  ['content', ['content', 'writer', 'writing', 'journal', 'blog', 'video', 'podcast', 'music', 'art', 'artist', 'photograph']],
  ['governance', ['governance', 'proposal', 'witness', 'dao', 'dhf', 'treasury', 'policy', 'vote', 'decentraliz']],
  ['security', ['security', 'audit', 'exploit', 'vulnerab', 'phishing', 'safe', 'protect']]
]

function safeNumber (value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function share (part, total) {
  return total > 0 ? part / total : 0
}

function timeValue (value) {
  if (!value) return null
  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

function startOfMonthUtc (date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

function addMonthsUtc (timestamp, months) {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
}

function monthLabel (timestamp) {
  return new Date(timestamp).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function daysInMonth (timestamp) {
  const date = new Date(timestamp)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

function percentage (value) {
  return clamp(value, 0, 100)
}

/**
 * Vote concentration for the witness set.
 *
 * Returns the stake share held by the top 21 witnesses (the consensus set) and
 * the top 50, the Herfindahl-Hirschman index (0-10000) and the Gini
 * coefficient. High values mean approval stake is clustered in few witnesses,
 * which is useful context when reviewing the health of the consensus set.
 */
export function witnessVoteConcentration (witnesses, globalProps) {
  const rows = (Array.isArray(witnesses) ? witnesses : [])
    .map(witness => ({
      owner: witness.owner || '',
      rank: safeNumber(witness.rank),
      votes: safeNumber(witness.votes),
      hp: witnessVotesHp(witness.votes, globalProps)
    }))
    .filter(row => row.owner && row.hp > 0)
    .sort((a, b) => b.hp - a.hp)

  const totalHp = rows.reduce((sum, row) => sum + row.hp, 0)
  const top = count => rows.slice(0, count).reduce((sum, row) => sum + row.hp, 0)
  const topConsensusHp = top(CONSENSUS_WITNESSES)
  const top50Hp = top(50)

  let squaredShare = 0
  for (const row of rows) {
    const value = share(row.hp, totalHp)
    squaredShare += value * value
  }

  // Gini over the approval-stake distribution. Sorted ascending, the standard
  // formula is sum((2i - n - 1) * x_i) / (n * sum(x)).
  const ascending = rows.slice().sort((a, b) => a.hp - b.hp)
  let weighted = 0
  ascending.forEach((row, index) => {
    weighted += (2 * (index + 1) - ascending.length - 1) * row.hp
  })
  const gini = ascending.length > 1 && totalHp > 0
    ? weighted / (ascending.length * totalHp)
    : 0

  const cutoffIndex = Math.min(CONSENSUS_WITNESSES, rows.length) - 1
  const cutoff = cutoffIndex >= 0 ? rows[cutoffIndex] : null
  const nextOut = rows[cutoffIndex + 1]

  return {
    totalHp,
    topConsensusHp,
    topConsensusShare: share(topConsensusHp, totalHp),
    top50Hp,
    top50Share: share(top50Hp, totalHp),
    hhi: squaredShare * 10000,
    gini,
    consensusCount: Math.min(CONSENSUS_WITNESSES, rows.length),
    witnessCount: rows.length,
    cutoffHp: cutoff ? cutoff.hp : 0,
    nextOutHp: nextOut ? nextOut.hp : 0,
    cutoffGapHp: cutoff && nextOut ? Math.max(0, cutoff.hp - nextOut.hp) : 0,
    rows: rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      share: share(row.hp, totalHp)
    }))
  }
}

/**
 * Bucket witness price feeds by age so stale feeds are visible before they
 * become a missed-block or bad-median problem.
 */
export function feedFreshness (witnesses, now = Date.now()) {
  const buckets = { fresh: 0, aging: 0, stale: 0, missing: 0, total: 0 }
  const rows = []

  for (const witness of Array.isArray(witnesses) ? witnesses : []) {
    const updated = timeValue(witness?.last_hbd_exchange_update)
    // The chain uses 1969/1970 as "never updated"; that is a missing feed, not
    // a 56-year-old stale one.
    const ageHours = updated === null || updated <= 0 ? null : Math.max(0, (Number(now) - updated) / HOUR_MS)
    let bucket = 'missing'
    if (ageHours !== null) {
      if (ageHours <= FEED_FRESH_HOURS) bucket = 'fresh'
      else if (ageHours <= FEED_AGING_HOURS) bucket = 'aging'
      else bucket = 'stale'
    }
    buckets[bucket] += 1
    buckets.total += 1
    rows.push({
      owner: witness?.owner || '',
      ageHours,
      bucket,
      updatedAt: witness?.last_hbd_exchange_update || null
    })
  }

  rows.sort((a, b) => {
    if (a.ageHours === null && b.ageHours === null) return 0
    if (a.ageHours === null) return -1
    if (b.ageHours === null) return 1
    return b.ageHours - a.ageHours
  })

  return { ...buckets, rows }
}

/** Group running versions and list witnesses that trail the consensus version. */
export function versionDrift (witnesses, hardforkVersion = '') {
  const consensus = versionParts(hardforkVersion)
  const groups = new Map()
  const mismatched = []

  for (const witness of Array.isArray(witnesses) ? witnesses : []) {
    const version = String(witness?.running_version || '').replace(/^v/i, '') || 'unknown'
    if (!groups.has(version)) groups.set(version, { version, count: 0, owners: [] })
    const group = groups.get(version)
    group.count += 1
    if (group.owners.length < 8) group.owners.push(witness?.owner || '')

    const running = versionParts(version)
    const matches = consensus.length < 2 || running.length < 2
      ? true
      : running[0] === consensus[0] && running[1] === consensus[1]
    if (!matches) {
      mismatched.push({
        owner: witness?.owner || '',
        version,
        rank: safeNumber(witness?.rank)
      })
    }
  }

  return {
    consensusVersion: String(hardforkVersion || ''),
    groups: [...groups.values()].sort((a, b) => b.count - a.count || a.version.localeCompare(b.version)),
    mismatched,
    matching: (Array.isArray(witnesses) ? witnesses.length : 0) - mismatched.length,
    total: Array.isArray(witnesses) ? witnesses.length : 0
  }
}

/** Witnesses with the highest cumulative missed-block counters. */
export function missedBlockLeaders (witnesses, limit = 10) {
  return (Array.isArray(witnesses) ? witnesses : [])
    .map(witness => ({
      owner: witness?.owner || '',
      rank: safeNumber(witness?.rank),
      missed: safeNumber(witness?.total_missed),
      lastConfirmed: safeNumber(witness?.last_confirmed_block_num)
    }))
    .filter(row => row.owner)
    .sort((a, b) => b.missed - a.missed || a.owner.localeCompare(b.owner))
    .slice(0, Math.max(0, limit))
}

/** Infer coarse topic buckets from a proposal subject. */
export function inferTopics (subject) {
  const text = String(subject || '').toLowerCase()
  if (!text) return []
  const topics = []
  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some(keyword => text.includes(keyword))) topics.push(topic)
  }
  return topics
}

/**
 * Funding analytics for the DHF proposal set.
 *
 * The chain stores the current state of each proposal, not a full payment
 * ledger, so historical amounts are estimates from the payment window. The
 * outlook months project current funded proposals forward; they are labelled as
 * projections in the UI rather than presented as settled history.
 */
export function proposalFundingAnalytics (proposals, globalProps, options = {}) {
  const list = Array.isArray(proposals) ? proposals : []
  const now = options.now ? new Date(options.now) : new Date()
  const months = Math.max(1, Math.min(24, safeNumber(options.months, 12)))

  const active = list.filter(proposal => proposalPhase(proposal, now) === 'active')
  const returnProposal = list.find(proposal => Number(proposal?.id) === 0)
  const returnVotes = safeNumber(options.returnVotes, safeNumber(returnProposal?.total_votes))

  // Proposal #0 is the funding threshold, not a payment request. Spam requests
  // above the plausible cap are shown as outliers but never summed or ranked.
  const requestable = []
  let outlierCount = 0
  for (const proposal of list) {
    if (Number(proposal?.id) === 0) continue
    const daily = dailyPayHbd(proposal)
    if (daily > MAX_PLAUSIBLE_DAILY_HBD) outlierCount += 1
    else if (daily > 0) requestable.push(proposal)
  }
  const funded = requestable.filter(proposal =>
    proposalPhase(proposal, now) === 'active' && isFunded(proposal, returnVotes)
  )
  const expired = list.filter(proposal => proposalPhase(proposal, now) === 'expired')
  const upcoming = list.filter(proposal => proposalPhase(proposal, now) === 'upcoming')

  let dailyCommitted = 0
  let dailyRequested = 0
  let estimatedPaid = 0
  let remainingCommitted = 0

  for (const proposal of requestable) {
    if (proposalPhase(proposal, now) !== 'active') continue
    const daily = dailyPayHbd(proposal)
    dailyRequested += daily
    if (isFunded(proposal, returnVotes)) {
      dailyCommitted += daily
      remainingCommitted += toPayHbd(proposal, now)
    }
  }

  for (const proposal of requestable) {
    estimatedPaid += paidHbd(proposal, now)
  }

  const creators = new Map()
  const receivers = new Map()
  const topics = new Map()

  for (const proposal of requestable) {
    const creator = proposal?.creator || 'unknown'
    const receiver = proposal?.receiver || 'unknown'
    const daily = dailyPayHbd(proposal)
    if (!creators.has(creator)) creators.set(creator, { name: creator, count: 0, daily: 0 })
    if (!receivers.has(receiver)) receivers.set(receiver, { name: receiver, count: 0, daily: 0 })
    const creatorRow = creators.get(creator)
    const receiverRow = receivers.get(receiver)
    creatorRow.count += 1
    creatorRow.daily += daily
    receiverRow.count += 1
    receiverRow.daily += daily

    const inferred = inferTopics(proposal?.subject)
    for (const topic of inferred.length ? inferred : ['other']) {
      if (!topics.has(topic)) topics.set(topic, { topic, count: 0, daily: 0 })
      const topicRow = topics.get(topic)
      topicRow.count += 1
      topicRow.daily += daily
    }
  }

  const start = startOfMonthUtc(now)
  const monthlyOutlook = []
  for (let index = 0; index < months; index++) {
    const monthStart = addMonthsUtc(start, index)
    const monthEnd = addMonthsUtc(start, index + 1) - 1
    let daily = 0
    for (const proposal of funded) {
      const proposalStart = timeValue(proposal?.start_date)
      const proposalEnd = timeValue(proposal?.end_date)
      if (proposalStart !== null && proposalStart > monthEnd) continue
      if (proposalEnd !== null && proposalEnd < monthStart) continue
      daily += dailyPayHbd(proposal)
    }
    monthlyOutlook.push({
      start: monthStart,
      label: monthLabel(monthStart),
      daily,
      total: daily * daysInMonth(monthStart)
    })
  }

  const sortedCreators = [...creators.values()]
    .sort((a, b) => b.daily - a.daily || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
  const sortedReceivers = [...receivers.values()]
    .sort((a, b) => b.daily - a.daily || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
  const sortedTopics = [...topics.values()]
    .sort((a, b) => b.daily - a.daily || b.count - a.count || a.topic.localeCompare(b.topic))

  const peakDaily = monthlyOutlook.reduce((max, row) => Math.max(max, row.daily), 0)

  return {
    totalProposals: list.length,
    activeCount: active.length,
    fundedCount: funded.length,
    expiredCount: expired.length,
    upcomingCount: upcoming.length,
    outlierCount,
    creatorCount: creators.size,
    receiverCount: receivers.size,
    dailyCommitted,
    dailyRequested,
    dailyUnfunded: Math.max(0, dailyRequested - dailyCommitted),
    estimatedPaid,
    remainingCommitted,
    returnVotes,
    returnHp: voteValueHp({ total_votes: returnVotes }, globalProps),
    monthlyOutlook,
    peakDaily,
    creators: sortedCreators,
    receivers: sortedReceivers,
    topics: sortedTopics,
    projectedThirtyDays: dailyCommitted * 30,
    projectedNinetyDays: dailyCommitted * 90
  }
}

/**
 * Compare two voter lists. Small proposals routinely share voters with the
 * return proposal, so this is a useful signal of strategic voting.
 */
export function voteOverlap (votesA, votesB) {
  const namesA = new Set((Array.isArray(votesA) ? votesA : [])
    .map(vote => typeof vote === 'string' ? vote : vote?.voter)
    .filter(Boolean))
  const namesB = new Set((Array.isArray(votesB) ? votesB : [])
    .map(vote => typeof vote === 'string' ? vote : vote?.voter)
    .filter(Boolean))

  const shared = [...namesA].filter(name => namesB.has(name))
  const onlyA = [...namesA].filter(name => !namesB.has(name))
  const onlyB = [...namesB].filter(name => !namesA.has(name))
  const union = new Set([...namesA, ...namesB])

  return {
    countA: namesA.size,
    countB: namesB.size,
    sharedCount: shared.length,
    onlyACount: onlyA.length,
    onlyBCount: onlyB.length,
    unionCount: union.size,
    jaccard: union.size ? shared.length / union.size : 0,
    overlapOfA: namesA.size ? shared.length / namesA.size : 0,
    shared: shared.sort((a, b) => a.localeCompare(b)),
    onlyA: onlyA.sort((a, b) => a.localeCompare(b)),
    onlyB: onlyB.sort((a, b) => a.localeCompare(b))
  }
}

/** Summarise the share of approval stake held by the largest voters. */
export function voterConcentration (votes, accounts = [], globalProps = null, limit = 10) {
  const accountMap = new Map((Array.isArray(accounts) ? accounts : [])
    .filter(account => account?.name)
    .map(account => [account.name, account]))

  const rows = (Array.isArray(votes) ? votes : [])
    .map(vote => {
      const name = typeof vote === 'string' ? vote : vote?.voter
      if (!name) return null
      const account = accountMap.get(name)
      const hp = account ? vestsToHp(
        Math.max(0,
          parseAmount(account.vesting_shares) +
          parseAmount(account.received_vesting_shares) -
          parseAmount(account.delegated_vesting_shares) -
          parseAmount(account.vesting_withdraw_rate)
        ),
        globalProps
      ) : 0
      return { voter: name, hp }
    })
    .filter(Boolean)
    .sort((a, b) => b.hp - a.hp)

  const totalHp = rows.reduce((sum, row) => sum + row.hp, 0)
  const top = rows.slice(0, Math.max(0, limit)).map(row => ({
    ...row,
    share: share(row.hp, totalHp)
  }))

  return {
    rows,
    top,
    totalHp,
    topShare: share(top.reduce((sum, row) => sum + row.hp, 0), totalHp),
    sampled: rows.length,
    known: rows.filter(row => row.hp > 0).length
  }
}

/** Days after which unused governance votes expire (Hive governance refresh). */
export function governanceVoteExpiry (account, now = Date.now()) {
  const expiresAt = timeValue(account?.governance_vote_expiration_ts)
  // An account that never voted carries the epoch (1969/1970) sentinel. It has
  // no expiry to warn about; treating it as a real timestamp raises a false
  // "expired" risk warning and dashboard notice.
  if (expiresAt === null || expiresAt <= 0) {
    return { available: false, expiresAt: null, daysLeft: null, expiring: false }
  }
  const daysLeft = (expiresAt - Number(now)) / DAY_MS
  return {
    available: true,
    expiresAt,
    daysLeft,
    expiring: daysLeft <= GOVERNANCE_VOTE_WARNING_DAYS
  }
}

export { percentage, share, safeNumber, clamp, timeValue }
