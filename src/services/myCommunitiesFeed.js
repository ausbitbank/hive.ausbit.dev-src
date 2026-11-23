// Merged feed across the signed-in account's community subscriptions.
//
// This lives in its own module and is loaded on demand: a default home
// dashboard never pays for the subscription and community-insight code.

import { fetchAccountSubscriptions, fetchRankedPosts } from './chainData'

/** Cap the number of community reads one merged feed may trigger. */
export const MAX_MY_COMMUNITIES = 6

/**
 * Read a page of posts spread across the account's communities.
 *
 * One ranked read per community is bounded by `MAX_MY_COMMUNITIES`; posts are
 * merged round-robin so a busy community cannot fill the whole card.
 */
export async function fetchMyCommunitiesFeed (feed, { limit = 6, observer = '', force = false } = {}) {
  const account = String(observer || '').trim().toLowerCase()
  if (!account) return []

  const subscriptions = await fetchAccountSubscriptions(account, { force })
  const communities = (Array.isArray(subscriptions) ? subscriptions : [])
    .filter(community => community && community.name)
    .slice(0, MAX_MY_COMMUNITIES)
  if (!communities.length) return []

  const perCommunity = Math.min(20, Math.max(3, Math.ceil(limit / communities.length) + 1))
  const settled = await Promise.allSettled(communities.map(community => fetchRankedPosts({
    observer,
    limit: perCommunity,
    sort: feed?.sort || 'trending',
    tag: community.name,
    start_author: null,
    start_permlink: null
  }, { force })))

  const feeds = communities.map((community, index) => {
    const result = settled[index]
    return {
      name: community.name,
      title: community.title,
      posts: result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    }
  })
  const { mergeCommunityFeeds } = await import('./community')
  const posts = mergeCommunityFeeds(feeds, { limit, includePinned: false })
  if (!posts.length && settled.every(result => result.status === 'rejected')) {
    throw settled[0].reason
  }
  return posts
}
