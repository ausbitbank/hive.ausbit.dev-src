import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  apiGetAccounts,
  apiGetGlobalProps,
  apiGetWitnessesByVote
} = vi.hoisted(() => ({
  apiGetAccounts: vi.fn(),
  apiGetGlobalProps: vi.fn(),
  apiGetWitnessesByVote: vi.fn()
}))

vi.mock('../../src/services/api', () => ({
  apiGetAccounts,
  apiGetGlobalProps,
  apiGetWitnessesByVote,
  apiGetWitnessByAccount: vi.fn(),
  apiGetFollowCount: vi.fn(),
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
    apiGetGlobalProps.mockReset()
    apiGetWitnessesByVote.mockReset()
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
