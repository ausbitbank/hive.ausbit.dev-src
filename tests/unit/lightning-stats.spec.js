import { describe, expect, it } from 'vitest'
import { lightningReceivedStats } from '../../src/services/lightningStats'

function entry (type, data, timestamp = '2026-11-21T10:00:00') {
  return [1, { op: [type, data], timestamp, trx_id: 'abc123', block: 99 }]
}

describe('local Lightning received stats', () => {
  it('sums incoming v4vapp transfers and keepsats notifications', () => {
    const stats = lightningReceivedStats([
      entry('transfer', {
        from: 'v4vapp',
        to: 'alice',
        amount: '0.421 HIVE',
        memo: 'Converted 173767 sats to 0.421 HIVE with fee: 5089 sats for alice | § ref | Thank you for using v4v.app'
      }, '2026-11-20T10:00:00'),
      entry('custom_json', {
        id: 'v4vapp_notification',
        json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', msats: '2000', notification: true, memo: 'Paid' })
      }, '2026-11-21T09:00:00'),
      entry('transfer', {
        from: 'alice',
        to: 'v4vapp',
        amount: '1.000 HBD',
        memo: 'lnbc1000u1pabc #v4vapp'
      }, '2026-11-21T11:00:00'),
      entry('transfer', { from: 'bob', to: 'alice', amount: '2.000 HIVE', memo: 'lunch' }),
      entry('custom_json', {
        id: 'v4vapp_notification',
        json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', msats: '0', notification: true, memo: 'Notice' })
      })
    ], 'alice')

    expect(stats).toMatchObject({ count: 2, sats: 173769, fees: 5089, latest: '2026-11-21T09:00:00' })
  })

  it('ignores other accounts and non-v4vapp activity', () => {
    expect(lightningReceivedStats([
      entry('transfer', {
        from: 'v4vapp',
        to: 'alice',
        amount: '0.421 HIVE',
        memo: 'Converted 77 sats to 0.421 HIVE with fee: 52 sats for alice | Thank you for using v4v.app'
      }),
      entry('vote', { voter: 'bob', author: 'alice', permlink: 'post', weight: 1000 })
    ], 'bob')).toMatchObject({ count: 0, sats: 0, fees: 0, latest: '' })
  })
})
