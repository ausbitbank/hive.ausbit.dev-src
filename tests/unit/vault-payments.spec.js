import { describe, expect, it } from 'vitest'
import {
  buildCancelOperation,
  buildOneTimeTransferOperation,
  buildRecurrentTransferOperation,
  buildVaultMemo,
  collectVaultPayments,
  nextPaymentDate,
  parseVaultAmount,
  parseVaultMemo,
  periodFor,
  subscriptionExpiry,
  summarizeSubscribers,
  VAULT_CANCEL_MATCHING,
  verifyVaultPayment
} from '../../src/services/vaultPayments'

const READER_KEY = 'p256:' + 'A'.repeat(87)
const OTHER_READER_KEY = 'p256:' + 'B'.repeat(87)
const SUB = 'abcdefghijklmnop1234'
const PRODUCT = 'alice/membership'
const NOW = Date.parse('2026-11-27T13:00:00Z')

const PLAN = {
  author: 'alice',
  product: PRODUCT,
  priceLabel: '5.000 HBD',
  amount: '5.000 HBD',
  currency: 'HBD',
  recurrence: 730,
  executions: 12
}

const MEMO = buildVaultMemo({ product: PRODUCT, readerKey: READER_KEY, sub: SUB })

function transferRow ({
  from = 'bob',
  to = 'alice',
  amount = '5.000 HBD',
  memo = MEMO,
  timestamp = '2026-11-27T12:00:00',
  txid = 'tx-1',
  index = 10
} = {}) {
  return [index, {
    op: ['transfer', { from, to, amount, memo }],
    timestamp,
    trx_id: txid
  }]
}

function fillRow ({
  from = 'bob',
  to = 'alice',
  amount = '5.000 HBD',
  memo = MEMO,
  timestamp = '2026-11-27T12:00:00',
  txid = 'tx-fill-1',
  remaining = 11,
  index = 11
} = {}) {
  return [index, {
    op: ['fill_recurrent_transfer', {
      from,
      to,
      amount,
      memo,
      remaining_executions: remaining
    }],
    timestamp,
    trx_id: txid
  }]
}

describe('amounts and memos', () => {
  it('parses chain amounts without changing their value', () => {
    expect(parseVaultAmount('5.000 HBD')).toEqual({
      value: '5.000',
      currency: 'HBD',
      label: '5.000 HBD',
      number: 5
    })
    expect(parseVaultAmount('2.500 HIVE').currency).toBe('HIVE')
    expect(parseVaultAmount('5.00 HBD')).toBeNull()
    expect(parseVaultAmount('5.000 hbd')).toBeNull()
    expect(parseVaultAmount(5)).toBeNull()
  })

  it('builds the exact HOM memo plus the Banksia extension', () => {
    expect(JSON.parse(MEMO)).toEqual({
      product: PRODUCT,
      quantity: 1,
      banksia: {
        v: 1,
        plan: 'member',
        reader_key: READER_KEY,
        sub: SUB,
        gift_for: null
      }
    })
    expect(parseVaultMemo(MEMO)).toEqual({
      product: { author: 'alice', permlink: 'membership' },
      quantity: 1,
      banksia: {
        v: 1,
        plan: 'member',
        reader_key: READER_KEY,
        sub: SUB,
        gift_for: null
      }
    })
  })

  it('preserves a gift recipient', () => {
    const memo = buildVaultMemo({ product: PRODUCT, readerKey: READER_KEY, sub: SUB, giftFor: 'Bob' })
    expect(parseVaultMemo(memo).banksia.gift_for).toBe('bob')
    expect(buildVaultMemo({ product: PRODUCT, readerKey: READER_KEY, sub: SUB, giftFor: 'not an account' })).toBeNull()
  })

  it('rejects bad reader keys, subs and products', () => {
    expect(buildVaultMemo({ product: PRODUCT, readerKey: 'nope', sub: SUB })).toBeNull()
    expect(buildVaultMemo({ product: PRODUCT, readerKey: 'p256:short', sub: SUB })).toBeNull()
    expect(buildVaultMemo({ product: PRODUCT, readerKey: READER_KEY, sub: 'short' })).toBeNull()
    expect(buildVaultMemo({ product: 'alice', readerKey: READER_KEY, sub: SUB })).toBeNull()
  })

  it('ignores unknown sibling keys when parsing', () => {
    const parsed = JSON.parse(MEMO)
    parsed.custom = { note: 'keep' }
    parsed.banksia.extra = true
    expect(parseVaultMemo(JSON.stringify(parsed)).banksia.sub).toBe(SUB)
    expect(parseVaultMemo('not json')).toBeNull()
    expect(parseVaultMemo(JSON.stringify({ ...parsed, banksia: { ...parsed.banksia, v: 2 } }))).toBeNull()
  })
})

