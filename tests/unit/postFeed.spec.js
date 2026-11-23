import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAccountPosts, fetchAccountSubscriptions, fetchRankedPosts, fetchShortFormFeed } = vi.hoisted(() => ({
  fetchAccountPosts: vi.fn(),
  fetchAccountSubscriptions: vi.fn(),
  fetchRankedPosts: vi.fn(),
  fetchShortFormFeed: vi.fn()
}))

vi.mock('../../src/services/chainData', () => ({ fetchAccountPosts, fetchAccountSubscriptions, fetchRankedPosts }))
vi.mock('../../src/services/shortForm', () => ({ fetchShortFormFeed }))

async function postFeed () {
  return import('../../src/services/postFeed')
}

describe('fetchFeedPosts', () => {
  beforeEach(() => {
    fetchAccountPosts.mockReset().mockResolvedValue([{ author: 'a' }])
    fetchAccountSubscriptions.mockReset().mockResolvedValue([])
    fetchRankedPosts.mockReset().mockResolvedValue([{ author: 'b' }])
    fetchShortFormFeed.mockReset().mockResolvedValue([{ author: 'c' }])
  })

  it('passes force through to ranked and account reads', async () => {
    const { fetchFeedPosts } = await postFeed()

    await fetchFeedPosts({ method: 'ranked', sort: 'trending', tag: '' }, { force: true })
    expect(fetchRankedPosts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'trending', limit: 6 }),
      { force: true }
    )

    await fetchFeedPosts({ method: 'account', sort: 'blog', account: 'alice' }, { force: true })
    expect(fetchAccountPosts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'blog', account: 'alice' }),
      { force: true }
    )
  })

  it('leaves short-form reads alone and defaults force to false', async () => {
    const { fetchFeedPosts } = await postFeed()

    await fetchFeedPosts({ method: 'short', shortFormat: 'threads', sort: 'new' })
    expect(fetchShortFormFeed).toHaveBeenCalledWith('threads', {
      sort: 'new',
      limit: 6,
      observer: ''
    })

    await fetchFeedPosts({ method: 'ranked', sort: 'hot' })
    expect(fetchRankedPosts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'hot' }),
      { force: false }
    )
  })

  it('returns an empty list for a missing feed', async () => {
    const { fetchFeedPosts } = await postFeed()
    await expect(fetchFeedPosts(null)).resolves.toEqual([])
  })

  it('merges posts from a bounded set of the account subscriptions', async () => {
    const { fetchFeedPosts } = await postFeed()
    const { MAX_MY_COMMUNITIES } = await import('../../src/services/myCommunitiesFeed')
    expect(MAX_MY_COMMUNITIES).toBe(6)
    fetchAccountSubscriptions.mockResolvedValue([
      { name: 'hive-dev', title: 'Hive Dev' },
      { name: 'hive-111111', title: 'Governance' }
    ])
    fetchRankedPosts.mockImplementation(({ tag }) => Promise.resolve(
      tag === 'hive-dev'
        ? [{ author: 'alice', permlink: 'dev-post' }]
        : [{ author: 'bob', permlink: 'gov-post' }]
    ))

    const posts = await fetchFeedPosts({ method: 'communities', sort: 'trending' }, {
      limit: 2,
      observer: 'carol',
      force: true
    })

    expect(fetchAccountSubscriptions).toHaveBeenCalledWith('carol', { force: true })
    expect(fetchRankedPosts).toHaveBeenCalledTimes(2)
    expect(fetchRankedPosts).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'hive-dev', observer: 'carol' }),
      { force: true }
    )
    expect(posts).toHaveLength(2)
    expect(posts[0]).toMatchObject({ author: 'alice', community: 'hive-dev', community_title: 'Hive Dev' })
    expect(posts[1]).toMatchObject({ author: 'bob', community: 'hive-111111', community_title: 'Governance' })
  })

  it('returns nothing for a guest or an account with no communities', async () => {
    const { fetchFeedPosts } = await postFeed()
    await expect(fetchFeedPosts({ method: 'communities' }, { observer: '' })).resolves.toEqual([])
    expect(fetchAccountSubscriptions).not.toHaveBeenCalled()

    fetchAccountSubscriptions.mockResolvedValue([])
    await expect(fetchFeedPosts({ method: 'communities' }, { observer: 'carol' })).resolves.toEqual([])
    expect(fetchRankedPosts).not.toHaveBeenCalled()
  })
})
