// Pure shaping for the dashboard's trending-tags widget.
//
// `condenser_api.get_trending_tags` already returns the tags in rank order, so
// this helper only normalises the numbers and caps the list. It is kept free of
// Vue imports so the widget and its tests share the same derivation.

function numberFrom (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function countFrom (value) {
  const number = Math.floor(numberFrom(value))
  return number > 0 ? number : 0
}

function trimDecimal (value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)
}

/** Compact payout label: 34M HBD, 1.2k HBD, 999 HBD, 0 HBD. */
export function trendingTagPayoutLabel (value) {
  const number = numberFrom(value)
  if (!(number > 0)) return '0 HBD'
  if (number >= 1000000) return trimDecimal(number / 1000000) + 'M HBD'
  if (number >= 1000) return trimDecimal(number / 1000) + 'k HBD'
  return trimDecimal(number) + ' HBD'
}

/**
 * Normalise `get_trending_tags` rows or locally aggregated tag rows.
 *
 * Rows keep the order they arrive in (the server's rank), duplicates are
 * dropped, and `limit` caps the output. A tag without a name is ignored.
 */
export function trendingTagsSummary ({ tags = [], limit = 8 } = {}) {
  const requested = Number(limit)
  const cap = Number.isFinite(requested) && requested >= 0 ? Math.floor(requested) : 8
  const source = Array.isArray(tags) ? tags : []
  const seen = new Set()
  const rows = []

  for (const tag of source) {
    if (rows.length >= cap) break
    const name = String(tag?.name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)

    const payout = numberFrom(tag?.total_payouts ?? tag?.payout)
    rows.push({
      name,
      posts: countFrom(tag?.posts ?? tag?.top_posts),
      comments: countFrom(tag?.comments),
      payout,
      payoutLabel: trendingTagPayoutLabel(payout),
      link: '/trending/' + encodeURIComponent(name)
    })
  }

  return {
    rows,
    hasData: rows.length > 0
  }
}