describe('operation builders', () => {
  it('builds an exact recurrent_transfer', () => {
    expect(buildRecurrentTransferOperation({
      from: 'Bob',
      to: 'alice',
      amount: '5.000 HBD',
      memo: MEMO
    })).toEqual(['recurrent_transfer', {
      from: 'bob',
      to: 'alice',
      amount: '5.000 HBD',
      memo: MEMO,
      recurrence: 730,
      executions: 12,
      extensions: []
    }])
  })

  it('builds an exact one-time transfer', () => {
    expect(buildOneTimeTransferOperation({
      from: 'bob',
      to: 'alice',
      amount: '5.000 HBD',
      memo: MEMO
    })).toEqual(['transfer', {
      from: 'bob',
      to: 'alice',
      amount: '5.000 HBD',
      memo: MEMO
    }])
  })

  it('builds an exact zero-amount cancel and keeps the matching note off the wire', () => {
    const operation = buildCancelOperation({
      from: 'bob',
      to: 'alice',
      memo: MEMO
    })
    expect(operation[0]).toBe('recurrent_transfer')
    expect(operation[1]).toEqual({
      from: 'bob',
      to: 'alice',
      amount: '0.000 HBD',
      memo: MEMO,
      recurrence: 730,
      executions: 2,
      extensions: []
    })
    expect(operation.matching).toMatchObject({ rule: 'hf28', tested: false })
    expect(Object.keys(operation)).not.toContain('matching')
    expect(JSON.stringify(operation)).not.toContain('matching')
    expect(VAULT_CANCEL_MATCHING.note).toContain('testnet')
  })

  it('rejects a non-zero cancel and an invalid recurrence', () => {
    expect(buildCancelOperation({ from: 'bob', to: 'alice', amount: '5.000 HBD', memo: MEMO })).toBeNull()
    expect(buildCancelOperation({ from: 'bob', to: 'alice', memo: MEMO, recurrence: 12 })).toBeNull()
  })
})

