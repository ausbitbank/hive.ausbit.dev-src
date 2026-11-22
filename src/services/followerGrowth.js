// Pure read model for the follower growth dashboard widget.
//
// `condenser_api.get_follow_count` only reports the current totals, so growth
// is measured against a local baseline saved by the widget in this browser.
// The service stays pure: it never reads storage and never assumes a baseline
// exists.

const DAY_MS = 24 * 60 * 60 * 1000

function countValue (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null
}

function timestampValue (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function deltaLabel (value) {
  if (value === null) return '—'
  if (value === 0) return 'No change'
  const sign = value > 0 ? '+' : '-'
  return sign + Math.abs(value).toLocaleString('en-US')
}

function rateLabel (value) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return sign + value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '/day'
}

function normalizeBaseline (baseline) {
  if (!baseline || typeof baseline !== 'object') return null
  const firstAt = timestampValue(baseline.firstAt)
  const firstFollowers = countValue(baseline.firstFollowers)
  const firstFollowing = countValue(baseline.firstFollowing)
  if (firstAt === null || firstFollowers === null || firstFollowing === null) return null
  return {
    firstAt,
    firstFollowers,
    firstFollowing,
    lastAt: timestampValue(baseline.lastAt) ?? firstAt,
    lastFollowers: countValue(baseline.lastFollowers) ?? firstFollowers,
    lastFollowing: countValue(baseline.lastFollowing) ?? firstFollowing
  }
}

function daysLabel (isNew, days) {
  if (isNew) return 'Tracking starts now'
  if (days < 1) return 'Less than a day'
  const whole = Math.floor(days)
  return whole + (whole === 1 ? ' day' : ' days')
}

/**
 * Compare the current follow counts against the first counts this browser saw.
 *
 * `followCount` is the raw `get_follow_count` result. `baseline` carries the
 * first and last values the widget stored; a new or malformed baseline yields
 * `hasBaseline: false` and `isNew: true` so the UI can explain that tracking
 * just started. Rates need at least a full day of elapsed time, so they stay
 * null on a fresh baseline or within the first day.
 */
export function followerGrowthSummary ({
  followCount = null,
  baseline = null,
  now = Date.now()
} = {}) {
  const followers = countValue(followCount?.follower_count)
  const following = countValue(followCount?.following_count)
  const hasCounts = followers !== null || following !== null

  const parsed = normalizeBaseline(baseline)
  const hasBaseline = parsed !== null
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now()

  let daysTracked = 0
  if (hasBaseline) {
    const elapsed = Math.max(0, currentTime - parsed.firstAt)
    daysTracked = Number((elapsed / DAY_MS).toFixed(2))
  }

  const followerDelta = hasBaseline && followers !== null
    ? followers - parsed.firstFollowers
    : null
  const followingDelta = hasBaseline && following !== null
    ? following - parsed.firstFollowing
    : null

  const followerRatePerDay = followerDelta !== null && daysTracked > 0
    ? followerDelta / daysTracked
    : null
  const followingRatePerDay = followingDelta !== null && daysTracked > 0
    ? followingDelta / daysTracked
    : null

  // A saved baseline with no elapsed time has nothing to compare yet, even
  // though the baseline exists for the next successful read.
  const isNew = !hasBaseline || daysTracked === 0

  return {
    followers,
    following,
    followerDelta,
    followingDelta,
    daysTracked,
    followerRatePerDay,
    followingRatePerDay,
    hasBaseline,
    isNew,
    hasCounts,
    followerDeltaLabel: deltaLabel(followerDelta),
    followingDeltaLabel: deltaLabel(followingDelta),
    followerRateLabel: rateLabel(followerRatePerDay),
    followingRateLabel: rateLabel(followingRatePerDay),
    daysTrackedLabel: daysLabel(isNew, daysTracked)
  }
}

export default followerGrowthSummary
