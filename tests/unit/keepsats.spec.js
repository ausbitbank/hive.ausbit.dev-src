import { describe, expect, it } from 'vitest'
import {
  buildKeepsatsConvert,
  buildKeepsatsDeposit,
  buildKeepsatsTransfer,
  describeKeepsatsCustomJson,
  normalizeKeepsats,
  parseKeepsatsCustomJson
} from '../../src/services/keepsats'

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


describe('Keepsats on-chain instructions', () => {
  it('builds a deposit as a normal transfer with #sats', () => {
    expect(buildKeepsatsDeposit({ from: '@Alice', amount: 2.5, asset: 'HBD' })).toEqual(['transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '2.500 HBD',
      memo: '#sats'
    }])
    expect(buildKeepsatsDeposit({ from: 'alice', amount: 1, asset: 'HIVE' })).toEqual(['transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '1.000 HIVE',
      memo: '#sats'
    }])
    expect(() => buildKeepsatsDeposit({ from: 'alice', amount: 0 })).toThrow(/amount/i)
  })

  it('builds a conversion custom_json with the active authority', () => {
    const [type, data] = buildKeepsatsConvert({ from: 'alice', sats: 1234, asset: 'hbd' })
    expect(type).toBe('custom_json')
    expect(data).toMatchObject({
      required_auths: ['alice'],
      required_posting_auths: [],
      id: 'v4vapp_transfer'
    })
    expect(JSON.parse(data.json)).toEqual({
      from_account: 'alice',
      to_account: 'v4vapp',
      sats: '1234',
      memo: '#HBD'
    })
  })

  it('builds invoice and address payments, omitting sats for a fixed invoice', () => {
    const invoice = buildKeepsatsTransfer({
      from: 'alice',
      sats: null,
      memo: 'lnbc1000u1pabc'
    })
    expect(JSON.parse(invoice[1].json)).toEqual({
      from_account: 'alice',
      to_account: 'v4vapp',
      memo: 'lnbc1000u1pabc'
    })

    const address = buildKeepsatsTransfer({
      from: 'alice',
      sats: 5000,
      memo: 'bob@getalby.com',
      invoiceMessage: 'coffee'
    })
    expect(JSON.parse(address[1].json)).toEqual({
      from_account: 'alice',
      to_account: 'v4vapp',
      sats: '5000',
      memo: 'bob@getalby.com',
      invoice_message: 'coffee'
    })
  })

  it('describes custom_json operations for the queue and wallet', () => {
    const convert = { id: 'v4vapp_transfer', json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', sats: '1234', memo: '#HBD' }) }
    expect(parseKeepsatsCustomJson(convert)).toMatchObject({
      from: 'alice',
      to: 'v4vapp',
      sats: 1234,
      memo: '#HBD',
      notification: false
    })
    expect(describeKeepsatsCustomJson(convert)).toBe('Convert keepsats to HBD')

    const invoice = { id: 'v4vapp_transfer', json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', memo: 'lnbc1000u1pabc' }) }
    expect(describeKeepsatsCustomJson(invoice)).toBe('Pay Lightning invoice with keepsats')

    const address = { id: 'v4vapp_transfer', json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', memo: 'bob@getalby.com', sats: '5000' }) }
    expect(describeKeepsatsCustomJson(address)).toBe('Send keepsats to bob@getalby.com')

    const notification = { id: 'v4vapp_notification', json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', memo: 'Paid', parent_id: 'XYZ', notification: true }) }
    expect(parseKeepsatsCustomJson(notification)).toMatchObject({ notification: true, parentId: 'XYZ' })
    expect(describeKeepsatsCustomJson(notification)).toBe('v4vapp notification · XYZ')
  })
})
