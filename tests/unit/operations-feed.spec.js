import { describe, expect, it } from 'vitest'
import {
  filterLabel,
  filterOperations,
  normaliseHistoryEntry,
  operationFilterFor
} from '../../src/services/operationsFeed'

function history (type, data = {}, extra = {}) {
  return [1, {
    timestamp: '2026-11-20T10:00:00',
    block: 111758685,
    trx_id: 'abc123',
    op: [type, data],
    ...extra
  }]
}

describe('operations feed', () => {
  it('normalises a history row and reuses the queue summary', () => {
    const entry = normaliseHistoryEntry(history('transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE' }))
    expect(entry).toMatchObject({
      type: 'transfer',
      filter: 'transfers',
      block: 111758685,
      trxId: 'abc123',
      label: 'Transfer',
      summary: '1.000 HIVE to @bob'
    })
    expect(normaliseHistoryEntry([1, { op: null }])).toBeNull()
  })

  it('maps operation types to filter families', () => {
    expect(operationFilterFor('vote')).toBe('votes')
    expect(operationFilterFor('custom_json')).toBe('custom')
    expect(operationFilterFor('fill_order')).toBe('market')
    expect(operationFilterFor('unknown_op')).toBe('')
  })

  it('filters by family and custom_json id', () => {
    const rows = [
      history('vote', { author: 'a', permlink: 'p' }),
      history('custom_json', { id: 'follow' }),
      history('custom_json', { id: 'reblog' }),
      history('transfer', { to: 'bob', amount: '1.000 HIVE' })
    ]

    expect(filterOperations(rows, { filters: ['votes'] })).toHaveLength(1)
    expect(filterOperations(rows, { filters: ['custom'] })).toHaveLength(2)
    expect(filterOperations(rows, { filters: ['custom'], jsonIds: ['follow'] })).toHaveLength(1)
    expect(filterOperations(rows, { filters: [] })).toHaveLength(4)
    expect(filterOperations(rows, { filters: ['all'] })).toHaveLength(4)
  })

  it('labels the active filters', () => {
    expect(filterLabel([])).toBe('All operations')
    expect(filterLabel(['all'])).toBe('All operations')
    expect(filterLabel(['votes', 'transfers'])).toBe('Transfers & staking · Votes')
  })
})
