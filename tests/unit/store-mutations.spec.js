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
  clearQueue,
  removeFromQueue,
  updateAccountData,
  updateFollowCount,
  updateSettings
} from '../../src/stores/hive/mutations'

function makeState () {
  return {
    user: { settings: {} },
    queue: [],
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
      expect(localStorageSet).toHaveBeenCalledWith('settings', settings)
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
