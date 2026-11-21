import { describe, expect, it } from 'vitest'
import {
  WALLET_CSV_COLUMNS,
  buildWalletCsv,
  walletCsvName
} from '../../src/services/walletExport'

function entry (type, data, timestamp = '2026-11-21T10:00:00') {
  return [1, { op: [type, data], timestamp, trx_id: 'abc123', block: 99 }]
}

describe('wallet CSV export', () => {
  const entries = [
    entry('transfer', {
      from: 'v4vapp',
      to: 'alice',
      amount: '0.421 HIVE',
      memo: 'Converted 77 sats to 0.421 HIVE with fee: 52 sats for alice | thanks | § woVqr/s6PX | Thank you for using v4v.app'
    }),
    entry('transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '1.000 HBD',
      memo: 'lnbc1000u1pabc #v4vapp'
    }),
    entry('transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '5.000 HBD',
      memo: 'alice Deposit to #SATS'
    }),
    entry('transfer', {
      from: 'alice',
      to: 'bob',
      amount: '2.000 HIVE',
      memo: 'lunch'
    }),
    entry('custom_json', {
      id: 'v4vapp_transfer',
      json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', sats: '1234', memo: '#HBD' })
    }),
    entry('custom_json', {
      id: 'v4vapp_notification',
      json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', memo: 'Paid', parent_id: 'XYZ', notification: true })
    })
  ]

  it('exports the documented columns and Lightning fee rows', () => {
    const csv = buildWalletCsv(entries, { username: 'alice' })
    const lines = csv.split('\n')
    expect(lines[0]).toBe(WALLET_CSV_COLUMNS.join(','))
    expect(lines).toHaveLength(7)

    const received = lines[1].split(',')
    expect(received[1]).toBe('lightning')
    expect(received[2]).toBe('in')
    expect(received[3]).toBe('HIVE')
    expect(received[4]).toBe('0.421')
    expect(received[5]).toBe('77')
    expect(received[6]).toBe('52')
    expect(received[8]).toBe('v4vapp')
    expect(received[9]).toBe('woVqr/s6PX')
    expect(received[11]).toBe('abc123')

    const sent = lines[2].split(',')
    expect(sent[1]).toBe('lightning')
    expect(sent[2]).toBe('out')
    expect(sent[3]).toBe('HBD')

    const deposit = lines[3].split(',')
    expect(deposit[1]).toBe('keepsats')

    const plain = lines[4].split(',')
    expect(plain[1]).toBe('hive')
    expect(plain[7]).toBe('')

    const convert = lines[5].split(',')
    expect(convert).toMatchObject([
      '2026-11-21T10:00:00', 'keepsats', 'out', 'sats', '1234', '1234', '', '', 'v4vapp', '', '', 'abc123', 'instruction'
    ])

    const notice = lines[6].split(',')
    expect(notice[2]).toBe('in')
    expect(notice[8]).toBe('v4vapp')
    expect(notice[10]).toBe('XYZ')
    expect(notice[12]).toBe('notification')
  })

  it('skips unrelated operations and names the file per account/day', () => {
    const csv = buildWalletCsv([
      entry('vote', { voter: 'alice', author: 'bob', permlink: 'post', weight: 10000 }),
      entry('custom_json', { id: 'follow', json: '[]' })
    ], { username: 'alice' })
    expect(csv.split('\n')).toHaveLength(1)
    expect(walletCsvName('alice', new Date('2026-11-21T12:00:00Z')))
      .toBe('hive-wallet-alice-2026-11-21.csv')
  })
})
