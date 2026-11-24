// Pure read model for the community-growth dashboard widget.
//
// Hive does not expose historical community totals, so growth is measured
// against a baseline saved by the widget in this browser. The service stays
// pure: it never reads storage and never assumes a baseline exists.

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

function communityValues (community) {
  const record = community && typeof community === 'object' ? community : null
  if (!record) return null
  return {
    name: String(record.name || ''),
    subscribers: countValue(record.subscribers),
    authors: countValue(record.num_authors ?? record.authors),
    pendingRewards: Number.isFinite(Number(record.sum_pending ?? record.pendingRewards))
      ? Number(record.sum_pending ?? record.pendingRewards)
      : null
  }
}

function normalizeBaseline (baseline) {
  if (!baseline || typeof baseline !== 'object') return null
  const firstAt = timestampValue(baseline.firstAt)
  const firstSubscribers = countValue(baseline.firstSubscribers)
  if (firstAt === null || firstSubscribers === null) return null
  return {
    firstAt,
    firstSubscribers,
    firstAuthors: countValue(baseline.firstAuthors),
    firstPendingRewards: Number.isFinite(Number(baseline.firstPendingRewards))
      ? Number(baseline.firstPendingRewards)
      : null,
    lastAt: timestampValue(baseline.lastAt) ?? firstAt,
    lastSubscribers: countValue(baseline.lastSubscribers) ?? firstSubscribers,
    lastAuthors: countValue(baseline.lastAuthors) ?? countValue(baseline.firstAuthors),
    lastPendingRewards: Number.isFinite(Number(baseline.lastPendingRewards))
      ? Number(baseline.lastPendingRewards)
      : (Number.isFinite(Number(baseline.firstPendingRewards)) ? Number(baseline.firstPendingRewards) : null)
  }
}

function daysLabel (isNew, days) {
  if (isNew) return 'Tracking starts now'
  if (days < 1) return 'Less than a day'
  const whole = Math.floor(days)
  return whole + (whole === 1 ? ' day' : ' days')
}

/**
 * Compare a community's current totals against the first values this browser
 * saw. `community` is a `bridge.get_community` result. A new or malformed
 * baseline yields `hasBaseline: false` and `isNew: true` so the card can
 * explain that tracking just started instead of inventing a delta.
 */
export function communityGrowthSummary ({
  community = null,
  baseline = null,
  now = Date.now()
} = {}) {
  const current = communityValues(community)
  const parsed = normalizeBaseline(baseline)
  const hasBaseline = parsed !== null
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now()

  let daysTracked = 0
  if (hasBaseline) {
    daysTracked = Number((Math.max(0, currentTime - parsed.firstAt) / DAY_MS).toFixed(2))
  }

  const subscriberDelta = hasBaseline && current?.subscribers !== null && current?.subscribers !== undefined
    ? current.subscribers - parsed.firstSubscribers
    : null
  const authorDelta = hasBaseline && current?.authors !== null && current?.authors !== undefined
    ? current.authors - parsed.firstAuthors
    : null
  const pendingDelta = hasBaseline && Number.isFinite(current?.pendingRewards) && Number.isFinite(parsed.firstPendingRewards)
    ? Number((current.pendingRewards - parsed.firstPendingRewards).toFixed(3))
    : null

  const subscriberRatePerDay = subscriberDelta !== null && daysTracked > 0
    ? subscriberDelta / daysTracked
    : null
  const authorRatePerDay = authorDelta !== null && daysTracked > 0
    ? authorDelta / daysTracked
    : null

  const isNew = !hasBaseline || daysTracked === 0

  return {
    name: current?.name || '',
    subscribers: current?.subscribers ?? null,
    authors: current?.authors ?? null,
    pendingRewards: Number.isFinite(current?.pendingRewards) ? current.pendingRewards : null,
    hasData: Boolean(current?.name) && (
      current.subscribers !== null || current.authors !== null || Number.isFinite(current.pendingRewards)
    ),
    hasBaseline,
    isNew,
    daysTracked,
    subscriberDelta,
    authorDelta,
    pendingDelta,
    subscriberRatePerDay,
    authorRatePerDay,
    subscriberDeltaLabel: deltaLabel(subscriberDelta),
    authorDeltaLabel: deltaLabel(authorDelta),
    pendingDeltaLabel: pendingDelta === null
      ? '—'
      : (pendingDelta > 0 ? '+' : pendingDelta < 0 ? '-' : '') +
        Math.abs(pendingDelta).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' HBD',
    subscriberRateLabel: rateLabel(subscriberRatePerDay),
    authorRateLabel: rateLabel(authorRatePerDay),
    daysTrackedLabel: daysLabel(isNew, daysTracked)
  }
}

export default communityGrowthSummary
