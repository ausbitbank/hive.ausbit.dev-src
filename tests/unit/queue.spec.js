import { describe, expect, it } from 'vitest'
import {
  QUEUE_STATUS,
  canBroadcast,
  canRemove,
  createQueueMeta,
  keyRequirement,
  nextActionableIndex,
  normalizeQueueAction,
  normalizeQueueMeta,
  operationLabel,
  operationSummary,
  postMetadataArgument,
  queueBadgeCount,
  queueCounts,
  statusMeta
} from '../../src/services/queue'

const vote = ['alice', 'posting', ['vote', { voter: 'alice', author: 'bob', permlink: 'hello', weight: 10000 }]]
const transfer = ['alice', 'active', ['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' }]]
const marketOrder = ['alice', 'active', ['limit_order_create', { owner: 'alice', amount_to_sell: '2.000 HBD', min_to_receive: '50.000 HIVE' }]]

describe('queue helpers', () => {
  it('labels and summarises common operations', () => {
    expect(operationLabel(vote)).toBe('Vote')
    expect(operationSummary(vote)).toBe('Vote on @bob/hello')
    expect(operationSummary(transfer)).toBe('1.000 HIVE to @bob')
    expect(operationSummary(marketOrder)).toBe('2.000 HBD → min 50.000 HIVE')
    expect(operationSummary(['alice', 'posting', ['comment', { parent_author: 'bob', parent_permlink: 'post' }]]))
      .toBe('Reply to @bob/post')
    expect(operationSummary(['alice', 'posting', ['comment', { parent_author: 'bob', parent_permlink: 'post', _edit: true }]]))
      .toBe('Edit reply on @bob/post')
    expect(operationSummary(['alice', 'posting', ['comment', { title: 'Hello world', permlink: 'hello', _edit: true }]]))
      .toBe('Edit Hello world')
    expect(operationSummary(['alice', 'posting', ['delete_comment', { author: 'alice', permlink: 'hello' }]]))
      .toBe('Delete @alice/hello')
    expect(operationLabel(['alice', 'posting', ['delete_comment', { author: 'alice', permlink: 'hello' }]]))
      .toBe('Delete post')
    expect(operationSummary(['alice', 'posting', ['custom_json', { id: 'follow' }]]))
      .toBe('follow app action')

    const deposit = ['alice', 'active', ['transfer', { from: 'alice', to: 'v4vapp', amount: '2.500 HBD', memo: '#sats' }]]
    expect(operationSummary(deposit)).toBe('Deposit 2.500 HBD to keepsats')

    const convert = ['alice', 'active', ['custom_json', {
      id: 'v4vapp_transfer',
      json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', sats: '1234', memo: '#HBD' })
    }]]
    expect(operationSummary(convert)).toBe('Convert keepsats to HBD')

    const notice = ['alice', 'active', ['custom_json', {
      id: 'v4vapp_notification',
      json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', parent_id: 'XYZ', notification: true })
    }]]
    expect(operationSummary(notice)).toBe('v4vapp notification · XYZ')
  })

  it('repairs posting-authority account updates that would need active', () => {
    const stale = ['alice', 'posting', ['account_update2', {
      account: 'alice',
      json_metadata: '{"legacy":true}',
      posting_json_metadata: '{"profile":{}}',
      extensions: []
    }]]
    const repaired = normalizeQueueAction(stale)
    expect(repaired).not.toBe(stale)
    expect(repaired[2][1].json_metadata).toBe('')
    expect(repaired[2][1].posting_json_metadata).toBe('{"profile":{}}')

    const alreadyClean = ['alice', 'posting', ['account_update2', {
      account: 'alice',
      json_metadata: '',
      posting_json_metadata: '{"profile":{}}',
      extensions: []
    }]]
    expect(normalizeQueueAction(alreadyClean)).toBe(alreadyClean)

    const activeUpdate = ['alice', 'active', ['account_update2', {
      account: 'alice',
      json_metadata: '{"legacy":true}',
      posting_json_metadata: '{"profile":{}}'
    }]]
    expect(normalizeQueueAction(activeUpdate)).toBe(activeUpdate)
  })

  it('explains posting and active key requirements', () => {
    expect(keyRequirement(vote)).toMatchObject({ label: 'Posting key', color: 'green' })
    expect(keyRequirement(transfer)).toMatchObject({ label: 'Active key', color: 'orange' })
    expect(keyRequirement(['alice', 'posting', ['unknown_op', {}]]).label).toBe('Posting key')
    expect(keyRequirement(['alice', 'owner', ['vote', {}]]).label).toBe('owner key')
  })

  it('passes post metadata to Keychain without double encoding it', () => {
    expect(postMetadataArgument('{"tags":["hive"]}')).toBe('{"tags":["hive"]}')
    expect(postMetadataArgument({ tags: ['hive'] })).toBe('{"tags":["hive"]}')
    expect(postMetadataArgument(null)).toBe('')
  })

  it('normalises status metadata and aligns legacy queues', () => {
    const now = 1000
    const meta = createQueueMeta(now)
    expect(meta).toMatchObject({ status: 'pending', error: '', txId: '', addedAt: now })

    const aligned = normalizeQueueMeta([vote, transfer], [null])
    expect(aligned).toHaveLength(2)
    expect(aligned[0].status).toBe('pending')
    expect(aligned[1].status).toBe('pending')

    const invalid = normalizeQueueMeta([vote], [{ status: 'nope', error: 42 }], now)
    expect(invalid[0].status).toBe('pending')
    expect(invalid[0].error).toBe('')
  })

  it('preserves manual-only Lightning actions and skips them for auto-send', () => {
    const manual = createQueueMeta(1000, { manualOnly: true })
    expect(manual.manualOnly).toBe(true)
    const normalized = normalizeQueueMeta([transfer], [{ ...manual, status: QUEUE_STATUS.PENDING }], 2000)
    expect(normalized[0].manualOnly).toBe(true)

    const meta = [
      { status: QUEUE_STATUS.PENDING, manualOnly: true },
      { status: QUEUE_STATUS.PENDING, manualOnly: false }
    ]
    expect(nextActionableIndex(meta)).toBe(0)
    expect(nextActionableIndex(meta, { auto: true })).toBe(1)
    expect(nextActionableIndex([{ status: QUEUE_STATUS.PENDING, manualOnly: true }], { auto: true })).toBe(-1)
  })

  it('counts queue states and chooses the next actionable item', () => {
    const meta = [
      { status: QUEUE_STATUS.SENT },
      { status: QUEUE_STATUS.FAILED },
      { status: QUEUE_STATUS.PENDING },
      { status: QUEUE_STATUS.BROADCASTING }
    ]
    expect(queueCounts(meta)).toMatchObject({
      pending: 1,
      broadcasting: 1,
      sent: 1,
      failed: 1,
      active: 3,
      total: 4
    })
    expect(queueBadgeCount(meta)).toBe(3)
    expect(nextActionableIndex(meta)).toBe(2)
    expect(nextActionableIndex(meta, { includeFailed: true })).toBe(1)
    expect(nextActionableIndex([])).toBe(-1)
  })

  it('exposes status labels and action permissions', () => {
    expect(statusMeta(QUEUE_STATUS.FAILED)).toMatchObject({ label: 'Failed', color: 'red' })
    expect(statusMeta('unknown')).toMatchObject({ label: 'Queued' })
    expect(canBroadcast(QUEUE_STATUS.PENDING)).toBe(true)
    expect(canBroadcast(QUEUE_STATUS.FAILED)).toBe(true)
    expect(canBroadcast(QUEUE_STATUS.SENT)).toBe(false)
    expect(canRemove(QUEUE_STATUS.BROADCASTING)).toBe(false)
    expect(canRemove(QUEUE_STATUS.SENT)).toBe(true)
  })
})
