// Pure downvote analysis.
//
// Hive history vote rows carry `weight` (signed basis points) but no rshares.
// Active votes carry rshares/percent. This module keeps the two inputs
// distinct and never turns a heuristic into an automatic hide.

import { normalizeVotes, voteDirection } from './voteBreakdown'
import { estimateDownvoteValueUsd } from './voteValue'

export const DOWNVOTE_WINDOW_HOURS = 72
export const COORDINATION_MIN_VOTERS = 3
export const COORDINATION_MIN_TARGETS = 3
export const COORDINATION_MIN_OVERLAP = 0.6

function finite (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function timestamp (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z'
  const time = Date.parse(withZone)
  return Number.isFinite(time) ? time : 0
}

export function normalizeHistoryVote (entry) {
  const record = Array.isArray(entry) ? entry[1] : entry
  const op = Array.isArray(record?.op) ? record.op : null
  if (!op || op[0] !== 'vote' || !op[1] || typeof op[1] !== 'object') return null
  const data = op[1]
  const voter = String(data.voter || '').trim().toLowerCase()
  const author = String(data.author || '').trim().toLowerCase()
  const permlink = String(data.permlink || '').trim()
  const weight = finite(data.weight)
  if (!voter || !author || !permlink || weight === null || weight === 0) return null
  return {
    index: Array.isArray(entry) ? finite(entry[0]) : finite(record?.index),
    voter,
    author,
    permlink,
    weight,
    direction: weight < 0 ? 'down' : 'up',
    timestamp: record?.timestamp || '',
    time: timestamp(record?.timestamp),
    trxId: record?.trx_id || '',
    target: author + '/' + permlink
  }
}

export function normalizeHistoryVotes (entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeHistoryVote)
    .filter(Boolean)
}

export function downvotesFor (rows, account, direction = 'received') {
  const name = String(account || '').trim().toLowerCase()
  if (!name) return []
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row && row.weight < 0)
    .filter(row => direction === 'given' ? row.voter === name : row.author === name)
}

/**
 * Attach an estimated rshares/USD impact to each history row.
 *
 * The estimate uses the voter's current stake and mana because a history vote
 * op does not store rshares. Rows without a resolved voter account keep zero
 * values and the UI shows "—" rather than guessing.
 */
export function withDownvoteValues (rows, { accounts = {}, rewardFund = null, medianHistory = null } = {}) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const voter = String(row?.voter || '').trim().toLowerCase()
    const account = voter && accounts ? accounts[voter] : null
    if (!account) return { ...row, valueUsd: 0, valueRshares: 0 }
    const estimate = estimateDownvoteValueUsd({
      account,
      rewardFund,
      medianHistory,
      weight: Math.abs(Number(row?.weight) || 0)
    })
    return { ...row, valueUsd: estimate.usd, valueRshares: estimate.rshares }
  })
}

export function summarizeDownvotes (rows) {
  const list = Array.isArray(rows) ? rows : []
  const voters = new Set()
  const targets = new Set()
  let totalWeight = 0
  let largestWeight = 0
  let totalValueUsd = 0
  let largestValueUsd = 0
  let totalRshares = 0
  let largestRshares = 0
  let latest = null
  let earliest = null

  for (const row of list) {
    const weight = Math.abs(Number(row.weight) || 0)
    const valueUsd = Math.abs(Number(row.valueUsd) || 0)
    const valueRshares = Math.abs(Number(row.valueRshares) || 0)
    voters.add(row.voter)
    targets.add(row.target || row.author + '/' + row.permlink)
    totalWeight += weight
    totalValueUsd += valueUsd
    totalRshares += valueRshares
    if (weight > largestWeight) largestWeight = weight
    if (valueUsd > largestValueUsd) largestValueUsd = valueUsd
    if (valueRshares > largestRshares) largestRshares = valueRshares
    const time = Number(row.time) || timestamp(row.timestamp)
    if (time) {
      if (latest === null || time > latest) latest = time
      if (earliest === null || time < earliest) earliest = time
    }
  }

  return {
    count: list.length,
    distinctVoters: voters.size,
    distinctTargets: targets.size,
    totalWeight,
    largestWeight,
    topVoterShare: totalWeight ? largestWeight / totalWeight : 0,
    totalValueUsd,
    largestValueUsd,
    topValueShare: totalValueUsd ? largestValueUsd / totalValueUsd : 0,
    totalRshares,
    largestRshares,
    latest,
    earliest
  }
}

export function groupDownvotes (rows, by = 'voter') {
  const map = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = by === 'target'
      ? (row.target || row.author + '/' + row.permlink)
      : by === 'day'
        ? String(row.timestamp || '').slice(0, 10)
        : row.voter
    if (!map.has(key)) {
      map.set(key, { key, rows: [], voters: new Set(), targets: new Set(), totalWeight: 0, totalValueUsd: 0, totalRshares: 0, exactCount: 0, effectiveCount: 0, latest: 0 })
    }
    const group = map.get(key)
    group.rows.push(row)
    group.voters.add(row.voter)
    group.targets.add(row.target || row.author + '/' + row.permlink)
    group.totalWeight += Math.abs(Number(row.weight) || 0)
    const value = row.effective === false ? 0 : Math.abs(Number(row.impactUsd ?? row.valueUsd) || 0)
    group.totalValueUsd += value
    if (row.effective !== false) {
      group.effectiveCount += 1
      if (row.impactConfidence === 'exact') group.exactCount += 1
    }
    group.totalRshares += Math.abs(Number(row.valueRshares) || 0)
    group.latest = Math.max(group.latest, Number(row.time) || timestamp(row.timestamp))
  }
  return [...map.values()]
    .map(group => ({
      key: group.key,
      count: group.rows.length,
      voters: group.voters.size,
      targets: group.targets.size,
      totalWeight: group.totalWeight,
      totalValueUsd: group.totalValueUsd,
      totalRshares: group.totalRshares,
      exactCount: group.exactCount,
      effectiveCount: group.effectiveCount,
      latest: group.latest,
      rows: group.rows
    }))
    .sort((a, b) => b.latest - a.latest)
}

