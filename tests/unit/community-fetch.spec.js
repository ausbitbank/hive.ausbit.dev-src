import { beforeEach, describe, expect, it, vi } from 'vitest'

const { bridgeRequest } = vi.hoisted(() => ({ bridgeRequest: vi.fn() }))

vi.mock('../../src/services/api', () => ({ bridgeRequest }))

async function community () {
  return import('../../src/services/community')
}

function post (index) {
  return {
    author: 'author' + index,
    permlink: 'post-' + index,
    parent_author: '',
    created: '2026-11-18T10:00:00',
    payout: 1
  }
}

describe('fetchCommunityInsightData', () => {
  beforeEach(() => {
    bridgeRequest.mockReset()
  })

  it('pages through the created feed and deduplicates posts', async () => {
    const page1 = Array.from({ length: 20 }, (_, index) => post(index))
    const page2 = Array.from({ length: 20 }, (_, index) => post(index + 20))
    const page3 = Array.from({ length: 5 }, (_, index) => post(index + 40))

    bridgeRequest.mockImplementation(async (method, params) => {
      if (params.sort === 'muted') return []
      if (params.start_permlink === 'post-19') return page2
      if (params.start_permlink === 'post-39') return page3
      return page1
    })

    const { fetchCommunityInsightData } = await community()
    const result = await fetchCommunityInsightData('hive-139531', { maxPages: 5, now: '2026-11-18T12:00:00Z' })

    expect(result.posts).toHaveLength(45)
    expect(result.pages).toBe(3)
    expect(result.truncated).toBe(false)
    expect(result.mutedPosts).toEqual([])
    expect(bridgeRequest).toHaveBeenCalledWith('get_ranked_posts', expect.objectContaining({
      tag: 'hive-139531',
      sort: 'created',
      limit: 20,
      start_author: 'author19',
      start_permlink: 'post-19'
    }))
  })

  it('marks a result truncated when the page budget is exhausted', async () => {
    const page = Array.from({ length: 20 }, (_, index) => post(index))
    bridgeRequest.mockImplementation(async (method, params) => {
      if (params.sort === 'muted') return []
      return page
    })

    const { fetchCommunityInsightData } = await community()
    const result = await fetchCommunityInsightData('hive-139531', { maxPages: 2, now: '2026-11-18T12:00:00Z' })

    expect(result.pages).toBe(2)
    expect(result.posts).toHaveLength(20)
    expect(result.truncated).toBe(true)
  })

  it('throws when the first page fails and tolerates a muted-feed failure', async () => {
    bridgeRequest.mockRejectedValueOnce(new Error('ranked feed failed'))
    const first = await community()
    await expect(first.fetchCommunityInsightData('hive-139531')).rejects.toThrow('ranked feed failed')

    bridgeRequest.mockReset()
    bridgeRequest.mockImplementation(async (method, params) => {
      if (params.sort === 'muted') throw new Error('muted feed failed')
      return [post(1)]
    })
    const second = await community()
    const result = await second.fetchCommunityInsightData('hive-139531')
    expect(result.posts).toHaveLength(1)
    expect(result.mutedPosts).toEqual([])
  })
})
