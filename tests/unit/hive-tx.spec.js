import { describe, expect, it } from 'vitest'
import { normalizeOperation } from '../../src/services/hiveTx'

describe('hive-tx operation normalization', () => {
  it('adds the extensions array that hive-tx requires', () => {
    for (const name of [
      'comment_options',
      'recurrent_transfer',
      'account_update2',
      'update_proposal_votes',
      'claim_account',
      'create_proposal',
      'update_proposal',
      'remove_proposal',
      'create_claimed_account',
      'witness_set_properties'
    ]) {
      const [, body] = normalizeOperation([name, { author: 'alice' }])
      expect(body.extensions).toEqual([])
    }
  })

  it('preserves existing extensions', () => {
    const extensions = [[0, { beneficiaries: [{ account: 'bob', weight: 500 }] }]]
    const [, body] = normalizeOperation(['comment_options', { extensions }])
    expect(body.extensions).toBe(extensions)
  })

  it('strips the trailing Z from operation dates', () => {
    const [, order] = normalizeOperation([
      'limit_order_create',
      { expiration: '2026-11-23T12:00:00Z' }
    ])
    expect(order.expiration).toBe('2026-11-23T12:00:00')

    const [, proposal] = normalizeOperation([
      'create_proposal',
      { start_date: '2026-11-22T12:00:00Z', end_date: '2026-11-29T12:00:00Z' }
    ])
    expect(proposal.start_date).toBe('2026-11-22T12:00:00')
    expect(proposal.end_date).toBe('2026-11-29T12:00:00')
  })

  it('does not mutate the queued operation body', () => {
    const body = { expiration: '2026-11-23T12:00:00Z' }
    normalizeOperation(['limit_order_create', body])
    expect(body.expiration).toBe('2026-11-23T12:00:00Z')
  })
})
