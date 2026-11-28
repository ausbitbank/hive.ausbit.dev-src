import { beforeEach, describe, expect, it, vi } from 'vitest'

const { localStorageSet, sessionStorageSet } = vi.hoisted(() => ({
  localStorageSet: vi.fn(),
  sessionStorageSet: vi.fn()
}))

vi.mock('quasar', () => ({
  LocalStorage: {
    set: localStorageSet,
    getItem: vi.fn(() => null),
    remove: vi.fn()
  },
  SessionStorage: {
    set: sessionStorageSet,
    getItem: vi.fn(() => null),
    remove: vi.fn()
  }
}))

import {
  addToQueue,
  clearCompletedQueue,
  clearQueue,
  markNotificationsReadLocally,
  removeFromQueue,
  removeQueueItemAt,
  resetFailedQueueStatuses,
  setQueueStatus,
  updateAccountData,
  updateFollowCount,
  updateNotificationsLastRead,
  updateSettings
} from '../../src/stores/hive/mutations'

function makeState () {
  return {
    user: { settings: {} },
    queue: [],
    queueMeta: [],
    accounts: {},
    followCounts: {}
  }
}

describe('hive store mutations', () => {
  beforeEach(() => {
    localStorageSet.mockClear()
    sessionStorageSet.mockClear()
  })

  describe('updateSettings', () => {
    it('stores the settings on state and persists them to LocalStorage', () => {
      const state = makeState()
      const settings = { darkBackground: false, apiNode: 'https://api.hive.blog' }

      updateSettings.call(state, settings)

      expect(state.user.settings).toBe(settings)
      expect(localStorageSet).toHaveBeenCalledTimes(1)
      expect(localStorageSet).toHaveBeenCalledWith('settings:guest', settings)
    })
  })

  describe('queue mutations', () => {
    it('addToQueue appends an item without replacing the queue', () => {
      const state = makeState()
      const first = { type: 'vote' }
      const second = { type: 'transfer' }

      addToQueue.call(state, first)
      addToQueue.call(state, second)

      expect(state.queue).toEqual([first, second])
    })

    it('removeFromQueue removes only the matching item reference', () => {
      const state = makeState()
      const keep = { type: 'vote', id: 1 }
      const remove = { type: 'vote', id: 2 }
      const equalButDistinct = { type: 'vote', id: 2 }
      state.queue = [keep, remove]

      removeFromQueue.call(state, equalButDistinct)

      expect(state.queue).toEqual([keep, remove])

      removeFromQueue.call(state, remove)

      expect(state.queue).toEqual([keep])
      expect(state.queue).not.toContain(remove)
    })

    it('clearQueue replaces the queue with a new empty array', () => {
      const state = makeState()
      const original = [{ type: 'vote' }]
      state.queue = original

      clearQueue.call(state)

      expect(state.queue).toEqual([])
      expect(state.queue).not.toBe(original)
      expect(original).toHaveLength(1)
    })

    it('addToQueue records aligned pending status metadata', () => {
      const state = makeState()

      addToQueue.call(state, ['alice', 'posting', ['vote', {}]])

      expect(state.queue).toHaveLength(1)
      expect(state.queueMeta).toHaveLength(1)
      expect(state.queueMeta[0]).toMatchObject({ status: 'pending', error: '' })
    })

    it('fails closed when the declared key does not match the operation', () => {
      const state = makeState()

      addToQueue.call(state, ['alice', 'posting', ['transfer', {}]])

      expect(state.queue).toHaveLength(1)
      expect(state.queueMeta[0].status).toBe('failed')
      expect(state.queueMeta[0].error).toContain('needs the active key')
    })

    it('updates, retries and clears item statuses', () => {
      const state = makeState()
      addToQueue.call(state, ['alice', 'posting', ['vote', {}]])
      addToQueue.call(state, ['alice', 'active', ['transfer', {}]])
      setQueueStatus.call(state, 0, 'sent')
      setQueueStatus.call(state, 1, 'failed', 'Rejected')

      expect(state.queueMeta[0].status).toBe('sent')
      expect(state.queueMeta[1].status).toBe('failed')

      resetFailedQueueStatuses.call(state)
      expect(state.queueMeta[1].status).toBe('failed')
      expect(state.queueMeta[1].error).toBe('Rejected')

      clearCompletedQueue.call(state)
      expect(state.queue).toHaveLength(1)
      expect(state.queueMeta).toHaveLength(1)
      expect(state.queue[0][1]).toBe('active')
    })

    it('retries posting failures but leaves active failures for manual review', () => {
      const state = makeState()
      addToQueue.call(state, ['alice', 'posting', ['vote', {}]])
      addToQueue.call(state, ['alice', 'active', ['transfer', {}]])
      setQueueStatus.call(state, 0, 'failed', 'Rejected posting')
      setQueueStatus.call(state, 1, 'failed', 'Rejected active')

      resetFailedQueueStatuses.call(state)
      expect(state.queueMeta[0]).toMatchObject({ status: 'pending', error: '' })
      expect(state.queueMeta[1]).toMatchObject({ status: 'failed', error: 'Rejected active' })
    })

    it('removes an item and its status together', () => {
      const state = makeState()
      addToQueue.call(state, ['alice', 'posting', ['vote', {}]])
      addToQueue.call(state, ['alice', 'active', ['transfer', {}]])

      removeQueueItemAt.call(state, 0)

      expect(state.queue).toHaveLength(1)
      expect(state.queueMeta).toHaveLength(1)
      expect(state.queue[0][1]).toBe('active')
    })
  })

  describe('notification state', () => {
    it('marks notifications read locally and persists the timestamp', () => {
      const state = makeState()
      state.user.unreadNotificationCount = 4
      state.user.notificationsLastRead = null

      markNotificationsReadLocally.call(state)

      expect(state.user.unreadNotificationCount).toBe(0)
      expect(typeof state.user.notificationsLastRead).toBe('string')
      expect(sessionStorageSet).toHaveBeenCalledWith('unreadNotificationCount:guest', 0)
    })

    it('stores and clears the last-read timestamp', () => {
      const state = makeState()

      updateNotificationsLastRead.call(state, '2026-11-17 13:00:00')
      expect(state.user.notificationsLastRead).toBe('2026-11-17 13:00:00')

      updateNotificationsLastRead.call(state, null)
      expect(state.user.notificationsLastRead).toBeNull()
    })
  })

  describe('updateFollowCount', () => {
    it('stores counts keyed by account without the account field', () => {
      const state = makeState()
      const followCount = { account: 'alice', following: 12, followers: 7 }

      updateFollowCount.call(state, followCount)

      expect(state.followCounts).toEqual({
        alice: { following: 12, followers: 7 }
      })
      expect(state.followCounts.alice).not.toHaveProperty('account')
    })

    it('does not mutate the caller-supplied followCount object', () => {
      const state = makeState()
      const followCount = { account: 'alice', following: 12, followers: 7 }
      const snapshot = { ...followCount }

      updateFollowCount.call(state, followCount)

      expect(followCount).toEqual(snapshot)
      expect(followCount.account).toBe('alice')
    })

    it('ignores payloads without an account', () => {
      const state = makeState()

      updateFollowCount.call(state, undefined)
      updateFollowCount.call(state, null)
      updateFollowCount.call(state, { following: 1, followers: 2 })

      expect(state.followCounts).toEqual({})
    })
  })

  describe('updateAccountData', () => {
    it('indexes account data by its name', () => {
      const state = makeState()
      const alice = { name: 'alice', balance: '1.000 HIVE' }
      const bob = { name: 'bob', balance: '2.000 HIVE' }

      updateAccountData.call(state, alice)
      updateAccountData.call(state, bob)

      expect(state.accounts).toEqual({ alice, bob })
      expect(state.accounts.alice).toBe(alice)
      expect(state.accounts.bob).toBe(bob)
    })
  })
})
