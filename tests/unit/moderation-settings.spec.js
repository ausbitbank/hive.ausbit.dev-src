import { describe, expect, it } from 'vitest'
import {
  MODERATION_STORAGE_PREFIX,
  MODERATION_VERSION,
  clearModerationPolicy,
  defaultModerationPolicy,
  moderationStorageKey,
  normalizeModerationPolicy,
  readModerationPolicy,
  scopeFor,
  writeModerationPolicy
} from '../../src/services/moderationSettings'

function memoryStorage (initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: key => { values.delete(key) },
    dump: () => Object.fromEntries(values)
  }
}

describe('moderation settings schema', () => {
  it('starts from Balanced with skin safety on', () => {
    const policy = defaultModerationPolicy()
    expect(policy.version).toBe(MODERATION_VERSION)
    expect(policy.preset).toBe('balanced')
    expect(policy.skins).toEqual({
      blockMuted: true,
      blockNegativeReputation: true,
      followedMuteListOverride: true,
      followedReputationOverride: false
    })
    expect(policy.overrides).toEqual({ showAuthors: [], hideAuthors: [] })
  })

  it('normalizes unknown keys, enums and author lists', () => {
    const policy = normalizeModerationPolicy({
      version: '1',
      preset: 'strict',
      disclosureSeen: true,
      extra: 'drop me',
      skins: {
        blockMuted: false,
        blockNegativeReputation: 'yes',
        followedMuteListOverride: false,
        followedReputationOverride: true
      },
      overrides: {
        showAuthors: ['@Alice', 'alice', '', 'b'.repeat(40)],
        hideAuthors: ['Carol'],
        unknown: ['nope']
      }
    })
    expect(policy.preset).toBe('strict')
    expect(policy.disclosureSeen).toBe(true)
    expect(policy.extra).toBeUndefined()
    expect(policy.skins).toEqual({
      blockMuted: false,
      blockNegativeReputation: true,
      followedMuteListOverride: false,
      followedReputationOverride: true
    })
    expect(policy.overrides.showAuthors).toEqual(['alice', 'b'.repeat(16)])
    expect(policy.overrides.hideAuthors).toEqual(['carol'])
    expect(policy.overrides.unknown).toBeUndefined()
  })

  it('migrates the pre-release single followed-skin flag', () => {
    const policy = normalizeModerationPolicy({ skins: { followedOverride: false } })
    expect(policy.skins.followedMuteListOverride).toBe(false)
    expect(policy.skins.followedReputationOverride).toBe(false)
  })

  it('rejects a future schema version instead of guessing', () => {
    const policy = normalizeModerationPolicy({
      version: MODERATION_VERSION + 1,
      preset: 'open',
      skins: { blockMuted: false }
    })
    expect(policy.preset).toBe('balanced')
    expect(policy.skins.blockMuted).toBe(true)
  })

  it('tolerates non-object input', () => {
    for (const value of [null, undefined, [], 'x', 3]) {
      expect(normalizeModerationPolicy(value)).toEqual(defaultModerationPolicy())
    }
  })

  it('dedupes and caps author overrides', () => {
    const authors = Array.from({ length: 260 }, (_, index) => 'user' + index)
    const policy = normalizeModerationPolicy({ overrides: { showAuthors: authors } })
    expect(policy.overrides.showAuthors).toHaveLength(200)
    expect(new Set(policy.overrides.showAuthors).size).toBe(200)
  })
})

describe('moderation settings storage', () => {
  it('scopes the key to the account with a guest fallback', () => {
    expect(scopeFor('@Alice')).toBe('alice')
    expect(scopeFor('')).toBe('guest')
    expect(moderationStorageKey('@Alice')).toBe(MODERATION_STORAGE_PREFIX + 'alice')
  })

  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const policy = defaultModerationPolicy()
    policy.skins.blockMuted = false
    policy.overrides.showAuthors = ['alice']

    expect(writeModerationPolicy('alice', policy, { storage })).toBe(true)
    const restored = readModerationPolicy('alice', { storage })
    expect(restored.skins.blockMuted).toBe(false)
    expect(restored.overrides.showAuthors).toEqual(['alice'])
  })

  it('returns defaults for corrupt or missing data', () => {
    const corrupt = memoryStorage({ [moderationStorageKey('alice')]: '{not json' })
    expect(readModerationPolicy('alice', { storage: corrupt })).toEqual(defaultModerationPolicy())
    expect(readModerationPolicy('bob', { storage: memoryStorage() })).toEqual(defaultModerationPolicy())
  })

  it('clears one account without touching another', () => {
    const storage = memoryStorage()
    writeModerationPolicy('alice', defaultModerationPolicy(), { storage })
    writeModerationPolicy('bob', defaultModerationPolicy(), { storage })

    expect(clearModerationPolicy('alice', { storage })).toBe(true)
    expect(storage.getItem(moderationStorageKey('alice'))).toBeNull()
    expect(storage.getItem(moderationStorageKey('bob'))).not.toBeNull()
  })
})
