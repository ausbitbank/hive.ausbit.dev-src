import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  localStore,
  sessionStore,
  localGetItem,
  localSet,
  localRemove,
  sessionGetItem,
  sessionSet,
  sessionRemove
} = vi.hoisted(() => {
  const localStore = new Map()
  const sessionStore = new Map()
  return {
    localStore,
    sessionStore,
    localGetItem: vi.fn(key => (localStore.has(key) ? localStore.get(key) : null)),
    localSet: vi.fn((key, value) => { localStore.set(key, value) }),
    localRemove: vi.fn(key => { localStore.delete(key) }),
    sessionGetItem: vi.fn(key => (sessionStore.has(key) ? sessionStore.get(key) : null)),
    sessionSet: vi.fn((key, value) => { sessionStore.set(key, value) }),
    sessionRemove: vi.fn(key => { sessionStore.delete(key) })
  }
})

vi.mock('quasar', () => ({
  LocalStorage: {
    getItem: localGetItem,
    set: localSet,
    remove: localRemove
  },
  SessionStorage: {
    getItem: sessionGetItem,
    set: sessionSet,
    remove: sessionRemove
  }
}))

import {
  persistQueue,
  restoreQueue,
  restoreQueueState,
  QUEUE_STORAGE_KEY,
  QUEUE_TTL_MS
} from '../../src/stores/hive/state'

const NOW = new Date('2026-11-17T12:00:00.000Z')

function validItem (username = 'alice') {
  return [username, 'posting', ['vote', { voter: username, author: 'bob', permlink: 'post', weight: 100 }]]
}

