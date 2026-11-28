import { describe, expect, it } from 'vitest'
import { voterSegments } from '../../src/services/witnessVoters'

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE'
}

const NOW = Date.parse('2026-11-18T12:00:00Z')

function account (name, vests, created = '2024-01-01T00:00:00') {
  return {
    name,
    vesting_shares: vests + '.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    created
  }
}

describe('voterSegments', () => {
  it('bands sampled voters by effective HP and account age', () => {
    const voters = ['alice', 'bob', 'carol', 'dave', { account: 'eve' }]
    const accounts = [
      account('alice', 50000, '2025-01-01T00:00:00'),
      account('bob', 1500000, '2020-01-01T00:00:00'),
      account('carol', 500000, '2026-01-01T00:00:00'),
      account('dave', 50000, '2024-01-01T00:00:00')
    ]

    const result = voterSegments(voters, accounts, GLOBAL_PROPS, { now: NOW })

    expect(result.totalVoters).toBe(5)
    expect(result.knownCount).toBe(4)
    expect(result.unknownCount).toBe(1)
    expect(result.totalHp).toBeCloseTo(2100000)
    expect(result.medianHp).toBeCloseTo(275000)
    expect(result.topTenShare).toBeCloseTo(1500000 / 2100000)
    expect(result.hpBands.find(band => band.id === '10k-100k').count).toBe(2)
    expect(result.hpBands.find(band => band.id === '100k-plus').count).toBe(2)
    expect(result.ageBands.find(band => band.id === 'under-1y').count).toBe(1)
    expect(result.ageBands.find(band => band.id === '1-3y').count).toBe(2)
    expect(result.ageBands.find(band => band.id === '5y-plus').count).toBe(1)
    expect(result.topVoters[0].voter).toBe('bob')
    expect(result.topVoters[0].hp).toBeCloseTo(1500000)
  })

  it('handles an empty sample', () => {
    const result = voterSegments([], [], GLOBAL_PROPS, { now: NOW })
    expect(result.totalVoters).toBe(0)
    expect(result.knownCount).toBe(0)
    expect(result.medianHp).toBe(0)
    expect(result.topTenShare).toBe(0)
    expect(result.topVoters).toEqual([])
  })
})
