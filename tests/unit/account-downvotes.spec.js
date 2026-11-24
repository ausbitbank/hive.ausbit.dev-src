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

const { fetchAccountVoteHistory, fetchActiveVotes } = await import('../../src/services/accountDownvotes')

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

describe('account vote history', () => {
  it('pages backwards, dedupes and returns newest first', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index + 1000))
    mocks.apiGetAccountHistoryFiltered
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([row(999), row(1000)])

    const result = await fetchAccountVoteHistory('Alice', { pages: 2 })
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(1, 'alice', -1, 1000, '1', null)
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(2, 'alice', 999, 1000, '1', null)
    expect(result.rows[0].index).toBe(1999)
    expect(result.rows[result.rows.length - 1].index).toBe(999)
    expect(new Set(result.rows.map(vote => vote.index)).size).toBe(result.rows.length)
    expect(result.truncated).toBe(false)
  })

  it('marks a full page cap as truncated', async () => {
    const full = Array.from({ length: 1000 }, (_, index) => row(index + 1))
    mocks.apiGetAccountHistoryFiltered.mockResolvedValue(full)
    const result = await fetchAccountVoteHistory('alice', { pages: 1 })
    expect(result.truncated).toBe(true)
  })

  it('retries a filtered-operation gap from the sequence cursor', async () => {
    mocks.apiGetAccountHistoryFiltered
      .mockRejectedValueOnce({ data: { stack: [{ data: { sequence: 500 } }] } })
      .mockResolvedValueOnce([row(501)])

    const result = await fetchAccountVoteHistory('alice', { pages: 1 })
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(1, 'alice', -1, 1000, '1', null)
    expect(mocks.apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(2, 'alice', 500, 1000, '1', null)
    expect(result.rows).toHaveLength(1)
  })

  it('rejects a malformed history response', async () => {
    mocks.apiGetAccountHistoryFiltered.mockResolvedValue({ error: 'stub' })
    await expect(fetchAccountVoteHistory('alice')).rejects.toThrow('Unexpected vote history response')
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
