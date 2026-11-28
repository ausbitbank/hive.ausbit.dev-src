// Financial impact, timing and pattern analysis for downvote history.
//
// A history vote op stores only the signed weight. The exact reward impact is
// recovered from the target post: `active_votes` keeps the voter's rshares and
// the post keeps its HBD payout and net rshares. For a linear reward curve the
// downvote's share of the final payout is `|rshares| / net_rshares`, so the
// loss can be expressed in the post's own HBD instead of today's HIVE price.
//
// Everything here is pure. Network reads live in `downvoteSources.js` and the
// page only hands the results in.

import { parseAmount, vestsToHp } from './witnesses'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const CASHOUT_WINDOW_MS = 7 * DAY_MS

export const POST_AGE_BUCKETS = [
  { key: 'under-1h', label: '< 1h', maxHours: 1 },
  { key: '1-6h', label: '1–6h', maxHours: 6 },
  { key: '6-24h', label: '6–24h', maxHours: 24 },
  { key: '1-3d', label: '1–3d', maxHours: 72 },
  { key: '3-7d', label: '3–7d', maxHours: 168 },
  { key: 'after-payout', label: 'After payout', maxHours: Infinity }
]

export const HOUR_BUCKETS = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  label: String(hour).padStart(2, '0') + ':00'
}))

