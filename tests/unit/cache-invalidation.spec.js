import { beforeEach, describe, expect, it } from 'vitest'
import { apiCache, clearCache } from '../../src/services/cache'
import { invalidateOperationCaches } from '../../src/services/cacheInvalidation'
import { loadSnapshot, saveSnapshot } from '../../src/services/snapshots'

function seed () {
  apiCache.set('account:alice', { name: 'alice' })
  apiCache.set('account:bob', { name: 'bob' })
  apiCache.set('posts:bridge.get_ranked_posts:{}', [])
  apiCache.set('post:content:alice/post-1', { author: 'alice', permlink: 'post-1' })
  apiCache.set('witness:alice', { owner: 'alice' })
  apiCache.set('witnesses:200', [])
  apiCache.set('openOrders:alice', [])
  apiCache.set('community:hive-123', { name: 'hive-123' })
  apiCache.set('followCount:alice', { account: 'alice' })
  apiCache.set('following:alice', ['bob'])
  apiCache.set('ticker', { latest: 1 })
  apiCache.set('medianHistory', { base: 1 })
  apiCache.set('globalProps', { head_block_number: 1 })
  saveSnapshot('home:posts:ranked:trending', { posts: [] })
  saveSnapshot('home:witnesses', { witnesses: [] })
  saveSnapshot('health:summary', { props: {} })
}

describe('write cache invalidation', () => {
  beforeEach(() => {
    clearCache(apiCache)
    seed()
  })

  it('clears accounts and post lists after a vote', () => {
    invalidateOperationCaches(['alice', 'posting', ['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 100 }]])

    expect(apiCache.get('account:alice')).toBeNull()
    expect(apiCache.get('account:bob')).toBeNull()
    expect(apiCache.get('posts:bridge.get_ranked_posts:{}')).toBeNull()
    expect(apiCache.get('post:content:alice/post-1')).toBeNull()
    expect(apiCache.get('witnesses:200')).not.toBeNull()
    expect(loadSnapshot('home:posts:ranked:trending')).toBeNull()
  })

  it('clears balances, global properties, orders and ticker after a transfer', () => {
    invalidateOperationCaches([
      'alice',
      'active',
      ['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' }]
    ])

    expect(apiCache.get('account:alice')).toBeNull()
    expect(apiCache.get('account:bob')).toBeNull()
    expect(apiCache.get('globalProps')).toBeNull()
    expect(apiCache.get('ticker')).toBeNull()
    expect(apiCache.get('medianHistory')).toBeNull()
    expect(apiCache.get('openOrders:alice')).toBeNull()
    expect(loadSnapshot('health:summary')).toBeNull()
  })

  it('clears witness state after governance writes', () => {
    invalidateOperationCaches(['alice', 'active', ['account_witness_vote', { account: 'alice', witness: 'bob', approve: true }]])

    expect(apiCache.get('witnesses:200')).toBeNull()
    expect(apiCache.get('witness:alice')).toBeNull()
    expect(apiCache.get('globalProps')).toBeNull()
    expect(apiCache.get('account:alice')).toBeNull()
    expect(loadSnapshot('home:witnesses')).toBeNull()
    expect(loadSnapshot('health:summary')).toBeNull()
  })

  it('clears follow counts, posts and community metadata after custom JSON', () => {
    const result = invalidateOperationCaches([
      'alice',
      'posting',
      ['custom_json', {
        required_posting_auths: ['alice'],
        id: 'community',
        json: '["subscribe",{"community":"hive-123"}]'
      }]
    ])

    expect(result.communitiesRemoved).toBe(1)
    expect(apiCache.get('community:hive-123')).toBeNull()
    expect(apiCache.get('followCount:alice')).toBeNull()
    expect(apiCache.get('posts:bridge.get_ranked_posts:{}')).toBeNull()
  })

  it('clears the following list after a follow custom JSON', () => {
    invalidateOperationCaches([
      'alice',
      'posting',
      ['custom_json', {
        required_posting_auths: ['alice'],
        id: 'follow',
        json: '["follow",{"follower":"alice","following":"carol"}]'
      }]
    ])
    expect(apiCache.get('following:alice')).toBeNull()
  })

  it('keeps the following list for an unrelated custom JSON', () => {
    invalidateOperationCaches([
      'alice',
      'posting',
      ['custom_json', {
        required_posting_auths: ['alice'],
        id: 'notify',
        json: '["setLastRead",{"date":"2026-01-01T00:00:00"}]'
      }]
    ])
    expect(apiCache.get('following:alice')).not.toBeNull()
  })

  it('clears account metadata after an account update', () => {
    invalidateOperationCaches(['alice', 'posting', ['account_update2', { account: 'alice', json_metadata: '{}' }]])
    expect(apiCache.get('account:alice')).toBeNull()
    expect(apiCache.get('posts:bridge.get_ranked_posts:{}')).toBeNull()
  })
})
