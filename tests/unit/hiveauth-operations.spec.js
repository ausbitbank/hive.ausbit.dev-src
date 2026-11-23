import { describe, expect, it } from 'vitest'
import { normalizeBroadcastOperation } from '../../src/services/hiveauth/operations'

describe('HiveAuth operation normalization', () => {
  it('leaves a simple operation alone', () => {
    const vote = ['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]
    expect(normalizeBroadcastOperation(vote)).toEqual([vote])
  })

  it('removes the queue-only edit marker', () => {
    const edit = ['comment', { author: 'alice', permlink: 'x', title: '', body: 'new', _edit: true }]
    const [operation] = normalizeBroadcastOperation(edit)
    expect(operation[1]._edit).toBeUndefined()
    expect(edit[1]._edit).toBe(true)
  })

  it('splits comment options into a second operation', () => {
    const comment = ['comment', {
      author: 'alice',
      permlink: 'x',
      title: 'Title',
      body: 'Body',
      comment_options: {
        author: 'alice',
        permlink: 'x',
        max_accepted_payout: '100000.000 HBD',
        percent_hbd: 10000,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: []
      }
    }]
    const operations = normalizeBroadcastOperation(comment)
    expect(operations).toHaveLength(2)
    expect(operations[0][1].comment_options).toBeUndefined()
    expect(operations[1][0]).toBe('comment_options')
    expect(operations[1][1].max_accepted_payout).toBe('100000.000 HBD')
    expect(comment[1].comment_options).toBeTruthy()
  })

  it('appends a same-transaction reblog after the post and options', () => {
    const comment = ['comment', {
      author: 'alice',
      permlink: 'x',
      title: 'Title',
      body: 'Body',
      comment_options: {
        author: 'alice',
        permlink: 'x',
        extensions: []
      },
      _reblog: true
    }]
    const operations = normalizeBroadcastOperation(comment)
    expect(operations.map(operation => operation[0])).toEqual(['comment', 'comment_options', 'custom_json'])
    expect(operations[0][1]._reblog).toBeUndefined()
    expect(JSON.parse(operations[2][1].json)).toEqual(['reblog', { account: 'alice', author: 'alice', permlink: 'x' }])
  })

  it('rejects an invalid operation', () => {
    expect(() => normalizeBroadcastOperation(['vote'])).toThrow(/Invalid operation/)
  })
})
