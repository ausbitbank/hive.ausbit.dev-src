import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcRequest = vi.fn()

vi.mock('../../src/services/api', () => ({ rpcRequest }))

const { resolveInboundDelegations } = await import('../../src/services/delegations')

function event (counterparty, vests = 1_000_000) {
  return { direction: 'in', counterparty, vests }
}

beforeEach(() => {
  rpcRequest.mockReset()
})

describe('resolveInboundDelegations', () => {
  it('asks each delegator for only the rows at the delegatee cursor', async () => {
    rpcRequest.mockImplementation(async (method, params) => {
      if (params[0] === 'alice') {
        return [{ delegatee: 'bob', vesting_shares: '2000000.000000 VESTS', min_delegation_time: '2026-10-01T00:00:00' }]
      }
      return [{ delegatee: 'carol', vesting_shares: '500000.000000 VESTS' }]
    })

    const rows = await resolveInboundDelegations('bob', [event('alice'), event('carol'), event('alice')])
    expect(rpcRequest).toHaveBeenCalledTimes(2)
    expect(rpcRequest).toHaveBeenCalledWith(
      'condenser_api.get_vesting_delegations',
      ['alice', 'bob', 5],
      expect.any(Object)
    )
    expect(rows).toEqual([
      { delegator: 'alice', delegatee: 'bob', vests: 2000000, vesting_shares: '2000000.000000 VESTS', min_delegation_time: '2026-10-01T00:00:00' }
    ])
  })

  it('ignores outbound/return events and empty input', async () => {
    expect(await resolveInboundDelegations('bob', [])).toEqual([])
    expect(await resolveInboundDelegations('bob', [{ direction: 'out', counterparty: 'alice', vests: 1 }, { direction: 'in', counterparty: 'carol', vests: 0 }])).toEqual([])
    expect(rpcRequest).not.toHaveBeenCalled()
  })

  it('keeps the remaining rows when one delegator lookup fails', async () => {
    rpcRequest.mockImplementation(async (method, params) => {
      if (params[0] === 'alice') throw new Error('node down')
      return [{ delegatee: 'bob', vesting_shares: '1000000.000000 VESTS' }]
    })
    const rows = await resolveInboundDelegations('bob', [event('alice'), event('carol')])
    expect(rows).toEqual([
      { delegator: 'carol', delegatee: 'bob', vests: 1000000, vesting_shares: '1000000.000000 VESTS', min_delegation_time: undefined }
    ])
    expect(rpcRequest).toHaveBeenCalledTimes(2)
  })
})
