import { describe, expect, it } from 'vitest'
import { magiAccountName, magiAmount, magiBalances, magiLedgerRows } from '../../src/services/magi'

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
})