describe('verifyVaultPayment', () => {
  it('accepts a valid transfer row', () => {
    const result = verifyVaultPayment(transferRow(), PLAN, { now: NOW })
    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      readerKey: READER_KEY,
      sub: SUB,
      amount: '5.000 HBD',
      amountNumber: 5,
      txid: 'tx-1',
      plan: 'member',
      giftFor: null,
      from: 'bob',
      to: 'alice',
      type: 'transfer'
    })
    expect(result.timestamp).toBe('2026-11-27T12:00:00')
  })

  it('accepts an envelope and a raw op tuple', () => {
    const envelope = {
      op: ['transfer', { from: 'bob', to: 'alice', amount: '5.000 HBD', memo: MEMO }],
      timestamp: '2026-11-27T12:00:00',
      trx_id: 'tx-envelope'
    }
    expect(verifyVaultPayment(envelope, PLAN, { now: NOW }).txid).toBe('tx-envelope')

    const tuple = ['transfer', { from: 'bob', to: 'alice', amount: '5.000 HBD', memo: MEMO }]
    const raw = verifyVaultPayment(tuple, PLAN, {
      now: NOW,
      timestamp: '2026-11-27T12:00:00',
      trx_id: 'tx-raw'
    })
    expect(raw.ok).toBe(true)
    expect(raw.txid).toBe('tx-raw')
  })

  it('accepts a fill_recurrent_transfer with remaining executions', () => {
    const result = verifyVaultPayment(fillRow(), PLAN, { now: NOW })
    expect(result.ok).toBe(true)
    expect(result.type).toBe('fill_recurrent_transfer')
    expect(result.remainingExecutions).toBe(11)
  })

  it('treats recurrent_transfer as a plan or cancellation, not a payment', () => {
    const open = [20, {
      op: ['recurrent_transfer', {
        from: 'bob',
        to: 'alice',
        amount: '5.000 HBD',
        memo: MEMO,
        recurrence: 730,
        executions: 12
      }],
      timestamp: '2026-11-27T12:00:00',
      trx_id: 'tx-open'
    }]
    const plan = verifyVaultPayment(open, PLAN, { now: NOW })
    expect(plan.ok).toBe(false)
    expect(plan.code).toBe('not-payment')

    const cancel = [21, {
      op: ['recurrent_transfer', {
        from: 'bob',
        to: 'alice',
        amount: '0.000 HBD',
        memo: MEMO,
        recurrence: 730,
        executions: 2
      }],
      timestamp: '2026-11-27T12:00:00',
      trx_id: 'tx-cancel'
    }]
    expect(verifyVaultPayment(cancel, PLAN, { now: NOW }).reason).toContain('cancellation')
  })

  it('rejects the wrong amount, currency or recipient', () => {
    expect(verifyVaultPayment(transferRow({ amount: '6.000 HBD' }), PLAN, { now: NOW }).code).toBe('amount')
    expect(verifyVaultPayment(transferRow({ amount: '5.000 HIVE' }), PLAN, { now: NOW }).code).toBe('amount')
    expect(verifyVaultPayment(transferRow({ to: 'carol' }), PLAN, { now: NOW }).code).toBe('recipient')
  })

  it('rejects a bad memo or the wrong product', () => {
    expect(verifyVaultPayment(transferRow({ memo: 'hello' }), PLAN, { now: NOW }).code).toBe('memo')
    const otherMemo = buildVaultMemo({
      product: 'alice/other',
      readerKey: READER_KEY,
      sub: SUB
    })
    expect(verifyVaultPayment(transferRow({ memo: otherMemo }), PLAN, { now: NOW }).code).toBe('product')
  })

  it('rejects a duplicate txid', () => {
    const result = verifyVaultPayment(transferRow(), PLAN, {
      now: NOW,
      seenTxIds: new Set(['tx-1'])
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('duplicate')
  })

  it('rejects future and expired one-time payments', () => {
    const future = verifyVaultPayment(transferRow({ timestamp: '2026-11-27T13:10:00' }), PLAN, { now: NOW })
    expect(future.code).toBe('future')

    const expired = verifyVaultPayment(transferRow({ timestamp: '2026-09-01T00:00:00' }), PLAN, { now: NOW })
    expect(expired.code).toBe('expired')
  })

  it('requires remaining_executions on a fill', () => {
    const row = fillRow()
    delete row[1].op[1].remaining_executions
    expect(verifyVaultPayment(row, PLAN, { now: NOW }).code).toBe('recurrence')
  })

  it('checks the fetched product price when one is supplied', () => {
    const product = { author: 'alice', permlink: 'membership', priceLabel: '6.000 HBD' }
    expect(verifyVaultPayment(transferRow(), PLAN, { now: NOW, product }).code).toBe('amount')
    const good = { author: 'alice', permlink: 'membership', priceLabel: '5.000 HBD' }
    expect(verifyVaultPayment(transferRow(), PLAN, { now: NOW, product: good }).ok).toBe(true)
  })

  it('never throws on garbage input', () => {
    expect(() => verifyVaultPayment(null, null)).not.toThrow()
    expect(verifyVaultPayment(null, null).code).toBe('malformed')
    expect(verifyVaultPayment({ nope: true }, PLAN, { now: NOW }).ok).toBe(false)
    expect(verifyVaultPayment(transferRow(), { ...PLAN, currency: 'HIVE' }, { now: NOW }).code).toBe('plan')
  })
})

