import { describe, expect, it } from 'vitest'
import {
  describeTransactionStatus,
  findTransactionNeighbours,
  formatRcCost,
  shortTxId,
  transactionNumber
} from '../../src/services/transactions'

describe('transaction helpers', () => {
  it('shortens long transaction ids without mangling short ones', () => {
    expect(shortTxId('7ad5edd0997430be8eaa48ead159b2cfb8f5b606')).toBe('7ad5edd099…f5b606')
    expect(shortTxId('abc')).toBe('abc')
    expect(shortTxId(null)).toBe('')
  })

  it('describes reversible, irreversible and unknown statuses', () => {
    expect(describeTransactionStatus({ status: 'within_reversible_block' })).toEqual({
      label: 'Reversible',
      color: 'orange',
      detail: 'Within a reversible block'
    })
    expect(describeTransactionStatus({ status: 'within_irreversible_block' })).toEqual({
      label: 'Irreversible',
      color: 'blue-grey-9',
      detail: 'Within an irreversible block'
    })
    expect(describeTransactionStatus({ status: 'too_old' })).toEqual({
      label: 'Confirmed',
      color: 'blue-grey-9',
      detail: 'too old'
    })
    expect(describeTransactionStatus(null).detail).toBe('Included in block')
  })

  it('returns a 1-based transaction number', () => {
    expect(transactionNumber({ transaction_num: 0 })).toBe(1)
    expect(transactionNumber({ transaction_num: 19 })).toBe(20)
    expect(transactionNumber({})).toBe('—')
  })

  it('formats RC cost safely', () => {
    expect(formatRcCost({ rc_cost: 134826847 })).toBe('134,826,847')
    expect(formatRcCost({})).toBe('—')
  })

  it('finds transaction neighbours inside a block', () => {
    const transactions = [
      { transaction_id: 'a' },
      { transaction_id: 'b' },
      { transaction_id: 'c' }
    ]
    expect(findTransactionNeighbours(transactions, 'b')).toEqual({ index: 1, prevId: 'a', nextId: 'c' })
    expect(findTransactionNeighbours(transactions, 'a')).toEqual({ index: 0, prevId: null, nextId: 'b' })
    expect(findTransactionNeighbours(transactions, 'c')).toEqual({ index: 2, prevId: 'b', nextId: null })
    expect(findTransactionNeighbours(transactions, 'missing')).toEqual({ index: -1, prevId: null, nextId: null })
    expect(findTransactionNeighbours(null, 'a')).toEqual({ index: -1, prevId: null, nextId: null })
  })
})
