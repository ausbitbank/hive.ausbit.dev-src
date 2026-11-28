import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => {
  const local = new Map()
  const session = new Map()
  return {
    local,
    session,
    LocalStorage: {
      getItem: (key) => local.has(key) ? local.get(key) : null,
      set: (key, value) => local.set(key, value),
      remove: (key) => local.delete(key)
    },
    SessionStorage: {
      getItem: (key) => session.has(key) ? session.get(key) : null,
      set: (key, value) => session.set(key, value),
      remove: (key) => session.delete(key)
    }
  }
})

vi.mock('quasar', () => ({
  LocalStorage: storage.LocalStorage,
  SessionStorage: storage.SessionStorage
}))

const { readSettingsFor, settingsStorageKey, DEFAULT_SETTINGS } = await import('../../src/stores/hive/state')
const { updateCommunitySubscriptions, updateLoggedInUser, updateNotifications, updateSettings, updateUnreadNotificationCount } = await import('../../src/stores/hive/mutations')

function context (username = '') {
  return {
    user: { username, settings: readSettingsFor(username) },
    queue: [],
    queueMeta: [],
    accounts: {},
    followCounts: {}
  }
}

beforeEach(() => {
  storage.local.clear()
  storage.session.clear()
})

describe('account-scoped settings', () => {
  it('migrates the legacy key once and gives the next account defaults', () => {
    storage.local.set('settings', { ...DEFAULT_SETTINGS, beneficiary: [{ account: 'alice', weight: 10000 }] })
    const alice = readSettingsFor('alice')
    expect(alice.beneficiary).toEqual([{ account: 'alice', weight: 10000 }])
    expect(storage.local.has('settings')).toBe(false)
    expect(storage.local.get(settingsStorageKey('alice'))).toEqual(alice)

    const bob = readSettingsFor('bob')
    expect(bob).toEqual(DEFAULT_SETTINGS)
    expect(storage.local.get(settingsStorageKey('alice'))).toEqual(alice)
  })

  it('writes settings under the signed-in account', () => {
    const ctx = context('alice')
    const settings = { ...DEFAULT_SETTINGS, voteWeightPost: 42 }
    updateSettings.call(ctx, settings)
    expect(storage.local.get(settingsStorageKey('alice'))).toEqual(settings)
    expect(storage.local.has('settings')).toBe(false)
  })

  it('scopes notification and community session state per account', () => {
    const ctx = context('alice')
    updateNotifications.call(ctx, [{ id: 1 }])
    updateUnreadNotificationCount.call(ctx, 3)
    updateCommunitySubscriptions.call(ctx, [['hive-1', ['subscribe']]])
    expect(storage.session.get('notifications:alice')).toEqual([{ id: 1 }])
    expect(storage.session.get('unreadNotificationCount:alice')).toBe(3)
    expect(storage.session.get('communitySubscriptions:alice')).toEqual([['hive-1', ['subscribe']]])
  })

  it('reloads settings when the signed-in account changes', () => {
    storage.local.set(settingsStorageKey('alice'), { ...DEFAULT_SETTINGS, voteWeightPost: 11 })
    storage.local.set(settingsStorageKey('bob'), { ...DEFAULT_SETTINGS, voteWeightPost: 22 })
    const ctx = context('alice')
    expect(ctx.user.settings.voteWeightPost).toBe(11)

    updateLoggedInUser.call(ctx, 'bob')
    expect(ctx.user.settings.voteWeightPost).toBe(22)
  })
})
