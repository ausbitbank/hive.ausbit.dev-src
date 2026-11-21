import { describe, expect, it } from 'vitest'
import { normalizeKeepsats } from '../../src/services/keepsats'

describe('Keepsats payload', () => {
  it('normalises the live zero-balance liability shape', () => {
    const data = normalizeKeepsats({
      hive_accname: 'ausbit.vsc',
      net_msats: 0,
      net_hive: 0,
      net_usd: 0,
      net_hbd: 0,
      net_sats: 0,
      in_progress_sats: 0,
      admin: false,
      all_transactions: {
        sub: 'ausbit.vsc',
        last_transaction_date: null,
        hive: '0',
        hbd: '0',
        usd: '0',
        sats: '0',
        in_progress_msats: '0'
      }
    })

    expect(data).toMatchObject({
      account: 'ausbit.vsc',
      netSats: 0,
      netHive: 0,
      netHbd: 0,
      netUsd: 0,
      inProgressSats: 0,
      admin: false,
      hasHistory: false,
      lastAt: ''
    })
  })

  it('reads history opportunistically and tolerates string amounts', () => {
    const data = normalizeKeepsats({
      hive_accname: 'alice',
      net_sats: '12345',
      all_transactions: {
        sub: 'alice',
        sats: '12345',
        in_progress_msats: '1500',
        last_transaction_date: '2026-11-21T10:00:00Z'
      },
      transactions: [
        { type: 'deposit', timestamp: '2026-11-20T10:00:00Z', msats: 500000, memo: 'Deposit to #SATS' },
        { kind: 'conversion', created_at: '2026-11-19T10:00:00Z', sats: 900, parent_id: 'abc' }
      ]
    })

    expect(data.netSats).toBe(12345)
    expect(data.inProgressSats).toBe(1.5)
    expect(data.lastAt).toBe('2026-11-21T10:00:00Z')
    expect(data.hasHistory).toBe(true)
    expect(data.history[0]).toMatchObject({ type: 'deposit', sats: 500, memo: 'Deposit to #SATS' })
    expect(data.history[1]).toMatchObject({ type: 'conversion', sats: 900, ref: 'abc' })
  })
})

