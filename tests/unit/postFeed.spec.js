import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAccountPosts, fetchRankedPosts, fetchShortFormFeed } = vi.hoisted(() => ({
  fetchAccountPosts: vi.fn(),
  fetchRankedPosts: vi.fn(),
  fetchShortFormFeed: vi.fn()
}))

vi.mock('../../src/services/chainData', () => ({ fetchAccountPosts, fetchRankedPosts }))
vi.mock('../../src/services/shortForm', () => ({ fetchShortFormFeed }))

async function postFeed () {
  return import('../../src/services/postFeed')
}

describe('fetchFeedPosts', () => {
  beforeEach(() => {
    fetchAccountPosts.mockReset().mockResolvedValue([{ author: 'a' }])
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
})