describe('collectVaultPayments', () => {
  const giftMemo = buildVaultMemo({
    product: PRODUCT,
    readerKey: OTHER_READER_KEY,
    sub: 'giftsub1234567890',
    giftFor: 'erin'
  })

  const history = [
    transferRow({ timestamp: '2026-11-20T00:00:00', txid: 'tx-bob-1', index: 1 }),
    fillRow({ timestamp: '2026-11-25T00:00:00', txid: 'tx-bob-2', remaining: 9, index: 2 }),
    transferRow({
      from: 'carol',
      timestamp: '2026-11-26T00:00:00',
      txid: 'tx-carol-1',
      memo: buildVaultMemo({ product: PRODUCT, readerKey: OTHER_READER_KEY, sub: 'carolsub1234567890' }),
      index: 3
    }),
    transferRow({
      from: 'dave',
      timestamp: '2026-11-24T00:00:00',
      txid: 'tx-gift-1',
      memo: giftMemo,
      index: 4
    }),
    // A replay of tx-bob-1.
    transferRow({ timestamp: '2026-11-20T00:00:00', txid: 'tx-bob-1', index: 5 }),
    // Wrong amount: a payment-looking row that must be reported.
    transferRow({ amount: '7.000 HBD', timestamp: '2026-11-23T00:00:00', txid: 'tx-bad-1', index: 6 })
  ]

  it('collects payments, subscribers and gifts with duplicates split out', () => {
    const collected = collectVaultPayments(history, PLAN, { now: NOW })
    expect(collected.payments).toHaveLength(4)
    expect(collected.gifts).toHaveLength(1)
    expect(collected.duplicates).toHaveLength(1)
    expect(collected.duplicates[0].code).toBe('duplicate')
    expect(collected.invalid).toHaveLength(1)
    expect(collected.invalid[0].code).toBe('amount')

    expect(collected.subscribers).toHaveLength(2)
    const bob = collected.subscribers.find(sub => sub.account === 'bob')
    expect(bob).toMatchObject({
      readerKey: READER_KEY,
      sub: SUB,
      plan: 'member',
      amount: '5.000 HBD',
      lastPayment: '2026-11-25T00:00:00.000Z',
      executionsRemaining: 9,
      txid: 'tx-bob-2',
      active: true
    })
    expect(bob.nextPayment).toBe('2026-12-25T10:00:00.000Z')

    const carol = collected.subscribers.find(sub => sub.account === 'carol')
    expect(carol.executionsRemaining).toBe(0)
    expect(collected.gifts[0].giftFor).toBe('erin')
  })

  it('honours the history limit', () => {
    const collected = collectVaultPayments(history, PLAN, { now: NOW, limit: 2 })
    expect(collected.payments).toHaveLength(2)
    expect(collected.payments[0].txid).toBe('tx-bob-2')
    expect(collected.payments[1].txid).toBe('tx-bob-1')
  })
})

describe('date and subscriber helpers', () => {
  it('computes the next payment and subscription expiry', () => {
    expect(nextPaymentDate('2026-11-27T00:00:00', 730)).toBe('2026-12-27T10:00:00.000Z')
    expect(nextPaymentDate('', 730)).toBe('')
    expect(subscriptionExpiry({ timestamp: '2026-11-27T00:00:00' }, { recurrence: 730 }))
      .toBe('2026-12-27T10:00:00.000Z')
    expect(periodFor('2026-11-27T12:00:00')).toBe('2026-11')
    expect(periodFor('nope')).toBe('')
  })

  it('summarises active, expiring and expired subscribers', () => {
    const summary = summarizeSubscribers([
      { amount: '5.000 HBD', nextPayment: '2026-12-01T00:00:00.000Z' },
      { amount: '10.000 HBD', nextPayment: '2026-12-27T00:00:00.000Z' },
      { amount: '5.000 HBD', nextPayment: '2026-11-01T00:00:00.000Z' }
    ], { now: NOW })
    expect(summary).toEqual({
      active: 2,
      expiring: 1,
      expired: 1,
      mrr: 15,
      currency: 'HBD'
    })
  })

  it('counts an active one-time transfer from its expiry, not nextPayment', () => {
    const summary = summarizeSubscribers([
      {
        amount: '5.000 HBD',
        nextPayment: '',
        expires: '2026-12-27T00:00:00.000Z',
        active: true
      }
    ], { now: NOW })
    expect(summary).toEqual({
      active: 1,
      expiring: 0,
      expired: 0,
      mrr: 5,
      currency: 'HBD'
    })
  })
})
