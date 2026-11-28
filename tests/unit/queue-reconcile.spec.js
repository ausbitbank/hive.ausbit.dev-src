import { describe, expect, it, vi } from 'vitest'
import Queue from '../../src/components/queue.vue'
import {
  HISTORY_LOOKUP_LIMIT,
  RECONCILE_CLOCK_SKEW_MS,
  reconcileFailedBroadcast,
  reconcileHistory,
  reconcileIdentity,
  transactionLookupFound
} from '../../src/services/queueReconcile'

const ATTEMPT = Date.parse('2026-11-28T12:00:00.000Z')
const NOW = ATTEMPT + 10 * 60 * 1000

function action (overrides = {}) {
  return ['alice', 'active', ['transfer', {
    from: 'alice',
    to: 'bob',
    amount: '1.000 HIVE',
    memo: 'Invoice 42',
    ...overrides
  }]]
}

function row (timestamp, op, trxId = 'abc123') {
  return [0, { timestamp, trx_id: trxId, op }]
}

function transferRow (timestamp, overrides = {}, trxId) {
  return row(timestamp, ['transfer', {
    from: 'alice',
    to: 'bob',
    amount: '1.000 HIVE',
    memo: 'Invoice 42',
    ...overrides
  }], trxId)
}

describe('failed active broadcast reconciliation', () => {
  it('builds a narrow identity for transfers and recurrent transfers only', () => {
    expect(reconcileIdentity(action())).toEqual({
      kind: 'transfer',
      fields: { from: 'alice', to: 'bob', amount: '1.000 hive', memo: 'Invoice 42' }
    })
    expect(reconcileIdentity(['alice', 'active', ['transfer', {
      from: ' Alice ',
      to: 'BOB',
      amount: '1.000 hive',
      memo: 'Case matters'
    }]])).toMatchObject({ fields: { from: 'alice', to: 'bob', amount: '1.000 hive', memo: 'Case matters' } })
    expect(reconcileIdentity(['alice', 'active', ['recurrent_transfer', {
      from: 'alice', to: 'bob', amount: '1.000 HBD', memo: '', recurrence: '24', executions: 2
    }]])).toMatchObject({ kind: 'recurrent_transfer', fields: { recurrence: '24' } })
    expect(reconcileIdentity(['alice', 'active', ['limit_order_create', { owner: 'alice' }]])).toBeNull()
    expect(reconcileIdentity(['alice', 'active', ['transfer', { from: '', to: 'bob', amount: '1.000 HIVE' }]])).toBeNull()
    expect(HISTORY_LOOKUP_LIMIT).toBeGreaterThan(0)
  })

  it('finds the original transfer after the attempt and ignores other memos', () => {
    const rows = [
      transferRow('2026-11-28T11:59:00.000Z', { memo: 'Something else' }, 'old'),
      transferRow('2026-11-28T12:00:30.000Z', {}, 'landed')
    ]
    expect(reconcileHistory({ action: action(), rows, attemptedAt: ATTEMPT, now: NOW })).toMatchObject({
      verdict: 'found',
      txId: 'landed'
    })
  })

  it('matches recurrent transfers without requiring the execution count', () => {
    const queued = ['alice', 'active', ['recurrent_transfer', {
      from: 'alice', to: 'bob', amount: '2.000 HBD', memo: 'Rent', recurrence: '24', executions: 2
    }]]
    const rows = [row('2026-11-28T12:01:00.000Z', ['recurrent_transfer', {
      from: 'alice', to: 'bob', amount: '2.000 HBD', memo: 'Rent', recurrence: '24', executions: 2
    }], 'recurrent')]
    expect(reconcileHistory({ action: queued, rows, attemptedAt: ATTEMPT, now: NOW })).toMatchObject({ verdict: 'found', txId: 'recurrent' })
  })

  it('reports absence only when history reaches back past the attempt', () => {
    const rows = [
      transferRow('2026-11-28T11:30:00.000Z', { memo: 'Earlier transfer' }),
      transferRow('2026-11-28T12:02:00.000Z', { memo: 'Different' })
    ]
    expect(reconcileHistory({ action: action(), rows, attemptedAt: ATTEMPT, now: NOW })).toMatchObject({ verdict: 'absent' })
  })

  it('fails closed when the history page is truncated, empty or without an attempt time', () => {
    const truncated = [
      transferRow('2026-11-28T12:01:00.000Z', { memo: 'Different' }),
      transferRow('2026-11-28T12:02:00.000Z', { memo: 'Different again' })
    ]
    expect(reconcileHistory({ action: action(), rows: truncated, attemptedAt: ATTEMPT, now: NOW }).verdict).toBe('uncertain')
    expect(reconcileHistory({ action: action(), rows: [], attemptedAt: ATTEMPT, now: ATTEMPT + 30 * 1000 }).verdict).toBe('uncertain')
    expect(reconcileHistory({ action: action(), rows: [], attemptedAt: ATTEMPT, now: NOW }).verdict).toBe('absent')
    expect(reconcileHistory({ action: action(), rows: truncated, attemptedAt: 0, now: NOW }).verdict).toBe('uncertain')
    expect(RECONCILE_CLOCK_SKEW_MS).toBeGreaterThan(0)
  })

  it('accepts an included transaction and treats a clean miss as absence', () => {
    expect(transactionLookupFound({ block_num: 99123456 })).toBe(true)
    expect(transactionLookupFound({ block_num: 0 })).toBe(false)
    expect(transactionLookupFound(null)).toBe(false)

    expect(reconcileFailedBroadcast({
      action: action(),
      attemptedAt: ATTEMPT,
      tx: { ok: true, status: { block_num: 99123456 }, txId: 'known' },
      rows: []
    })).toMatchObject({ verdict: 'found', txId: 'known', source: 'tx' })

    expect(reconcileFailedBroadcast({
      action: action(),
      attemptedAt: ATTEMPT,
      now: NOW,
      tx: { ok: true, status: { block_num: 0 } },
      rows: []
    })).toMatchObject({ verdict: 'absent', source: 'tx' })

    expect(reconcileFailedBroadcast({
      action: ['alice', 'active', ['limit_order_cancel', { owner: 'alice', orderid: 4 }]],
      attemptedAt: ATTEMPT,
      now: NOW,
      rows: []
    }).verdict).toBe('unsupported')
  })

  it('does not re-broadcast a failed active item that history shows as sent', async () => {
    const queue = [action()]
    const ctx = {
      queue,
      broadcastingIndex: null,
      reconcilingIndex: null,
      metaFor: () => ({ status: 'failed', txId: '', attemptedAt: ATTEMPT }),
      reconcileFailedActive: vi.fn(async () => ({ verdict: 'found', txId: 'abc123', reason: '' })),
      broadcastAt: vi.fn(),
      refreshAfterAction: vi.fn(),
      shortTx: value => value,
      operationLabel: () => 'Transfer',
      $hiveStore: { setQueueStatus: vi.fn(), setQueueTxId: vi.fn() },
      $q: { notify: vi.fn() }
    }

    await Queue.methods.retryAfterReconcile.call(ctx, 0)

    expect(ctx.broadcastAt).not.toHaveBeenCalled()
    expect(ctx.$hiveStore.setQueueStatus).toHaveBeenCalledWith(0, 'sent')
    expect(ctx.$hiveStore.setQueueTxId).toHaveBeenCalledWith(0, 'abc123')
    expect(ctx.$q.notify).toHaveBeenCalledWith(expect.objectContaining({ color: 'green' }))
  })

  it('fails closed and leaves retry available when the lookup is uncertain', async () => {
    const queue = [action()]
    const ctx = {
      queue,
      broadcastingIndex: null,
      reconcilingIndex: null,
      metaFor: () => ({ status: 'failed', txId: '', attemptedAt: ATTEMPT }),
      reconcileFailedActive: vi.fn(async () => ({ verdict: 'uncertain', txId: '', reason: 'Account history could not be read.' })),
      broadcastAt: vi.fn(),
      refreshAfterAction: vi.fn(),
      shortTx: value => value,
      operationLabel: () => 'Transfer',
      $hiveStore: { setQueueStatus: vi.fn(), setQueueTxId: vi.fn() },
      $q: { notify: vi.fn() }
    }

    await Queue.methods.retryAfterReconcile.call(ctx, 0)

    expect(ctx.broadcastAt).not.toHaveBeenCalled()
    expect(ctx.$hiveStore.setQueueStatus).not.toHaveBeenCalled()
    expect(ctx.$q.notify).toHaveBeenCalledWith(expect.objectContaining({ color: 'orange' }))
  })

  it('retries when the original is proven absent, and keeps unsupported operations manual', async () => {
    const queue = [action()]
    const absent = {
      queue,
      broadcastingIndex: null,
      reconcilingIndex: null,
      metaFor: () => ({ status: 'failed', txId: '', attemptedAt: ATTEMPT }),
      reconcileFailedActive: vi.fn(async () => ({ verdict: 'absent', txId: '', reason: '' })),
      broadcastAt: vi.fn(),
      $hiveStore: {},
      $q: { notify: vi.fn() }
    }
    await Queue.methods.retryAfterReconcile.call(absent, 0)
    expect(absent.broadcastAt).toHaveBeenCalledWith(0, { auto: false })

    const unsupported = { ...absent, reconcileFailedActive: vi.fn(async () => ({ verdict: 'unsupported', txId: '', reason: '' })) }
    await Queue.methods.retryAfterReconcile.call(unsupported, 0)
    expect(unsupported.broadcastAt).toHaveBeenCalledWith(0, { auto: false })
  })
})
