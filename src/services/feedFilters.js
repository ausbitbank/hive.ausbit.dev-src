// Shared quick filters for post listings.
//
// Browse, account, community and short-form timelines expose the same filter
// menu. Keeping the defaults and the pure predicate here means the dialog and
// the list can never drift apart.

import { postPayoutValue, postUserVoteDirection } from './posts'
import { matchingIgnoredTag } from './tagFilters'

export const FEED_FILTER_TOGGLES = [
  'hideVoted',
  'hideReblogs',
  'hidePinned',
  'hideHidden',
  'hideGray',
  'hideRewardsFilter'
]

export function defaultFeedFilters () {
  return {
    hideVoted: false,
    hideReblogs: false,
    hidePinned: false,
    hideHidden: true,
    hideGray: true,
    hideRewardsFilter: false,
    hideRewardsAbove: 50,
    hideRewardsBelow: 0
  }
}

/** Number of filters that differ from the defaults, plus ignored tags. */
export function activeFeedFilterCount (filter = {}, ignoredTags = []) {
  const defaults = defaultFeedFilters()
  const toggles = FEED_FILTER_TOGGLES
    .filter(key => Boolean(filter[key]) !== Boolean(defaults[key]))
    .length
  return toggles + (Array.isArray(ignoredTags) ? ignoredTags.length : 0)
}

/**
 * Apply the dialog filters to a loaded page.
 *
 * `viewer` enables the "hide voted" rule (it needs a logged-in account).
 * Ignored tags are matched through the shared tag helper, so category, reply
 * target and metadata tags all count.
 */
export function applyFeedFilters (posts, { filter = {}, viewer = '', ignoredTags = [] } = {}) {
  let list = Array.isArray(posts) ? posts : []

  if (Array.isArray(ignoredTags) && ignoredTags.length) {
    list = list.filter(post => !matchingIgnoredTag(post, ignoredTags))
  }
  if (filter.hideVoted && viewer) {
    list = list.filter(post => postUserVoteDirection(post, viewer) === null)
  }
  if (filter.hideReblogs) {
    list = list.filter(post => !(post.reblogged_by && post.reblogged_by.length))
  }
  if (filter.hidePinned) {
    list = list.filter(post => !(post.stats && post.stats.is_pinned))
  }
  if (filter.hideHidden) {
    list = list.filter(post => !(post.stats && (post.stats.hidden || post.stats.hide)))
  }
  if (filter.hideGray) {
    list = list.filter(post => !(post.stats && post.stats.gray))
  }
  if (filter.hideRewardsFilter) {
    const min = Number(filter.hideRewardsBelow)
    const max = Number(filter.hideRewardsAbove)
    if (Number.isFinite(min) && min > 0) {
      list = list.filter(post => postPayoutValue(post) >= min)
    }
    if (Number.isFinite(max) && max > 0) {
      list = list.filter(post => postPayoutValue(post) <= max)
    }
  }

  return list
}