function pairwiseOverlap (sets) {
  if (sets.length < 2) return 0
  let total = 0
  let pairs = 0
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i]
      const b = sets[j]
      let shared = 0
      for (const value of a) if (b.has(value)) shared++
      const union = a.size + b.size - shared
      total += union ? shared / union : 0
      pairs++
    }
  }
  return pairs ? total / pairs : 0
}

/**
 * Conservative "possible coordinated downvotes" evidence.
 *
 * Requirements (all must hold): at least 3 distinct voters, at least 3 shared
 * targets inside the window, and pairwise target-set overlap >= 0.6. The
 * result is a hint with evidence, never an automatic action.
 */
export function coordinationEvidence (rows, { windowHours = DOWNVOTE_WINDOW_HOURS } = {}) {
  const list = (Array.isArray(rows) ? rows : [])
    .filter(row => row && row.weight < 0)
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0))
    .slice(0, 2000)
  if (list.length < COORDINATION_MIN_TARGETS) return null

  const cutoff = Date.now() - Math.max(1, Number(windowHours) || DOWNVOTE_WINDOW_HOURS) * 60 * 60 * 1000
  const recent = list.filter(row => (Number(row.time) || timestamp(row.timestamp)) >= cutoff)
  if (!recent.length) return null

  const byVoter = new Map()
  for (const row of recent) {
    if (!byVoter.has(row.voter)) byVoter.set(row.voter, new Set())
    byVoter.get(row.voter).add(row.target || row.author + '/' + row.permlink)
  }
  const voters = [...byVoter.entries()]
    .filter(([, targets]) => targets.size >= COORDINATION_MIN_TARGETS)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 30)
  if (voters.length < COORDINATION_MIN_VOTERS) return null

  const overlap = pairwiseOverlap(voters.map(([, targets]) => targets))
  if (overlap < COORDINATION_MIN_OVERLAP) return null

  const shared = new Set()
  for (const target of voters[0][1]) {
    if (voters.slice(1).every(([, targets]) => targets.has(target))) shared.add(target)
  }
  if (shared.size < COORDINATION_MIN_TARGETS) return null

  return {
    kind: 'possible-coordinated-downvotes',
    label: 'Possible coordinated downvotes',
    qualifier: 'possible',
    voters: voters.slice(0, 8).map(([voter]) => voter),
    voterCount: voters.length,
    targets: [...shared].slice(0, 12),
    targetCount: shared.size,
    windowHours: Math.max(1, Number(windowHours) || DOWNVOTE_WINDOW_HOURS),
    overlap: Math.round(overlap * 100) / 100
  }
}

/**
 * Up/down context for one post from active votes (`get_active_votes` or a post's
 * embedded `active_votes`). Raw impact is independent of local voter exclusion.
 */
export function downvoteContext (votes) {
  const normalized = normalizeVotes(votes)
  const up = normalized.filter(vote => voteDirection(vote) > 0)
  const down = normalized.filter(vote => voteDirection(vote) < 0)
  const totalUp = up.reduce((sum, vote) => sum + Math.abs(vote.rshares), 0)
  const totalDown = down.reduce((sum, vote) => sum + Math.abs(vote.rshares), 0)
  const total = totalUp + totalDown
  const largest = normalized.reduce((max, vote) => Math.max(max, Math.abs(vote.rshares)), 0)
  const net = totalUp - totalDown

  return {
    upCount: up.length,
    downCount: down.length,
    distinctUp: new Set(up.map(vote => vote.voter)).size,
    distinctDown: new Set(down.map(vote => vote.voter)).size,
    totalUp,
    totalDown,
    net,
    netDirection: net > 0 ? 'up' : net < 0 ? 'down' : 'flat',
    topVoterShare: total ? largest / total : 0,
    stakeConcentration: total ? Math.round((largest / total) * 1000) / 10 : 0
  }
}

export function relationshipFor (voter, context = {}) {
  const name = String(voter || '').trim().toLowerCase()
  if (!name) return 'unknown'
  if ((context.muted || []).includes(name)) return 'muted'
  if ((context.following || []).includes(name)) return 'follows'
  if ((context.blacklisted || []).includes(name)) return 'blacklist'
  if ((context.followedMuteLists || []).some(list => (list.members || []).includes(name))) return 'followed list'
  if ((context.followedBlacklistLists || []).some(list => (list.members || []).includes(name))) return 'followed blacklist'
  return 'unknown'
}

export function filterIgnoredVoters (rows, ignored = []) {
  const blocked = new Set((Array.isArray(ignored) ? ignored : []).map(name => String(name || '').toLowerCase()))
  if (!blocked.size) return Array.isArray(rows) ? rows : []
  return (Array.isArray(rows) ? rows : []).filter(row => !blocked.has(row.voter))
}
