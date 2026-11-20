import { describe, expect, it } from 'vitest'
import {
  formatMagiTokenAmount,
  magiAccountName,
  magiAmount,
  magiBalances,
  magiLedgerRows,
  magiTokenPrices,
  magiTokenRows
} from '../../src/services/magi'

describe('magi', () => {
  it('maps an account into the hive namespace', () => {
    expect(magiAccountName('ausbitbank')).toBe('hive:ausbitbank')
    expect(magiAccountName('@AusbitBank')).toBe('hive:ausbitbank')
    expect(magiAccountName('hive:ausbitbank')).toBe('hive:ausbitbank')
    expect(magiAccountName('')).toBe('')
  })

  it('scales ledger integers to three decimals', () => {
    expect(magiAmount(30064)).toBe(30.064)
    expect(magiAmount(-58493)).toBe(-58.493)
    expect(magiAmount('25')).toBe(0.025)
    expect(magiAmount('nope')).toBe(0)
  })

  it('normalises a balance record', () => {
    const balances = magiBalances({
      account: 'hive:ausbitbank',
      block_height: 109826460,
      hive: 0,
      hbd: 25,
      hive_consensus: 1000,
      hbd_savings: 500,
      consensus_unstaking: 0,
      pending_hbd_unstaking: 250
    })
    expect(balances).toMatchObject({
      account: 'hive:ausbitbank',
      hbd: 0.025,
      consensus: 1,
      hbdSavings: 0.5,
      pendingUnstaking: 0.25
    })
    expect(magiBalances(null)).toBeNull()
  })

  it('formats ledger rows with direction and amount', () => {
    const rows = magiLedgerRows([
      { id: 'a', amount: -58493, asset: 'hive', type: 'withdraw', timestamp: '2026-09-07T08:40:21' },
      { id: 'b', amount: 30064, asset: 'hive', type: 'deposit', timestamp: '2026-06-08T12:34:12' }
    ])
    expect(rows[0]).toMatchObject({ label: 'Magi withdraw', direction: 'out', amountLabel: '58.493 HIVE' })
    expect(rows[1]).toMatchObject({ label: 'Magi deposit', direction: 'in', amountLabel: '30.064 HIVE' })
  })

  it('formats token integers exactly without losing large values', () => {
    expect(formatMagiTokenAmount(123456789, 5)).toBe('1,234.56789')
    expect(formatMagiTokenAmount(1, 8)).toBe('0.00000001')
    expect(formatMagiTokenAmount(100000000, 8)).toBe('1')
    expect(formatMagiTokenAmount('1878581732629513', 8)).toBe('18,785,817.32629513')
    expect(formatMagiTokenAmount('nope', 8)).toBe('0')
  })

  it('merges token balances by contract id, not symbol', () => {
    const rows = magiTokenRows([
      { contract_id: 'vsc1dup-a', balance: 31406299067 },
      { contract_id: 'vsc1dup-b', balance: 1 },
      { contract_id: 'vsc1zero', balance: 0 }
    ], [
      { contract_id: 'vsc1dup-a', symbol: 'LASSECASH', decimals: 8 },
      { contract_id: 'vsc1dup-b', symbol: 'LASSECASH', decimals: 0 }
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      contractId: 'vsc1dup-a',
      symbol: 'LASSECASH',
      amount: 314.06299067,
      amountLabel: '314.06299067'
    })
    expect(rows[1]).toMatchObject({
      contractId: 'vsc1dup-b',
      symbol: 'LASSECASH',
      amount: 1,
      amountLabel: '1'
    })
  })

  it('derives HBD token prices from DEX pool reserves', () => {
    const prices = magiTokenPrices([
      { pool_contract: 'pool-hbd-hive', asset0: 'hbd', asset1: 'hive' },
      { pool_contract: 'pool-hbd-lassecash', asset0: 'hbd', asset1: 'lassecash' },
      { pool_contract: 'pool-hbd-starpro', asset0: 'hbd', asset1: 'starpro' }
    ], [
      { pool_contract: 'pool-hbd-hive', reserve0: 2300434, reserve1: 60252425 },
      { pool_contract: 'pool-hbd-lassecash', reserve0: 31470, reserve1: 4744068444024 },
      { pool_contract: 'pool-hbd-starpro', reserve0: 17000, reserve1: 242857 }
    ], [
      { contract_id: 'vsc1lassecash', symbol: 'LASSECASH', decimals: 8 },
      { contract_id: 'vsc1starpro', symbol: 'STARPRO', decimals: 5 }
    ])

    expect(prices.hbdPerHive).toBeCloseTo(0.03818, 4)
    expect(prices.pricesBySymbol.lassecash.priceHbd).toBeCloseTo(31470 / 1000 / (4744068444024 / 1e8), 8)
    expect(prices.pricesBySymbol.starpro.priceHbd).toBeCloseTo(17000 / 1000 / (242857 / 1e5), 6)
  })

  it('converts token/HIVE pools through the HBD/HIVE pool', () => {
    const prices = magiTokenPrices([
      { pool_contract: 'pool-hbd-hive', asset0: 'hbd', asset1: 'hive' },
      { pool_contract: 'pool-token-hive', asset0: 'hive', asset1: 'token' }
    ], [
      { pool_contract: 'pool-hbd-hive', reserve0: 1000000, reserve1: 2000000 },
      { pool_contract: 'pool-token-hive', reserve0: 500000, reserve1: 25000 }
    ], [
      { contract_id: 'vsc1token', symbol: 'TOKEN', decimals: 0 }
    ])

    expect(prices.pricesBySymbol.token.priceHbd).toBeCloseTo(0.01, 8)
  })
})
