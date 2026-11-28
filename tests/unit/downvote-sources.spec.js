import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGetContent: vi.fn(),
  bridgeRequest: vi.fn(),
  fetchAccountVoteHistoryPage: vi.fn(),
  loadCached: vi.fn((_key, fetcher) => fetcher())
}))

vi.mock('../../src/services/api', () => ({
  apiGetContent: mocks.apiGetContent,
  bridgeRequest: mocks.bridgeRequest
}))

vi.mock('../../src/services/cache', () => ({
  loadCached: mocks.loadCached
}))

vi.mock('../../src/services/accountDownvotes', () => ({
  fetchAccountVoteHistoryPage: mocks.fetchAccountVoteHistoryPage
}))

const {
  fetchDownvoteDiscussion,
  fetchDownvoteTargetPosts,
  fetchVoterComments,
  fetchVoterRecentVotes
} = await import('../../src/services/downvoteSources')

beforeEach(() => {
  mocks.apiGetContent.mockReset()
  mocks.bridgeRequest.mockReset()
  mocks.fetchAccountVoteHistoryPage.mockReset()
  mocks.loadCached.mockReset()
  mocks.loadCached.mockImplementation((_key, fetcher) => fetcher())
})

describe('downvote sources', () => {
  it('fetches a bounded target batch and reports failures', async () => {
    mocks.apiGetContent.mockImplementation(async (author, permlink) => {
      if (permlink === 'missing') throw new Error('not found')
      return { author, permlink, active_votes: [] }
    })
    const progress = []
    const result = await fetchDownvoteTargetPosts(
      ['alice/one', 'alice/missing', 'alice/one', 'bob/two'],
      {
        concurrency: 2,
        onProgress: update => progress.push(update.done)
      }
    )
    expect(Object.keys(result.posts).sort()).toEqual(['alice/one', 'bob/two'])
    expect(result.failed).toEqual(['alice/missing'])
    expect(result.total).toBe(3)
    expect(progress.at(-1)).toBe(3)
  })

  it('caps the target batch at the requested maximum', async () => {
    mocks.apiGetContent.mockResolvedValue({ author: 'a', permlink: 'p' })
    const targets = Array.from({ length: 10 }, (_, index) => 'alice/p' + index)
    const result = await fetchDownvoteTargetPosts(targets, { maxTargets: 4 })
    expect(result.total).toBe(4)
    expect(Object.keys(result.posts)).toHaveLength(4)
  })

  it('rejects a malformed discussion instead of caching an array', async () => {
    mocks.bridgeRequest.mockResolvedValue([])
    await expect(fetchDownvoteDiscussion('alice', 'post')).rejects.toThrow('Unexpected discussion response')
  })

  it('reads a voter comment feed as an array', async () => {
    mocks.bridgeRequest.mockResolvedValue([{ author: 'bob', permlink: 're-1' }])
    const posts = await fetchVoterComments('Bob')
    expect(posts).toHaveLength(1)
    expect(mocks.bridgeRequest).toHaveBeenCalledWith('get_account_posts', expect.objectContaining({ account: 'bob' }))
  })

  it('aggregates downvotes from the voter’s recent history pages', async () => {
    mocks.fetchAccountVoteHistoryPage
      .mockResolvedValueOnce({
        rows: [
          { voter: 'bob', author: 'alice', weight: -1000, target: 'alice/one' },
          { voter: 'bob', author: 'alice', weight: 1000, target: 'alice/two' }
        ],
        scanned: 1000,
        hasMore: true,
        nextCursor: 500
      })
      .mockResolvedValueOnce({
        rows: [{ voter: 'bob', author: 'carol', weight: -500, target: 'carol/three' }],
        scanned: 20,
        hasMore: false,
        nextCursor: null
      })
    const result = await fetchVoterRecentVotes('bob', { pages: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every(row => row.weight < 0)).toBe(true)
    expect(result.scanned).toBe(1020)
    expect(result.hasMore).toBe(false)
  })
})
