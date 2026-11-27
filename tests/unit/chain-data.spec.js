import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  apiGetAccounts,
  apiGetAccountHistoryFiltered,
  apiGetGlobalProps,
  apiGetWitnessesByVote,
  apiGetFollowers,
  apiGetFollowing
} = vi.hoisted(() => ({
  apiGetAccounts: vi.fn(),
  apiGetAccountHistoryFiltered: vi.fn(),
  apiGetGlobalProps: vi.fn(),
  apiGetWitnessesByVote: vi.fn(),
  apiGetFollowers: vi.fn(),
  apiGetFollowing: vi.fn()
}))

vi.mock('../../src/services/api', () => ({
  apiGetAccounts,
  apiGetAccountHistory: vi.fn(),
  apiGetAccountHistoryFiltered,
  apiGetGlobalProps,
  apiGetWitnessesByVote,
  apiGetWitnessByAccount: vi.fn(),
  apiGetFollowCount: vi.fn(),
  apiGetFollowers,
  apiGetFollowing,
  apiGetMedianHistoryPrice: vi.fn(),
  apiGetTicker: vi.fn(),
  apiGetOpenOrders: vi.fn(),
  bridgeRequest: vi.fn()
}))

async function chainData () {
  return import('../../src/services/chainData')
}

describe('chain data cache', () => {
  beforeEach(() => {
    vi.resetModules()
    apiGetAccounts.mockReset()
    apiGetAccountHistoryFiltered.mockReset()
    apiGetGlobalProps.mockReset()
    apiGetWitnessesByVote.mockReset()
    apiGetFollowers.mockReset()
    apiGetFollowing.mockReset()
  })

  it('caches account reads, supports force and invalidates by account', async () => {
    apiGetAccounts.mockImplementation(async names => names.map(name => ({ name, balance: '1.000 HIVE' })))
    const data = await chainData()

    expect((await data.fetchAccount('alice')).name).toBe('alice')
    expect((await data.fetchAccount('alice')).name).toBe('alice')
    expect(apiGetAccounts).toHaveBeenCalledTimes(1)

    await data.fetchAccount('alice', { force: true })
    expect(apiGetAccounts).toHaveBeenCalledTimes(2)

    data.invalidateAccountCache('alice')
    await data.fetchAccount('alice')
    expect(apiGetAccounts).toHaveBeenCalledTimes(3)
  })

  it('batches missing accounts and reuses cached entries', async () => {
    apiGetAccounts.mockImplementation(async names => names.map(name => ({ name })))
    const data = await chainData()

    expect(await data.fetchAccounts(['alice', 'bob'])).toHaveLength(2)
    expect(apiGetAccounts).toHaveBeenCalledTimes(1)
    expect(apiGetAccounts).toHaveBeenLastCalledWith(['alice', 'bob'])

    expect(await data.fetchAccounts(['alice', 'bob', 'carol'])).toHaveLength(3)
    expect(apiGetAccounts).toHaveBeenCalledTimes(2)
    expect(apiGetAccounts).toHaveBeenLastCalledWith(['carol'])
  })

  it('returns every account even when the cache evicts older entries', async () => {
    const names = Array.from({ length: 450 }, (_, index) => 'user' + String(index).padStart(3, '0'))
    apiGetAccounts.mockImplementation(async batch => batch.map(name => ({ name })))
    const data = await chainData()

    const accounts = await data.fetchAccounts(names)
    expect(accounts).toHaveLength(names.length)
    expect(accounts[0].name).toBe(names[0])
    expect(accounts[accounts.length - 1].name).toBe(names[names.length - 1])
  })

  it('caches global properties and witnesses', async () => {
    apiGetGlobalProps.mockResolvedValue({ head_block_number: 100 })
    apiGetWitnessesByVote.mockResolvedValue([{ owner: 'alice' }])
    const data = await chainData()

    expect((await data.fetchGlobalProps()).head_block_number).toBe(100)
    expect((await data.fetchGlobalProps()).head_block_number).toBe(100)
    expect(apiGetGlobalProps).toHaveBeenCalledTimes(1)

    expect(await data.fetchWitnessesByVote(6)).toHaveLength(1)
    expect(await data.fetchWitnessesByVote(6)).toHaveLength(1)
    expect(apiGetWitnessesByVote).toHaveBeenCalledTimes(1)

    data.invalidateWitnessCache()
    await data.fetchWitnessesByVote(6)
    expect(apiGetWitnessesByVote).toHaveBeenCalledTimes(2)
  })

  it('caches follower and following pages by account and cursor', async () => {
    apiGetFollowers.mockResolvedValue([{ follower: 'alice' }])
    apiGetFollowing.mockResolvedValue([{ following: 'bob' }])
    const data = await chainData()

    expect(await data.fetchConnections('carol', 'followers', { limit: 10 })).toEqual([{ follower: 'alice' }])
    expect(await data.fetchConnections('carol', 'followers', { limit: 10 })).toEqual([{ follower: 'alice' }])
    expect(apiGetFollowers).toHaveBeenCalledTimes(1)
    expect(apiGetFollowers).toHaveBeenCalledWith('carol', '', 10)

    await data.fetchConnections('carol', 'followers', { start: 'alice', limit: 10 })
    expect(apiGetFollowers).toHaveBeenCalledTimes(2)

    expect(await data.fetchConnections('carol', 'following', { limit: 10 })).toEqual([{ following: 'bob' }])
    expect(apiGetFollowing).toHaveBeenCalledWith('carol', '', 10)
  })

  it('pages the viewer following snapshot once and caches it', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => ({ following: 'user' + String(index).padStart(4, '0') }))
    apiGetFollowing
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([{ following: 'zebra' }])
    const data = await chainData()

    const names = await data.fetchFollowingNames('alice')
    expect(names).toHaveLength(1001)
    expect(names[1001 - 1]).toBe('zebra')
    expect(apiGetFollowing).toHaveBeenNthCalledWith(1, 'alice', '', 1000)
    expect(apiGetFollowing).toHaveBeenNthCalledWith(2, 'alice', 'user0999', 1000)

    expect(await data.fetchFollowingNames('alice')).toHaveLength(1001)
    expect(apiGetFollowing).toHaveBeenCalledTimes(2)
  })

  it('keeps the cached following snapshot in step with follow and unfollow', async () => {
    apiGetFollowing.mockResolvedValue([{ following: 'bob' }])
    const data = await chainData()

    const names = await data.fetchFollowingNames('alice')
    expect(data.rememberFollowing('alice', 'carol', true)).toBe(true)
    expect(data.rememberFollowing('alice', 'bob', false)).toBe(true)
    expect(names).toEqual(['carol'])
    expect(await data.fetchFollowingNames('alice')).toEqual(['carol'])
    expect(data.rememberFollowing('nobody', 'carol', true)).toBe(false)
  })

  it('clears every chain-data cache entry', async () => {
    apiGetAccounts.mockImplementation(async names => names.map(name => ({ name })))
    apiGetGlobalProps.mockResolvedValue({ head_block_number: 1 })
    const data = await chainData()

    await data.fetchAccount('alice')
    await data.fetchGlobalProps()
    data.invalidateAllChainData()

    await data.fetchAccount('alice')
    await data.fetchGlobalProps()
    expect(apiGetAccounts).toHaveBeenCalledTimes(2)
    expect(apiGetGlobalProps).toHaveBeenCalledTimes(2)
  })
})

