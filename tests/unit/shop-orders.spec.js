import { describe, expect, it } from 'vitest'
import {
  buildCancelOperation,
  collectOrders,
  formatRecurrence,
  orderFromHistoryRow,
  parseAmount,
  parseProductRef,
  parsePurchaseMemo,
  productKey,
  productRefLabel,
  subscriptionFromRecurrent
} from '../../src/services/shopOrders'

const MEMO = '{"product":"alice/managed-hosting","quantity":1}'

function historyRow ({
  index = 1,
  trxId = 'trx-1',
  timestamp = '2026-11-27T10:00:00',
  block = 100,
  op = 'transfer',
  from = 'buyer',
  to = 'alice',
  amount = '25.000 HBD',
  memo = MEMO,
  recurrence,
  executions
} = {}) {
  const body = { from, to, amount, memo }
  if (recurrence !== undefined) body.recurrence = recurrence
  if (executions !== undefined) body.executions = executions
  return [index, {
    op: [op, body],
    timestamp,
    trx_id: trxId,
    block
  }]
}

function recurrentRow (overrides = {}) {
  return {
    id: 501,
    trigger_date: '2026-12-27T10:00:00',
    from: 'buyer',
    to: 'alice',
    amount: '50.000 HBD',
    memo: MEMO,
    recurrence: 730,
    consecutive_failures: 0,
    remaining_executions: 11,
    pair_id: 77,
    ...overrides
  }
}

describe('parsePurchaseMemo', () => {
  it('parses a valid product memo and normalises the author', () => {
    expect(parsePurchaseMemo('{"product":"Alice/managed-hosting","quantity":2}')).toEqual({
      product: { author: 'alice', permlink: 'managed-hosting' },
      quantity: 2
    })
    expect(parsePurchaseMemo('  {"product":"alice/managed-hosting","quantity":1}  ')).toEqual({
      product: { author: 'alice', permlink: 'managed-hosting' },
      quantity: 1
    })
  })

  it('ignores the optional custom key and floors fractional quantities', () => {
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting","quantity":2.9,"custom":{"note":"gift"}}')).toEqual({
      product: { author: 'alice', permlink: 'managed-hosting' },
      quantity: 2
    })
  })

  it('rejects invalid JSON and non-object roots', () => {
    expect(parsePurchaseMemo('not json')).toBeNull()
    expect(parsePurchaseMemo('')).toBeNull()
    expect(parsePurchaseMemo(null)).toBeNull()
    expect(parsePurchaseMemo('[]')).toBeNull()
    expect(parsePurchaseMemo('"alice/managed-hosting"')).toBeNull()
    expect(parsePurchaseMemo('null')).toBeNull()
  })

  it('rejects missing, unsafe and malformed product references', () => {
    expect(parsePurchaseMemo('{"quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"ab/managed-hosting","quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"-alice/managed-hosting","quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/managed hosting","quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting/extra","quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/","quantity":1}')).toBeNull()
    expect(parsePurchaseMemo('{"product":42,"quantity":1}')).toBeNull()
  })

  it('rejects missing, non-numeric and non-positive quantities', () => {
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting"}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting","quantity":"2"}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting","quantity":0}')).toBeNull()
    expect(parsePurchaseMemo('{"product":"alice/managed-hosting","quantity":-1}')).toBeNull()
  })
})

describe('product references and amounts', () => {
  it('parses author/permlink references and rejects malformed ones', () => {
    expect(parseProductRef('Alice/managed-hosting')).toEqual({
      author: 'alice',
      permlink: 'managed-hosting'
    })
    expect(parseProductRef('alice/a/b')).toBeNull()
    expect(parseProductRef('ab/post')).toBeNull()
    expect(parseProductRef('alice/')).toBeNull()
    expect(parseProductRef('alice')).toBeNull()
    expect(parseProductRef(null)).toBeNull()
  })

  it('builds stable keys and safe display fallbacks', () => {
    expect(productKey({ author: 'Alice', permlink: 'Managed-Hosting' })).toBe('alice/managed-hosting')
    expect(productKey('alice/managed-hosting')).toBe('alice/managed-hosting')
    expect(productKey('bad ref')).toBe('')
    expect(productRefLabel({ author: 'Alice', permlink: 'managed-hosting' })).toBe('alice/managed-hosting')
    expect(productRefLabel({ author: 'bad name', permlink: 'post' })).toBe('')
  })

  it('keeps chain amounts as strings', () => {
    expect(parseAmount('50.000 HBD')).toEqual({ value: '50.000', currency: 'HBD', label: '50.000 HBD' })
    expect(parseAmount('3 hive')).toEqual({ value: '3', currency: 'HIVE', label: '3 HIVE' })
    expect(parseAmount('50.000 USD')).toBeNull()
    expect(parseAmount(50)).toBeNull()
  })

  it('formats recurrences in hours and days', () => {
    expect(formatRecurrence(730)).toBe('730 hours (30.4 days)')
    expect(formatRecurrence(168)).toBe('7 days')
    expect(formatRecurrence(24)).toBe('1 day')
    expect(formatRecurrence(0)).toBe('')
  })
})

