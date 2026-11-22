import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiLookupAccounts, bridgeRequest } = vi.hoisted(() => ({
  apiLookupAccounts: vi.fn(),
  bridgeRequest: vi.fn()
}))

vi.mock('../../src/services/api', () => ({ apiLookupAccounts, bridgeRequest }))

async function chainData () {
  return import('../../src/services/chainData')
}

describe('fetchCommunityNameMatches', () => {
  beforeEach(() => {
    vi.resetModules()
    apiLookupAccounts.mockReset()
    bridgeRequest.mockReset()
    apiLookupAccounts.mockResolvedValue([
      'hive-174578',
      'hive-1745',
      'not-a-community',
      'hive-999999'
    ])
    bridgeRequest.mockImplementation(async (method, params) => ({
      name: params.name,
      title: 'Community ' + params.name
    }))
  })

  it('uses account prefix lookup and resolves community records', async () => {
    const data = await chainData()
    const rows = await data.fetchCommunityNameMatches('hive-174', 2)

    expect(apiLookupAccounts).toHaveBeenCalledWith('hive-174', 6)
    expect(rows.map(row => row.name)).toEqual(['hive-174578', 'hive-1745'])
    expect(bridgeRequest).toHaveBeenCalledWith('get_community', expect.objectContaining({ name: 'hive-174578' }))
  })

  it('ignores non-community prefixes and caches repeated lookups', async () => {
    const data = await chainData()
    expect(await data.fetchCommunityNameMatches('photography')).toEqual([])
    expect(apiLookupAccounts).not.toHaveBeenCalled()

    await data.fetchCommunityNameMatches('hive-174', 2)
    await data.fetchCommunityNameMatches('hive-174', 2)
    expect(apiLookupAccounts).toHaveBeenCalledTimes(1)
  })

  it('drops communities the node cannot resolve', async () => {
    bridgeRequest.mockImplementation(async (method, params) => {
      if (params.name === 'hive-1745') throw new Error('missing')
      return { name: params.name, title: 'Community ' + params.name }
    })
    const data = await chainData()
    const rows = await data.fetchCommunityNameMatches('hive-174', 2)
    expect(rows.map(row => row.name)).toEqual(['hive-174578'])
  })
})