describe('reward history window', () => {
  const NOW = Date.UTC(2026, 0, 1)
  const DAY_MS = 24 * 60 * 60 * 1000

  function rewardRow (index, at) {
    return [index, {
      op: ['producer_reward', { producer: 'alice', vesting_shares: '1000.000000 VESTS' }],
      timestamp: new Date(at).toISOString().replace('T', ' ').replace('Z', '')
    }]
  }

  function page (startIndex, count, at) {
    return Array.from({ length: count }, (_, offset) => rewardRow(startIndex + offset, at))
  }

  beforeEach(() => {
    vi.resetModules()
    apiGetAccountHistoryFiltered.mockReset()
  })

  it('pages backwards until the window start and filters to reward operations', async () => {
    const recent = page(5000, 1000, NOW - 60 * 60 * 1000)
    const boundary = page(4000, 5, NOW - 40 * DAY_MS)
    apiGetAccountHistoryFiltered
      .mockResolvedValueOnce(recent)
      .mockResolvedValueOnce(boundary)
    const data = await chainData()

    const result = await data.fetchAccountRewardHistory('alice', {
      windowDays: 30,
      now: NOW
    })

    expect(result.rows).toHaveLength(1005)
    expect(result.pages).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.complete).toBe(true)
    expect(apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(
      1, 'alice', -1, 1000, expect.any(String), expect.any(String), { signal: null }
    )
    expect(apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(
      2, 'alice', 4999, 1000, expect.any(String), expect.any(String), { signal: null }
    )
  })

  it('stops at the page budget and reports a truncated sample', async () => {
    apiGetAccountHistoryFiltered
      .mockResolvedValueOnce(page(5000, 1000, NOW - 60 * 60 * 1000))
      .mockResolvedValueOnce(page(4000, 1000, NOW - 60 * 60 * 1000))
    const data = await chainData()

    const result = await data.fetchAccountRewardHistory('alice', {
      windowDays: 365,
      maxPages: 2,
      now: NOW
    })

    expect(result.rows).toHaveLength(2000)
    expect(result.pages).toBe(2)
    expect(result.truncated).toBe(true)
    expect(result.complete).toBe(false)
    expect(apiGetAccountHistoryFiltered).toHaveBeenCalledTimes(2)
  })

  it('reports an exhausted account as complete rather than truncated', async () => {
    apiGetAccountHistoryFiltered.mockResolvedValueOnce(page(1, 5, NOW - 2 * DAY_MS))
    const data = await chainData()

    const result = await data.fetchAccountRewardHistory('alice', {
      windowDays: 30,
      now: NOW
    })

    expect(result.rows).toHaveLength(5)
    expect(result.truncated).toBe(false)
    expect(result.complete).toBe(true)
  })

  it('keeps the pages that loaded when a later page fails', async () => {
    apiGetAccountHistoryFiltered
      .mockResolvedValueOnce(page(5000, 1000, NOW - 60 * 60 * 1000))
      .mockRejectedValueOnce(new Error('node fell over'))
    const data = await chainData()

    const result = await data.fetchAccountRewardHistory('alice', {
      windowDays: 365,
      now: NOW
    })

    expect(result.rows).toHaveLength(1000)
    expect(result.truncated).toBe(true)
    expect(result.failed).toBe('node fell over')
  })

  it('resumes from the sequence reported by a history gap', async () => {
    const gap = Object.assign(new Error('gap'), {
      data: { stack: [{ data: { sequence: 42 } }] }
    })
    apiGetAccountHistoryFiltered
      .mockRejectedValueOnce(gap)
      .mockResolvedValueOnce(page(1, 5, NOW - 2 * DAY_MS))
    const data = await chainData()

    const result = await data.fetchAccountRewardHistory('alice', { windowDays: 30, now: NOW })

    expect(result.rows).toHaveLength(5)
    expect(apiGetAccountHistoryFiltered).toHaveBeenNthCalledWith(
      2, 'alice', 42, 1000, expect.any(String), expect.any(String), { signal: null }
    )
  })
})