describe('queue persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStore.clear()
    sessionStore.clear()
    localGetItem.mockClear()
    localSet.mockClear()
    localRemove.mockClear()
    sessionGetItem.mockClear()
    sessionSet.mockClear()
    sessionRemove.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('persistQueue', () => {
    it('writes savedAt, owner and items', () => {
      const items = [
        validItem('alice'),
        ['alice', 'active', ['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE' }]]
      ]

      persistQueue(items)

      expect(localSet).toHaveBeenCalledTimes(1)
      expect(localStore.get(QUEUE_STORAGE_KEY)).toEqual({
        savedAt: NOW.getTime(),
        owner: 'alice',
        items
      })
    })

    it('removes the key for empty or non-array queues', () => {
      localStore.set(QUEUE_STORAGE_KEY, { stale: true })
      persistQueue([])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)

      localStore.set(QUEUE_STORAGE_KEY, { stale: true })
      persistQueue(null)
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)

      localStore.set(QUEUE_STORAGE_KEY, { stale: true })
      persistQueue('not-an-array')
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)

      expect(localRemove).toHaveBeenCalledTimes(3)
    })

    it('does not throw when storage writes fail', () => {
      localSet.mockImplementationOnce(() => { throw new Error('quota exceeded') })

      expect(() => persistQueue([validItem()])).not.toThrow()
    })

    it('persists aligned per-item status metadata when provided', () => {
      const items = [validItem('alice'), validItem('bob')]
      const meta = [
        { status: 'sent', error: '', txId: 'abc', addedAt: 1, updatedAt: 2 },
        { status: 'failed', error: 'Nope', txId: '', addedAt: 3, updatedAt: 4 }
      ]

      persistQueue(items, meta)

      expect(localStore.get(QUEUE_STORAGE_KEY)).toEqual({
        savedAt: NOW.getTime(),
        owner: 'alice',
        items,
        meta
      })
    })
  })

  describe('restoreQueueState', () => {
    it('reconstructs pending metadata for legacy queues without it', () => {
      const items = [validItem('alice')]
      persistQueue(items)

      const restored = restoreQueueState('alice')
      expect(restored.queue).toEqual(items)
      expect(restored.meta).toHaveLength(1)
      expect(restored.meta[0]).toMatchObject({ status: 'pending', error: '', txId: '' })
    })

    it('restores persisted status metadata', () => {
      const items = [validItem('alice')]
      persistQueue(items, [{ status: 'failed', error: 'Rejected', txId: '', addedAt: 1, updatedAt: 2 }])

      const restored = restoreQueueState('alice')
      expect(restored.meta[0]).toMatchObject({ status: 'failed', error: 'Rejected' })
    })

    it('synthesises metadata when the stored entry is invalid', () => {
      localStore.set(QUEUE_STORAGE_KEY, {
        savedAt: NOW.getTime(),
        owner: 'alice',
        items: [validItem('alice')],
        meta: [{ status: 'not-a-status' }]
      })

      const restored = restoreQueueState('alice')
      expect(restored.meta[0].status).toBe('pending')
    })

    it('repairs a posting account_update2 that would need active authority', () => {
      localStore.set(QUEUE_STORAGE_KEY, {
        savedAt: NOW.getTime(),
        owner: 'alice',
        items: [['alice', 'posting', ['account_update2', {
          account: 'alice',
          json_metadata: '{"legacy":true}',
          posting_json_metadata: '{"profile":{}}'
        }]]],
        meta: []
      })

      const restored = restoreQueueState('alice')
      expect(restored.queue[0][2][1].json_metadata).toBe('')
      expect(restored.queue[0][2][1].posting_json_metadata).toBe('{"profile":{}}')
    })

    it('turns an interrupted broadcast into a retryable failure', () => {
      persistQueue([validItem('alice')], [{ status: 'broadcasting', error: '', txId: '', addedAt: 1, updatedAt: 2 }])

      const restored = restoreQueueState('alice')
      expect(restored.meta[0].status).toBe('failed')
      expect(restored.meta[0].error).toContain('interrupted')
    })
  })

  describe('restoreQueue', () => {
    it('returns valid items saved within the TTL', () => {
      const items = [validItem('alice')]

      persistQueue(items)

      expect(restoreQueue('alice')).toEqual(items)
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(true)
    })

    it('keeps entries at exactly the TTL but drops entries beyond it', () => {
      persistQueue([validItem('alice')])

      vi.setSystemTime(new Date(NOW.getTime() + QUEUE_TTL_MS))
      expect(restoreQueue('alice')).toHaveLength(1)

      vi.setSystemTime(new Date(NOW.getTime() + QUEUE_TTL_MS + 1))
      expect(restoreQueue('alice')).toEqual([])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('removes expired entries', () => {
      persistQueue([validItem('alice')])
      vi.setSystemTime(new Date(NOW.getTime() + QUEUE_TTL_MS + 1))

      expect(restoreQueue('alice')).toEqual([])
      expect(localRemove).toHaveBeenCalledWith(QUEUE_STORAGE_KEY)
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('rejects a queue saved by a different owner', () => {
      persistQueue([validItem('alice')])

      expect(restoreQueue('bob')).toEqual([])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('drops corrupt items and removes the stored queue', () => {
      const valid = validItem('alice')
      const malformed = [
        valid,
        'not-an-item',
        ['alice', 'posting', []],
        ['alice', 'owner', ['vote']],
        ['alice', 'posting', 'not-an-array']
      ]
      persistQueue(malformed)

      expect(restoreQueue('alice')).toEqual([valid])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('returns an empty array when every item is malformed', () => {
      persistQueue([
        ['alice', 'posting', []],
        ['alice', 'active', 'not-an-array'],
        'not-an-item'
      ])

      expect(restoreQueue('alice')).toEqual([])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('returns an empty array for a malformed stored payload', () => {
      localStore.set(QUEUE_STORAGE_KEY, { savedAt: 'not-a-number', items: [] })

      expect(restoreQueue('alice')).toEqual([])
      expect(localStore.has(QUEUE_STORAGE_KEY)).toBe(false)
    })

    it('handles missing storage', () => {
      expect(restoreQueue('alice')).toEqual([])
      expect(localRemove).not.toHaveBeenCalled()
    })

    it('handles storage that throws', () => {
      localGetItem.mockImplementationOnce(() => { throw new Error('storage blocked') })

      expect(restoreQueue('alice')).toEqual([])
      expect(localRemove).toHaveBeenCalledWith(QUEUE_STORAGE_KEY)
    })
  })
})
