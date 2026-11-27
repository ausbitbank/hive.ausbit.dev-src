import { describe, expect, it } from 'vitest'
import {
  QUEUE_STATUS,
  canBroadcast,
  canRemove,
  commentBroadcastMode,
  createQueueMeta,
  expandQueueOperation,
  keyRequirement,
  nextActionableIndex,
  normalizeQueueAction,
  normalizeQueueMeta,
  operationLabel,
  operationSummary,
  postMetadataArgument,
  queueBadgeCount,
  queueCounts,
  reblogOperation,
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

  it('repairs queued posts whose comment options lack extensions', () => {
    const stale = ['alice', 'posting', ['comment', {
      parent_author: '',
      parent_permlink: 'hive',
      author: 'alice',
      permlink: 'hello',
      title: 'Hello',
      body: 'World',
      json_metadata: '{}',
      comment_options: {
        author: 'alice',
        permlink: 'hello',
        max_accepted_payout: '100000.000 HBD',
        percent_hbd: 10000,
        allow_votes: true,
        allow_curation_rewards: true
      }
    }]]
    const repaired = normalizeQueueAction(stale)
    expect(repaired).not.toBe(stale)
    expect(repaired[2][1].comment_options.extensions).toEqual([])
    expect(repaired[2][1].title).toBe('Hello')

    const withBeneficiaries = ['alice', 'posting', ['comment', {
      parent_author: '',
      parent_permlink: 'hive',
      author: 'alice',
      permlink: 'hello',
      title: 'Hello',
      body: 'World',
      json_metadata: '{}',
      comment_options: {
        author: 'alice',
        permlink: 'hello',
        extensions: [[0, { beneficiaries: [{ account: 'bob', weight: 500 }] }]]
      }
    }]]
    expect(normalizeQueueAction(withBeneficiaries)).toBe(withBeneficiaries)
  })

  it('expands a post into comment, options and a same-transaction reblog', () => {
    const options = {
      author: 'alice',
      permlink: 'hello',
      max_accepted_payout: '100000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: []
    }
    const action = ['comment', {
      parent_author: '',
      parent_permlink: 'hive-174578',
      author: 'alice',
      permlink: 'hello',
      title: 'Hello',
      body: 'World',
      json_metadata: '{}',
      comment_options: options,
      _reblog: true
    }]
    const operations = expandQueueOperation(action)
    expect(operations).toHaveLength(3)
    expect(operations[0][1]._reblog).toBeUndefined()
    expect(operations[0][1].comment_options).toBeUndefined()
    expect(operations[1]).toEqual(['comment_options', options])
    expect(operations[2]).toEqual(reblogOperation({ account: 'alice', author: 'alice', permlink: 'hello' }))
    expect(operationSummary(['alice', 'posting', action])).toBe('Publish Hello + reblog to blog')
    // The queued action is not mutated; other signers may still read its markers.
    expect(action[1]._reblog).toBe(true)
    expect(action[1].comment_options).toBe(options)
  })

  it('refuses a self-reblog when the queue owner is not the author', () => {
    const action = ['comment', {
      parent_author: '',
      parent_permlink: 'hive-174578',
      author: 'alice',
      permlink: 'hello',
      title: 'Hello',
      body: 'World',
      json_metadata: '{}',
      _reblog: true
    }]
    expect(() => expandQueueOperation(action, 'bob')).toThrow(/self-reblog/)
    expect(expandQueueOperation(action, 'alice')).toHaveLength(2)
  })

  it('builds a follow reblog and its undo payload', () => {
    const reblog = reblogOperation({ account: 'Alice', author: 'Bob', permlink: 'post' })
    expect(reblog[0]).toBe('custom_json')
    expect(reblog[1].required_posting_auths).toEqual(['alice'])
    expect(reblog[1].id).toBe('follow')
    expect(JSON.parse(reblog[1].json)).toEqual(['reblog', { account: 'alice', author: 'bob', permlink: 'post' }])

    const undo = reblogOperation({ account: 'alice', author: 'bob', permlink: 'post', remove: true })
    expect(JSON.parse(undo[1].json)[1].delete).toBe('delete')
    expect(() => reblogOperation({ account: 'alice' })).toThrow(/post/)
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

describe('comment broadcast mode', () => {
  const base = { author: 'alice', permlink: 'hello', title: 'Hello', body: 'Body', parent_author: '', parent_permlink: 'hive-1', json_metadata: '{}' }

  it('uses requestBroadcast for top-level comments without comment options', () => {
    expect(commentBroadcastMode(['comment', base])).toBe('raw')
  })

  it('uses requestPost for a normal top-level post with comment options', () => {
    expect(commentBroadcastMode(['comment', { ...base, comment_options: { extensions: [] } }])).toBe('post')
  })

  it('uses requestBroadcast for replies, edits and reblogs', () => {
    expect(commentBroadcastMode(['comment', { ...base, parent_author: 'bob' }])).toBe('raw')
    expect(commentBroadcastMode(['comment', { ...base, _edit: true, comment_options: { extensions: [] } }])).toBe('raw')
    expect(commentBroadcastMode(['comment', { ...base, _reblog: true, comment_options: { extensions: [] } }])).toBe('raw')
  })

  it('defaults non-comment operations to raw', () => {
    expect(commentBroadcastMode(['transfer', { from: 'alice' }])).toBe('raw')
  })
})