describe('history classification', () => {
  it('treats an outgoing product transfer as a purchase', () => {
    expect(orderFromHistoryRow(historyRow(), 'buyer')).toEqual({
      id: 'trx-1:1',
      kind: 'purchase',
      direction: 'out',
      counterparty: 'alice',
      author: 'alice',
      permlink: 'managed-hosting',
      quantity: 1,
      amount: '25.000 HBD',
      currency: 'HBD',
      timestamp: '2026-11-27T10:00:00',
      memo: MEMO,
      recurring: false,
      recurrenceHours: 0,
      vault: false
    })
  })

  it('marks a Vault membership memo without importing the Vault crypto layer', () => {
    const memo = JSON.stringify({
      product: 'alice/membership',
      quantity: 1,
      banksia: { v: 1, plan: 'member', reader_key: 'p256:abc', sub: 'sub-1234567890123456', gift_for: null }
    })
    const order = orderFromHistoryRow(historyRow({
      memo,
      amount: '5.000 HBD'
    }), 'buyer')
    expect(order).toMatchObject({ vault: true, author: 'alice', permlink: 'membership', amount: '5.000 HBD' })
  })

  it('treats an incoming product transfer as a sale', () => {
    const order = orderFromHistoryRow(historyRow({ from: 'someone', to: 'shop', amount: '9.500 HIVE' }), 'shop')
    expect(order).toMatchObject({
      kind: 'sale',
      direction: 'in',
      counterparty: 'someone',
      amount: '9.500 HIVE',
      currency: 'HIVE'
    })
  })

  it('recognises recurring transfers and copies the recurrence', () => {
    const order = orderFromHistoryRow(historyRow({
      op: 'recurrent_transfer',
      from: 'buyer',
      to: 'alice',
      recurrence: 730,
      executions: 11
    }), 'buyer')
    expect(order).toMatchObject({ kind: 'purchase', recurring: true, recurrenceHours: 730 })
  })

  it('ignores non-product memos, unrelated accounts, zero amounts and malformed rows', () => {
    expect(orderFromHistoryRow(historyRow({ memo: 'thanks!' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(historyRow({ memo: '{"product":"alice/managed-hosting"}' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(historyRow({ from: 'a', to: 'b' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(historyRow({ amount: '0.000 HBD' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(historyRow({ amount: '25.000 USD' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(historyRow({ op: 'vote' }), 'buyer')).toBeNull()
    expect(orderFromHistoryRow(null, 'buyer')).toBeNull()
  })
})

describe('collectOrders', () => {
  it('dedupes rows by trx_id and index and sorts newest first', () => {
    const rows = [
      historyRow({ index: 1, trxId: 'old', timestamp: '2026-11-20T10:00:00' }),
      historyRow({ index: 2, trxId: 'new', timestamp: '2026-11-27T10:00:00' }),
      historyRow({ index: 2, trxId: 'new', timestamp: '2026-11-27T10:00:00' }),
      historyRow({ index: 3, trxId: 'new', timestamp: '2026-11-27T10:00:00', memo: 'not a product' })
    ]
    const { purchases, sales } = collectOrders(rows, 'buyer')
    expect(purchases.map(order => order.id)).toEqual(['new:2', 'old:1'])
    expect(sales).toEqual([])
  })

  it('keeps the same transaction id when the history indexes differ', () => {
    const rows = [
      historyRow({ index: 4, trxId: 'same' }),
      historyRow({ index: 5, trxId: 'same', timestamp: '2026-11-27T11:00:00' })
    ]
    const { purchases } = collectOrders(rows, 'buyer')
    expect(purchases.map(order => order.id)).toEqual(['same:5', 'same:4'])
  })

  it('splits purchases and sales and ignores non-product rows', () => {
    const rows = [
      historyRow({ index: 1, trxId: 'buy', from: 'buyer', to: 'alice' }),
      historyRow({ index: 2, trxId: 'sell', from: 'someone', to: 'buyer' }),
      historyRow({ index: 3, trxId: 'other', from: 'a', to: 'b' }),
      historyRow({ index: 4, trxId: 'chat', memo: 'hello' })
    ]
    const { purchases, sales } = collectOrders(rows, 'buyer')
    expect(purchases.map(order => order.id)).toEqual(['buy:1'])
    expect(sales.map(order => order.id)).toEqual(['sell:2'])
  })

  it('returns empty lists for missing or non-array input', () => {
    expect(collectOrders(null, 'buyer')).toEqual({ purchases: [], sales: [] })
    expect(collectOrders([], 'buyer')).toEqual({ purchases: [], sales: [] })
  })
})

describe('subscriptionFromRecurrent', () => {
  it('parses an active recurring transfer row', () => {
    expect(subscriptionFromRecurrent(recurrentRow())).toEqual({
      id: '501',
      to: 'alice',
      from: 'buyer',
      amount: '50.000 HBD',
      currency: 'HBD',
      memo: MEMO,
      recurrenceHours: 730,
      remainingExecutions: 11,
      nextExecution: '2026-12-27T10:00:00',
      pairId: 77,
      product: { author: 'alice', permlink: 'managed-hosting' },
      vault: false
    })
  })

  it('recognises a Vault membership recurring transfer', () => {
    const memo = JSON.stringify({
      product: 'alice/membership',
      quantity: 1,
      banksia: { v: 1, plan: 'member', reader_key: 'p256:abc', sub: 'sub-1234567890123456', gift_for: null }
    })
    expect(subscriptionFromRecurrent(recurrentRow({
      memo,
      amount: '5.000 HBD'
    }))).toMatchObject({ vault: true, product: { author: 'alice', permlink: 'membership' } })
  })

  it('defaults an absent pair id to zero and a missing count to null', () => {
    const subscription = subscriptionFromRecurrent(recurrentRow({
      pair_id: undefined,
      remaining_executions: undefined
    }))
    expect(subscription.pairId).toBe(0)
    expect(subscription.remainingExecutions).toBeNull()
  })

  it('rejects cancelled, malformed and non-product rows', () => {
    expect(subscriptionFromRecurrent(recurrentRow({ amount: '0.000 HBD' }))).toBeNull()
    expect(subscriptionFromRecurrent(recurrentRow({ memo: 'not a product' }))).toBeNull()
    expect(subscriptionFromRecurrent(recurrentRow({ recurrence: 0 }))).toBeNull()
    expect(subscriptionFromRecurrent(recurrentRow({ from: 'ab' }))).toBeNull()
    expect(subscriptionFromRecurrent(null)).toBeNull()
  })
})

describe('buildCancelOperation', () => {
  it('builds the exact HF28 cancellation with pair_id and executions 2', () => {
    const subscription = subscriptionFromRecurrent(recurrentRow())
    expect(buildCancelOperation(subscription, 'buyer')).toEqual([
      'recurrent_transfer',
      {
        to: 'alice',
        from: 'buyer',
        amount: '0.000 HBD',
        memo: MEMO,
        recurrence: 730,
        executions: 2,
        extensions: [{ type: 1, value: { pair_id: 77 } }]
      }
    ])
  })

  it('uses empty extensions when the pair id is zero', () => {
    const subscription = subscriptionFromRecurrent(recurrentRow({ pair_id: 0, amount: '2.500 HIVE' }))
    expect(buildCancelOperation(subscription, 'buyer')).toEqual([
      'recurrent_transfer',
      {
        to: 'alice',
        from: 'buyer',
        amount: '0.000 HIVE',
        memo: MEMO,
        recurrence: 730,
        executions: 2,
        extensions: []
      }
    ])
  })

  it('accepts a case-insensitive username but refuses another account', () => {
    const subscription = subscriptionFromRecurrent(recurrentRow())
    expect(buildCancelOperation(subscription, 'Buyer')[1].from).toBe('buyer')
    expect(buildCancelOperation(subscription, 'alice')).toBeNull()
    expect(buildCancelOperation(subscription, '')).toBeNull()
  })

  it('returns null for zero-amount, malformed and incomplete subscriptions', () => {
    const subscription = subscriptionFromRecurrent(recurrentRow())
    expect(buildCancelOperation({ ...subscription, amount: '0.000 HBD' }, 'buyer')).toBeNull()
    expect(buildCancelOperation({ ...subscription, memo: '' }, 'buyer')).toBeNull()
    expect(buildCancelOperation({ ...subscription, recurrenceHours: 0 }, 'buyer')).toBeNull()
    expect(buildCancelOperation(null, 'buyer')).toBeNull()
  })
})