function finite (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function parseChainTime (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z'
  const time = Date.parse(withZone)
  return Number.isFinite(time) ? time : 0
}

function postFor (posts, target) {
  if (!posts) return null
  if (posts instanceof Map) return posts.get(target) || null
  return posts[target] || null
}

function activeVote (post, voter) {
  if (!post || !Array.isArray(post.active_votes)) return null
  const name = String(voter || '').toLowerCase()
  return post.active_votes.find(vote => String(vote?.voter || '').toLowerCase() === name) || null
}

function postPayout (post) {
  const pending = parseAmount(post?.pending_payout_value)
  const author = parseAmount(post?.total_payout_value)
  const curator = parseAmount(post?.curator_payout_value)
  const paid = author + curator
  return {
    pendingHbd: pending,
    authorHbd: author,
    curatorHbd: curator,
    paidHbd: paid,
    totalHbd: paid > 0 ? paid : pending
  }
}

function postPayoutState (post, cashoutMs, now) {
  if (!post) return 'unknown'
  const payout = postPayout(post)
  if (payout.paidHbd > 0) return 'paid'
  if (cashoutMs > 0 && now >= cashoutMs) return 'paid'
  return 'pending'
}

function beneficiaryShare (post) {
  const weight = (Array.isArray(post?.beneficiaries) ? post.beneficiaries : [])
    .reduce((sum, item) => sum + (Number(item?.weight) || 0), 0)
  return Math.max(0, Math.min(1, 1 - weight / 10000))
}

/** Approximate share of the post payout that lands with the author. */
export function authorPayoutShare (post) {
  if (!post) return 0.5
  const payout = postPayout(post)
  if (payout.paidHbd > 0) {
    return payout.paidHbd > 0 ? payout.authorHbd / payout.paidHbd : 0.5
  }
  return 0.5 * beneficiaryShare(post)
}

/**
 * The last vote per voter+target that could affect the payout. Votes after
 * cashout are signals and must not supersede the vote that determined the
 * final payout.
 */
function lastEffectiveRow (rows, postsByTarget) {
  const groups = new Map()
  for (const row of rows) {
    const key = String(row.voter || '').toLowerCase() + '|' + String(row.target || '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const last = new Map()
  for (const [key, group] of groups) {
    const post = postFor(postsByTarget, group[0]?.target)
    const createdMs = parseChainTime(post?.created)
    const cashoutMs = parseChainTime(post?.cashout_time || post?.payout_at) || (createdMs ? createdMs + CASHOUT_WINDOW_MS : 0)
    const eligible = cashoutMs
      ? group.filter(row => (Number(row.time) || 0) <= cashoutMs)
      : group
    last.set(key, eligible.length
      ? eligible.reduce((best, row) => {
        const time = Number(row.time) || 0
        const bestTime = Number(best.time) || 0
        if (time > bestTime) return row
        if (time === bestTime && (Number(row.index) || 0) > (Number(best.index) || 0)) return row
        return best
      }, eligible[0])
      : null)
  }
  return last
}

function emptyImpact (row) {
  return {
    ...row,
    impactHbd: 0,
    impactUsd: 0,
    authorImpactUsd: 0,
    curatorImpactUsd: 0,
    impactSource: 'none',
    impactConfidence: 'none',
    impactReason: '',
    effective: false,
    superseded: false,
    offset: false,
    inactive: false,
    afterPayout: false,
    payoutState: 'unknown',
    postAgeHours: null,
    postCreatedMs: 0,
    postCashoutMs: 0,
    postPendingHbd: 0,
    postPaidHbd: 0,
    postTotalHbd: 0,
    netRshares: 0,
    activeRshares: 0,
    voteRshares: 0,
    postBeneficiaries: 0
  }
}

/**
 * Attach exact-or-estimated financial impact, post age and payout state to each
 * history row.
 *
 * Rules:
 * - only the last row per voter+target can affect the current payout;
 * - votes after cashout are signals with no payout impact;
 * - a later upvote that replaced the downvote is "offset";
 * - a vote that is no longer active is "inactive";
 * - when the post or rshares are unavailable, the pre-computed current-stake
 *   estimate is used and labelled `estimated`.
 */
export function annotateDownvoteImpact (rows, postsByTarget = {}, { now = Date.now() } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const last = lastEffectiveRow(list, postsByTarget)
  return list.map(row => {
    const out = emptyImpact(row)
    const target = String(row?.target || '')
    const groupKey = String(row?.voter || '').toLowerCase() + '|' + target
    const post = postFor(postsByTarget, target)
    out.postBeneficiaries = post
      ? (Array.isArray(post.beneficiaries) ? post.beneficiaries.length : 0)
      : 0

    if (post) {
      const createdMs = parseChainTime(post.created)
      const cashoutMs = parseChainTime(post.cashout_time || post.payout_at) || (createdMs ? createdMs + CASHOUT_WINDOW_MS : 0)
      const payout = postPayout(post)
      out.postCreatedMs = createdMs
      out.postCashoutMs = cashoutMs
      out.postPendingHbd = payout.pendingHbd
      out.postPaidHbd = payout.paidHbd
      out.postTotalHbd = payout.totalHbd
      let net = finite(post.net_rshares) || 0
      // Paid posts often clear `net_rshares` while keeping the vote list. The
      // signed vote sum is the same net figure, so recover it when possible.
      if (net <= 0 && Array.isArray(post.active_votes)) {
        const voteSum = post.active_votes.reduce((sum, vote) => sum + (Number(vote?.rshares) || 0), 0)
        if (voteSum > 0) net = voteSum
      }
      out.netRshares = net
      out.payoutState = postPayoutState(post, cashoutMs, now)
      out.postAgeHours = createdMs && row.time ? (Number(row.time) - createdMs) / HOUR_MS : null
      out.afterPayout = Boolean(cashoutMs && row.time && Number(row.time) > cashoutMs)
    }

    out.superseded = !out.afterPayout && Boolean(last.get(groupKey) && last.get(groupKey) !== row)

    if (out.afterPayout || (post && out.payoutState === 'paid' && row.time && out.postCashoutMs && Number(row.time) > out.postCashoutMs)) {
      out.impactSource = 'signal'
      out.impactReason = 'Cast after the payout window; no reward impact.'
      return out
    }

    if (out.superseded) {
      out.impactSource = 'superseded'
      out.impactReason = 'Superseded by a later vote from this voter on the same target.'
      return out
    }

    const vote = activeVote(post, row.voter)
    if (vote) {
      const rshares = Number(vote.rshares) || 0
      out.activeRshares = rshares
      if (rshares >= 0) {
        out.offset = true
        out.impactSource = 'offset'
        out.impactReason = 'Offset by a later upvote from the same voter.'
        return out
      }
      out.voteRshares = Math.abs(rshares)
      const payout = out.postTotalHbd
      const net = out.netRshares
      if (payout > 0 && net > 0) {
        out.impactHbd = payout * out.voteRshares / net
        out.impactUsd = out.impactHbd
        out.authorImpactUsd = out.impactUsd * authorPayoutShare(post)
        out.curatorImpactUsd = Math.max(0, out.impactUsd - out.authorImpactUsd)
        out.impactSource = 'chain'
        out.impactConfidence = 'exact'
        out.effective = true
        out.impactReason = out.payoutState === 'paid'
          ? 'Exact share of the final post payout.'
          : 'Exact share of the current pending payout.'
        return out
      }
      // A downvote that zeroed the payout leaves no proportion to divide.
      // Fall back to the current-stake estimate rather than inventing a payout.
      const estimate = Math.abs(Number(row.valueUsd) || 0)
      out.impactHbd = estimate
      out.impactUsd = estimate
      out.authorImpactUsd = estimate * authorPayoutShare(post)
      out.curatorImpactUsd = Math.max(0, estimate - out.authorImpactUsd)
      out.impactSource = 'estimate'
      out.impactConfidence = 'estimated'
      out.effective = true
      out.impactReason = 'The post payout or net rshares is zero; value is estimated at current stake.'
      return out
    }

    if (post && Array.isArray(post.active_votes)) {
      out.inactive = true
      out.impactSource = 'inactive'
      out.impactReason = 'The vote is no longer active on the target post; current payout excludes it.'
      return out
    }

    const estimate = Math.abs(Number(row.valueUsd) || 0)
    out.impactHbd = estimate
    out.impactUsd = estimate
    out.impactConfidence = estimate > 0 ? 'estimated' : 'none'
    out.impactSource = estimate > 0 ? 'estimate' : 'none'
    out.effective = estimate > 0
    out.impactReason = estimate > 0
      ? 'Target post or vote rshares unavailable; value is estimated at current stake.'
      : 'No target post or stake data available.'
    return out
  })
}

function groupImpactRows (rows, by) {
  const map = new Map()
  for (const row of rows) {
    const key = by === 'target'
      ? String(row.target || row.author + '/' + row.permlink)
      : String(row.voter || '')
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        key,
        count: 0,
        effectiveCount: 0,
        exactCount: 0,
        estimatedCount: 0,
        afterPayoutCount: 0,
        totalUsd: 0,
        exactUsd: 0,
        estimatedUsd: 0,
        weight: 0,
        first: 0,
        last: 0,
        targets: new Set(),
        voters: new Set()
      })
    }
    const group = map.get(key)
    group.count += 1
    group.weight += Math.abs(Number(row.weight) || 0)
    group.first = group.first ? Math.min(group.first, Number(row.time) || 0) : (Number(row.time) || 0)
    group.last = Math.max(group.last, Number(row.time) || 0)
    group.targets.add(row.target || row.author + '/' + row.permlink)
    group.voters.add(row.voter)
    if (row.afterPayout) group.afterPayoutCount += 1
    if (row.effective) {
      group.effectiveCount += 1
      group.totalUsd += Math.abs(Number(row.impactUsd) || 0)
      if (row.impactConfidence === 'exact') {
        group.exactCount += 1
        group.exactUsd += Math.abs(Number(row.impactUsd) || 0)
      } else if (row.impactConfidence === 'estimated') {
        group.estimatedCount += 1
        group.estimatedUsd += Math.abs(Number(row.impactUsd) || 0)
      }
    }
  }
  return [...map.values()]
    .map(group => ({
      ...group,
      targets: group.targets.size,
      voters: group.voters.size
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd || b.count - a.count || b.last - a.last)
}

export function summarizeImpact (rows) {
  const list = Array.isArray(rows) ? rows : []
  let totalUsd = 0
  let exactUsd = 0
  let estimatedUsd = 0
  let finalizedUsd = 0
  let pendingUsd = 0
  let authorUsd = 0
  let curatorUsd = 0
  let largestUsd = 0
  let effectiveCount = 0
  let exactCount = 0
  let estimatedCount = 0
  let afterPayoutCount = 0
  let supersededCount = 0
  let offsetCount = 0
  let inactiveCount = 0
  let unknownCount = 0
  const afterPayoutVoters = new Set()

  for (const row of list) {
    if (row.afterPayout) {
      afterPayoutCount += 1
      if (row.voter) afterPayoutVoters.add(row.voter)
    }
    if (row.superseded) supersededCount += 1
    if (row.offset) offsetCount += 1
    if (row.inactive) inactiveCount += 1
    if (row.impactSource === 'none') unknownCount += 1
    if (!row.effective) continue
    const usd = Math.abs(Number(row.impactUsd) || 0)
    effectiveCount += 1
    totalUsd += usd
    authorUsd += Math.abs(Number(row.authorImpactUsd) || 0)
    curatorUsd += Math.abs(Number(row.curatorImpactUsd) || 0)
    if (row.impactConfidence === 'exact') {
      exactCount += 1
      exactUsd += usd
    } else if (row.impactConfidence === 'estimated') {
      estimatedCount += 1
      estimatedUsd += usd
    }
    if (row.payoutState === 'paid') finalizedUsd += usd
    else if (row.payoutState === 'pending') pendingUsd += usd
    if (usd > largestUsd) largestUsd = usd
  }

  return {
    count: list.length,
    effectiveCount,
    exactCount,
    estimatedCount,
    afterPayoutCount,
    afterPayoutVoters: afterPayoutVoters.size,
    supersededCount,
    offsetCount,
    inactiveCount,
    unknownCount,
    totalUsd,
    exactUsd,
    estimatedUsd,
    finalizedUsd,
    pendingUsd,
    authorUsd,
    curatorUsd,
    largestUsd,
    exactCoverage: effectiveCount ? exactCount / effectiveCount : 0,
    topVoters: groupImpactRows(list, 'voter').slice(0, 8),
    topTargets: groupImpactRows(list, 'target').slice(0, 8)
  }
}

function startOfUtcDay (time) {
  const date = new Date(Number(time) || Date.now())
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

function dayKey (time) {
  return new Date(time).toISOString().slice(0, 10)
}

/**
 * Daily count and dollar buckets for the selected range. `days <= 0` derives
 * the span from the rows (capped at 180 days) so "all loaded" still charts.
 */
export function buildTimeline (rows, { days = 30, now = Date.now(), maxDays = 180 } = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter(row => Number(row.time) > 0)
  if (!list.length) return { buckets: [], totalCount: 0, totalUsd: 0, maxCount: 0, maxUsd: 0, cumulative: [] }
  const nowStart = startOfUtcDay(now)
  let span = Number(days)
  if (!Number.isFinite(span) || span <= 0) {
    const earliest = Math.min(...list.map(row => Number(row.time) || now))
    span = Math.max(1, Math.ceil((nowStart - startOfUtcDay(earliest)) / DAY_MS) + 1)
    span = Math.min(Math.max(1, maxDays), span)
  }
  const start = nowStart - (span - 1) * DAY_MS
  const map = new Map()
  for (let index = 0; index < span; index++) {
    const time = start + index * DAY_MS
    map.set(dayKey(time), { date: dayKey(time), time, count: 0, usd: 0, exactUsd: 0, estimatedUsd: 0, afterPayoutCount: 0 })
  }
  for (const row of list) {
    const bucket = map.get(dayKey(Number(row.time)))
    if (!bucket) continue
    bucket.count += 1
    if (row.afterPayout) bucket.afterPayoutCount += 1
    if (row.effective) {
      const usd = Math.abs(Number(row.impactUsd) || 0)
      bucket.usd += usd
      if (row.impactConfidence === 'exact') bucket.exactUsd += usd
      else bucket.estimatedUsd += usd
    }
  }
  const buckets = [...map.values()]
  let running = 0
  for (const bucket of buckets) {
    running += bucket.usd
    bucket.cumulativeUsd = running
  }
  return {
    buckets,
    totalCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    totalUsd: running,
    maxCount: buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0),
    maxUsd: buckets.reduce((max, bucket) => Math.max(max, bucket.usd), 0),
    cumulative: buckets.map(bucket => bucket.cumulativeUsd)
  }
}

export function postAgeBuckets (rows) {
  const buckets = POST_AGE_BUCKETS
    .filter(bucket => bucket.key !== 'after-payout')
    .map(bucket => ({ ...bucket, count: 0, usd: 0 }))
  const afterPayout = { key: 'after-payout', label: 'After payout', count: 0, usd: 0 }
  const unknown = { key: 'unknown', label: 'Unknown', count: 0, usd: 0 }
  for (const row of rows) {
    let bucket
    if (row.afterPayout) {
      bucket = afterPayout
    } else if (Number.isFinite(row.postAgeHours) && row.postAgeHours >= 0) {
      bucket = buckets.find(item => row.postAgeHours < item.maxHours)
    }
    if (!bucket) {
      unknown.count += 1
      unknown.usd += Math.abs(Number(row.impactUsd) || 0)
      continue
    }
    bucket.count += 1
    bucket.usd += Math.abs(Number(row.impactUsd) || 0)
  }
  return [...buckets, afterPayout, unknown].filter(bucket => bucket.count > 0)
}

export function hourBuckets (rows) {
  const buckets = HOUR_BUCKETS.map(bucket => ({ ...bucket, count: 0, usd: 0 }))
  for (const row of rows) {
    if (!Number(row.time)) continue
    const hour = new Date(Number(row.time)).getUTCHours()
    const bucket = buckets[hour]
    bucket.count += 1
    bucket.usd += Math.abs(Number(row.impactUsd) || 0)
  }
  return buckets
}

function clusters (rows, windowMs, minCount) {
  const sorted = [...rows].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
  const out = []
  let group = []
  for (const row of sorted) {
    const time = Number(row.time) || 0
    if (!group.length || time - (Number(group[group.length - 1].time) || 0) <= windowMs) {
      group.push(row)
    } else {
      if (group.length >= minCount) out.push(group)
      group = [row]
    }
  }
  if (group.length >= minCount) out.push(group)
  return out
}

/** Bursts of votes on one target (multiple voters) or by one voter. */
export function detectBursts (rows, { windowMinutes = 60, minVotes = 2 } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const windowMs = Math.max(1, Number(windowMinutes) || 60) * 60 * 1000
  const byTarget = new Map()
  const byVoter = new Map()
  for (const row of list) {
    const target = row.target || row.author + '/' + row.permlink
    if (!byTarget.has(target)) byTarget.set(target, [])
    byTarget.get(target).push(row)
    if (!byVoter.has(row.voter)) byVoter.set(row.voter, [])
    byVoter.get(row.voter).push(row)
  }
  const targetBursts = []
  for (const [target, group] of byTarget) {
    for (const cluster of clusters(group, windowMs, minVotes)) {
      const voters = [...new Set(cluster.map(row => row.voter))]
      if (voters.length < 2) continue
      targetBursts.push({
        target,
        count: cluster.length,
        voters,
        start: Number(cluster[0].time) || 0,
        end: Number(cluster[cluster.length - 1].time) || 0,
        usd: cluster.reduce((sum, row) => sum + (row.effective ? Math.abs(Number(row.impactUsd) || 0) : 0), 0)
      })
    }
  }
  const voterBursts = []
  for (const [voter, group] of byVoter) {
    for (const cluster of clusters(group, windowMs, 3)) {
      voterBursts.push({
        voter,
        count: cluster.length,
        targets: [...new Set(cluster.map(row => row.target || row.author + '/' + row.permlink))],
        start: Number(cluster[0].time) || 0,
        end: Number(cluster[cluster.length - 1].time) || 0,
        usd: cluster.reduce((sum, row) => sum + (row.effective ? Math.abs(Number(row.impactUsd) || 0) : 0), 0)
      })
    }
  }
  return {
    targetBursts: targetBursts.sort((a, b) => b.count - a.count || b.end - a.end).slice(0, 10),
    voterBursts: voterBursts.sort((a, b) => b.count - a.count || b.end - a.end).slice(0, 10),
    windowMinutes: Math.max(1, Number(windowMinutes) || 60)
  }
}

/**
 * Top voters by week for a compact activity heatmap. Weeks are UTC Monday
 * starts; rows outside the window are ignored.
 */
export function voterWeekMatrix (rows, { weeks = 8, voters = 6, now = Date.now() } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const weekCount = Math.max(1, Math.min(26, Number(weeks) || 8))
  const voterCount = Math.max(1, Math.min(12, Number(voters) || 6))
  const current = new Date(Number(now) || Date.now())
  const day = current.getUTCDay()
  const mondayOffset = (day + 6) % 7
  const currentWeekStart = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() - mondayOffset
  )
  const weekMs = 7 * DAY_MS
  const starts = Array.from({ length: weekCount }, (_, index) => currentWeekStart - (weekCount - 1 - index) * weekMs)
  const top = groupImpactRows(list, 'voter').slice(0, voterCount)
  const matrix = top.map(group => {
    const cells = starts.map(() => ({ count: 0, usd: 0 }))
    for (const row of list) {
      if (row.voter !== group.key) continue
      const time = Number(row.time) || 0
      if (!time) continue
      const index = starts.findIndex(start => time >= start && time < start + weekMs)
      if (index < 0) continue
      cells[index].count += 1
      if (row.effective) cells[index].usd += Math.abs(Number(row.impactUsd) || 0)
    }
    return { voter: group.key, cells, totalUsd: group.totalUsd, count: group.count }
  })
  return {
    weeks: starts.map(start => {
      const key = new Date(start).toISOString().slice(0, 10)
      return { start, key, label: key.slice(5) }
    }),
    voters: matrix,
    maxCount: matrix.reduce((max, entry) => Math.max(max, ...entry.cells.map(cell => cell.count)), 0),
    maxUsd: matrix.reduce((max, entry) => Math.max(max, ...entry.cells.map(cell => cell.usd)), 0),
    weekCount,
    voterCount
  }
}

/** Voters who account for repeated downvotes on the profile. */
export function repeatTargeting (rows, { minVotes = 3 } = {}) {  const list = Array.isArray(rows) ? rows : []
  const total = list.length
  const groups = groupImpactRows(list, 'voter')
  return groups
    .filter(group => group.count >= Math.max(1, Number(minVotes) || 1))
    .map(group => ({
      ...group,
      share: total ? group.count / total : 0,
      averageWeight: group.count ? group.weight / group.count : 0
    }))
}

/** Voters whose downvote weight got heavier over the selected period. */
export function weightEscalation (rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.voter)) map.set(row.voter, [])
    map.get(row.voter).push(row)
  }
  const out = []
  for (const [voter, group] of map) {
    if (group.length < 3) continue
    const sorted = [...group].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
    const first = Math.abs(Number(sorted[0].weight) || 0)
    const last = Math.abs(Number(sorted[sorted.length - 1].weight) || 0)
    if (last <= first) continue
    out.push({
      voter,
      count: group.length,
      firstWeight: first,
      lastWeight: last,
      delta: last - first,
      first: Number(sorted[0].time) || 0,
      last: Number(sorted[sorted.length - 1].time) || 0
    })
  }
  return out.sort((a, b) => b.delta - a.delta).slice(0, 8)
}

