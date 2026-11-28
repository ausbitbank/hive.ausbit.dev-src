import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcRequest, getApiConfig, fetchAccounts } = vi.hoisted(() => ({
  rpcRequest: vi.fn(),
  getApiConfig: vi.fn(),
  fetchAccounts: vi.fn()
}))

vi.mock('../../src/services/api', () => ({ rpcRequest, getApiConfig }))
vi.mock('../../src/services/chainData', () => ({ fetchAccounts }))

async function witnessVoters () {
  return import('../../src/services/witnessVoters')
}

describe('fetchWitnessVoters', () => {
  beforeEach(() => {
    rpcRequest.mockReset()
    getApiConfig.mockReset().mockReturnValue({ node: 'https://api.hive.blog' })
    fetchAccounts.mockReset()
  })

  it('falls back to another node when the first response is not a vote list', async () => {
    rpcRequest
      .mockResolvedValueOnce({}) // api.hive.blog OpenAPI-shaped stub
      .mockResolvedValueOnce({ votes: [{ account: 'alice', witness: 'gtg' }, { account: 'bob', witness: 'gtg' }] })

    const { fetchWitnessVoters } = await witnessVoters()
    const voters = await fetchWitnessVoters('gtg')

    expect(voters).toEqual(['alice', 'bob'])
    expect(rpcRequest).toHaveBeenCalledTimes(2)
    expect(rpcRequest.mock.calls[1][2]).toMatchObject({ node: 'https://api.openhive.network', retries: 0 })
  })

  it('returns an empty list when every node answers without votes', async () => {
    rpcRequest.mockResolvedValue({})
    const { fetchWitnessVoters } = await witnessVoters()
    expect(await fetchWitnessVoters('gtg')).toEqual([])
  })

  it('excludes rows for another witness and stops at the boundary', async () => {
    rpcRequest.mockResolvedValueOnce({
      votes: [
        { account: 'alice', witness: 'gtg' },
        { account: 'bob', witness: 'someone-else' }
      ]
    })
    const { fetchWitnessVoters } = await witnessVoters()
    expect(await fetchWitnessVoters('gtg')).toEqual(['alice'])
    expect(rpcRequest).toHaveBeenCalledTimes(1)
  })

  it('samples only the requested number of voter accounts', async () => {
    rpcRequest.mockResolvedValueOnce({ votes: [{ account: 'alice' }, { account: 'bob' }, { account: 'carol' }] })
    fetchAccounts.mockImplementation(async names => names.map(name => ({ name })))

    const { fetchWitnessVoterSample } = await witnessVoters()
    const sample = await fetchWitnessVoterSample('gtg', { limit: 10, accountLimit: 2 })

    expect(sample.voters).toEqual(['alice', 'bob', 'carol'])
    expect(sample.sampledNames).toBe(2)
    expect(fetchAccounts).toHaveBeenCalledWith(['alice', 'bob'])
  })
})
