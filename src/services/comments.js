// Helpers for the post discussion tree returned by `bridge.get_discussion`.
//
// The response is a flat map keyed by `author/permlink`. The root post and
// every comment carry `replies` arrays, so rendering can flatten the tree into
// a predictable list and paginate it without recursing in the template.

export const COMMENT_SORT_OPTIONS = [
  { label: 'Best', value: 'best' },
  { label: 'Newest', value: 'new' },
  { label: 'Oldest', value: 'old' },
  { label: 'Most replies', value: 'replies' }
]

const SORTERS = {
  best: (a, b) => Number(b?.net_rshares || 0) - Number(a?.net_rshares || 0),
  new: (a, b) => Date.parse(b?.created || '') - Date.parse(a?.created || ''),
  old: (a, b) => Date.parse(a?.created || '') - Date.parse(b?.created || ''),
  replies: (a, b) => Number(b?.children || 0) - Number(a?.children || 0)
}

function passesFilter (comment, showFiltered) {
  if (showFiltered) return true
  return !comment?.stats?.gray && !comment?.stats?.hide
}

/**
 * Flatten a discussion into depth-tagged comments in display order.
 *
 * - Sibling groups are sorted by the chosen method.
 * - Hidden/flagged comments (and their subtrees) are skipped unless
 *   `showFiltered` is true.
 * - `depth` is 1-based: direct replies to the post are depth 1.
 *
 * If the root post is missing from the map, every map entry is returned once,
 * sorted, using its own depth as a fallback.
 */
export function flattenDiscussion (discussion, rootKey, options = {}) {
  if (!discussion || typeof discussion !== 'object') return []

  const sortFn = SORTERS[options.sort] || SORTERS.best
  const showFiltered = Boolean(options.showFiltered)
  const out = []
  const seen = new Set()

  const visit = (key, depth) => {
    if (!key || seen.has(key)) return
    const comment = discussion[key]
    if (!comment) return
    seen.add(key)

    if (depth > 0) {
      if (!passesFilter(comment, showFiltered)) return
      out.push({ key, comment, depth })
    }

    const replies = (comment.replies || [])
      .map(replyKey => discussion[replyKey])
      .filter(Boolean)
      .sort(sortFn)

    for (const reply of replies) {
      visit(reply.author + '/' + reply.permlink, depth + 1)
    }
  }

  if (discussion[rootKey]) {
    visit(rootKey, 0)
    return out
  }

  // Defensive fallback for a response that does not include the root post.
  return Object.entries(discussion)
    .filter(([, comment]) => passesFilter(comment, showFiltered))
    .sort(([, a], [, b]) => sortFn(a, b))
    .map(([key, comment]) => ({
      key,
      comment,
      depth: Math.max(1, Number(comment.depth) || 1)
    }))
}

/** Total comments in a discussion map, excluding the root post. */
export function countDiscussion (discussion, rootKey) {
  if (!discussion || typeof discussion !== 'object') return 0
  const length = Object.keys(discussion).length
  return Math.max(0, length - (discussion[rootKey] ? 1 : 0))
}

/**
 * Convert a raw Hive reputation value into the displayed score (PeakD/Hive
 * style). Raw values returned by content objects are scaled by 1e9.
 */
export function formatReputation (raw) {
  const value = Number(raw) || 0
  if (!value) return '25'

  const score = Math.log10(Math.abs(value) / 1e9) * 9 + 25
  if (!Number.isFinite(score)) return '25'

  const rounded = Math.round(score)
  if (value < 0) return String(-Math.max(1, Math.abs(rounded)))
  return String(Math.max(25, rounded))
}