/** Targets where the same voter changed their downvote more than once. */
export function voteChanges (rows) {
  const map = new Map()
  for (const row of rows) {
    const key = row.voter + '|' + (row.target || row.author + '/' + row.permlink)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  const out = []
  for (const [, group] of map) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
    out.push({
      voter: sorted[0].voter,
      target: sorted[0].target || sorted[0].author + '/' + sorted[0].permlink,
      count: group.length,
      firstWeight: Math.abs(Number(sorted[0].weight) || 0),
      lastWeight: Math.abs(Number(sorted[sorted.length - 1].weight) || 0),
      first: Number(sorted[0].time) || 0,
      last: Number(sorted[sorted.length - 1].time) || 0
    })
  }
  return out.sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 10)
}

export function postPayoutSignals (rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(row => row.afterPayout)
  const voters = [...new Set(list.map(row => row.voter))]
  return {
    count: list.length,
    voters,
    voterCount: voters.length,
    rows: list.slice(0, 10)
  }
}

/** Accounts created shortly before their first downvote on this profile. */
export function newVoterAccounts (rows, accounts = {}, { maxAgeDays = 30 } = {}) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.voter)) map.set(row.voter, [])
    map.get(row.voter).push(row)
  }
  const out = []
  for (const [voter, group] of map) {
    const account = accounts[voter]
    const created = parseChainTime(account?.created)
    if (!created) continue
    const first = Math.min(...group.map(row => Number(row.time) || Date.now()))
    const ageDays = (first - created) / DAY_MS
    if (ageDays > maxAgeDays) continue
    out.push({
      voter,
      created,
      ageDays: Math.max(0, ageDays),
      count: group.length,
      usd: group.reduce((sum, row) => sum + (row.effective ? Math.abs(Number(row.impactUsd) || 0) : 0), 0)
    })
  }
  return out.sort((a, b) => a.ageDays - b.ageDays).slice(0, 8)
}

