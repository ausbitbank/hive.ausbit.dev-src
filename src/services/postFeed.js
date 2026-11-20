// Fetch the posts a feed descriptor points at.
//
// The descriptor comes from `feedReference.js`; this module only knows how to
// read each kind. Kept separate so the parser and its header copy stay pure.

import { fetchAccountPosts, fetchRankedPosts } from './chainData'
import { fetchShortFormFeed } from './shortForm'

export * from './feedReference'

/**
 * Read the first page of a feed descriptor.
 *
 * `observer` personalises vote state and ranked ordering. Account feeds fall
 * back to the account itself when the visitor is a guest.
 */
export async function fetchFeedPosts (feed, { limit = 6, observer = '', force = false } = {}) {
  if (!feed) return []

  if (feed.method === 'short') {
    const items = await fetchShortFormFeed(feed.shortFormat, {
      sort: feed.sort === 'top' ? 'top' : 'new',
      limit,
      observer: observer || ''
    })
    return Array.isArray(items) ? items : []
  }

  if (feed.method === 'account') {
    const posts = await fetchAccountPosts({
      sort: feed.sort,
      account: feed.account,
      observer: observer || feed.account,
      limit,
      start_author: null,
      start_permlink: null
    }, { force })
    return Array.isArray(posts) ? posts : []
  }

  const posts = await fetchRankedPosts({
    observer: observer || null,
    limit,
    sort: feed.sort,
    tag: feed.tag || '',
    start_author: null,
    start_permlink: null
  }, { force })
  return Array.isArray(posts) ? posts : []
}
