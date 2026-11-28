import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGetAccountHistoryFiltered: vi.fn(),
  apiGetActiveVotes: vi.fn(),
  loadCached: vi.fn((_key, fetcher) => fetcher())
}))

vi.mock('../../src/services/api', () => ({
  apiGetAccountHistoryFiltered: mocks.apiGetAccountHistoryFiltered,
  apiGetActiveVotes: mocks.apiGetActiveVotes
}))

vi.mock('../../src/services/cache', () => ({
  loadCached: mocks.loadCached
}))

const { fetchAccountVoteHistoryPage, fetchActiveVotes } = await import('../../src/services/accountDownvotes')

function row (index, { voter = 'voter', permlink = 'post', weight = -1000 } = {}) {
  return [index, {
    op: ['vote', { voter, author: 'alice', permlink, weight }],
    timestamp: '2026-11-24T00:00:00',
    trx_id: 'trx' + index
  }]
}

beforeEach(() => {
  mocks.apiGetAccountHistoryFiltered.mockReset()
  mocks.apiGetActiveVotes.mockReset()
  mocks.loadCached.mockReset()
  mocks.loadCached.mockImplementation((_key, fetcher) => fetcher())
})

describe('account vote history pages', () => {
  it('pages backwards from the newest cursor and reports hasMore', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index + 1000))
    mocks.apiGetAccountHistoryFiltered
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([row(999), row(1000)])

    const first = await fetchAccountVoteHistoryPage('Alice')
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(1, 'alice', -1, 1000, '1', null)
    expect(first).toMatchObject({ scanned: 1000, nextCursor: 999, hasMore: true })
    expect(first.rows[0].index).toBe(1999)
    expect(first.rows[first.rows.length - 1].index).toBe(1000)

    const second = await fetchAccountVoteHistoryPage('alice', { cursor: first.nextCursor })
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(2, 'alice', 999, 1000, '1', null)
    expect(second).toMatchObject({ scanned: 2, nextCursor: null, hasMore: false })
  })

  it('stops at the oldest history operation', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index))
    mocks.apiGetAccountHistoryFiltered.mockResolvedValue(firstPage)
    const page = await fetchAccountVoteHistoryPage('alice')
    expect(page.nextCursor).toBeNull()
    expect(page.hasMore).toBe(false)
    expect(page.scanned).toBe(1000)
  })

  it('treats a short page as the end', async () => {
    mocks.apiGetAccountHistoryFiltered.mockResolvedValue([row(999), row(1000)])
    const page = await fetchAccountVoteHistoryPage('alice')
    expect(page.nextCursor).toBeNull()
    expect(page.hasMore).toBe(false)
  })

  it('retries a filtered-operation gap from the sequence cursor', async () => {
    mocks.apiGetAccountHistoryFiltered
      .mockRejectedValueOnce({ data: { stack: [{ data: { sequence: 500 } }] } })
      .mockResolvedValueOnce([row(501)])

    const page = await fetchAccountVoteHistoryPage('alice')
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(1, 'alice', -1, 1000, '1', null)
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(2, 'alice', 500, 1000, '1', null)
    expect(page.rows).toHaveLength(1)
    expect(page.hasMore).toBe(false)
  })

  it('rejects a malformed history response', async () => {
    mocks.apiGetAccountHistoryFiltered.mockResolvedValue({ error: 'stub' })
    await expect(fetchAccountVoteHistoryPage('alice')).rejects.toThrow('Unexpected vote history response')
  })

  it('returns an empty terminal page without calling the API for a blank account', async () => {
    const page = await fetchAccountVoteHistoryPage('')
    expect(page).toEqual({ rows: [], scanned: 0, nextCursor: null, hasMore: false })
    expect(mocks.apiGetAccountHistoryFiltered).not.toHaveBeenCalled()
  })
})

describe('active votes', () => {
  it('normalizes active votes', async () => {
    mocks.apiGetActiveVotes.mockResolvedValue([
      { voter: 'bob', rshares: -100, percent: -10000, reputation: 1, time: '2026-11-24T00:00:00' }
    ])
    const votes = await fetchActiveVotes('Alice', 'post')
    expect(votes).toEqual([{
      voter: 'bob',
      rshares: -100,
      percent: -10000,
      reputation: 1,
      time: '2026-11-24T00:00:00'
    }])
  })

  it('rejects a malformed active-votes response', async () => {
    mocks.apiGetActiveVotes.mockResolvedValue(null)
    await expect(fetchActiveVotes('alice', 'post')).rejects.toThrow('Unexpected active votes response')
  })
})