function historyOperation (entry) {
  const record = Array.isArray(entry) ? entry[1] : entry
  const op = Array.isArray(record?.op) ? record.op : null
  if (!op || !op[1] || typeof op[1] !== 'object') return null
  return { type: op[0], data: op[1], timestamp: parseChainTime(record?.timestamp) }
}

/**
 * Sum the reward streams that belong to the account, for a same-period
 * comparison with the downvote loss. `comment_reward` is deliberately excluded
 * because it repeats the post's total payout.
 */
export function sumAccountRewards (history, { globalProps = null, hiveUsd = 0, hbdUsd = 1 } = {}) {
  const totals = {
    authorHbd: 0,
    authorHive: 0,
    authorVests: 0,
    benefactorHbd: 0,
    benefactorHive: 0,
    benefactorVests: 0,
    curationVests: 0,
    interestHbd: 0,
    otherHbd: 0,
    otherHive: 0
  }
  for (const entry of Array.isArray(history) ? history : []) {
    const op = historyOperation(entry)
    if (!op) continue
    const data = op.data
    switch (op.type) {
      case 'author_reward':
        totals.authorHbd += parseAmount(data.hbd_payout)
        totals.authorHive += parseAmount(data.hive_payout)
        totals.authorVests += parseAmount(data.vesting_payout)
        break
      case 'comment_benefactor_reward':
        totals.benefactorHbd += parseAmount(data.hbd_payout)
        totals.benefactorHive += parseAmount(data.hive_payout)
        totals.benefactorVests += parseAmount(data.vesting_payout)
        break
      case 'curation_reward':
        totals.curationVests += parseAmount(data.reward)
        break
      case 'interest':
        totals.interestHbd += parseAmount(data.interest)
        break
      case 'producer_reward':
        totals.otherHive += vestsToHp(parseAmount(data.vesting_shares), globalProps)
        break
      case 'proposal_pay':
        totals.otherHbd += parseAmount(data.payment)
        break
      default:
        break
    }
  }
  const authorHp = vestsToHp(totals.authorVests, globalProps)
  const benefactorHp = vestsToHp(totals.benefactorVests, globalProps)
  const curationHp = vestsToHp(totals.curationVests, globalProps)
  const rate = Number(hiveUsd) || 0
  const hbdRate = Number(hbdUsd) || 1
  const authorUsd = (totals.authorHbd + totals.benefactorHbd) * hbdRate +
    (totals.authorHive + totals.benefactorHive + authorHp + benefactorHp) * rate
  const curationUsd = curationHp * rate
  const otherUsd = (totals.interestHbd + totals.otherHbd) * hbdRate + totals.otherHive * rate
  return {
    ...totals,
    authorHp,
    benefactorHp,
    curationHp,
    authorUsd,
    curationUsd,
    otherUsd,
    totalUsd: authorUsd + curationUsd + otherUsd
  }
}

/** Loss relative to the author rewards earned in the same window. */
export function compareLossToRewards (impact, rewards, { finalOnly = true } = {}) {
  const lossUsd = finalOnly ? Math.abs(Number(impact?.finalizedUsd) || 0) : Math.abs(Number(impact?.totalUsd) || 0)
  const rewardsUsd = Math.abs(Number(rewards?.authorUsd) || 0)
  const counterfactual = rewardsUsd + lossUsd
  return {
    lossUsd,
    rewardsUsd,
    counterfactualUsd: counterfactual,
    sharePercent: counterfactual > 0 ? (lossUsd / counterfactual) * 100 : null,
    netUsd: rewardsUsd - lossUsd
  }
}
