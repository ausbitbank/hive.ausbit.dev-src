import { describe, expect, it } from 'vitest'
import {
  MODERATION_STORAGE_PREFIX,
  MODERATION_VERSION,
  clearModerationPolicy,
  defaultModerationPolicy,
  moderationStorageKey,
  normalizeModerationPolicy,
  readModerationPolicy,
  parseModerationExport,
  scopeFor,
  serializeModerationExport,
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
    expect(policy.safetyFloor).toEqual({ enabled: true })
    expect(policy.skins).toEqual({
      blockMuted: true,
      blockNegativeReputation: true,
      followedMuteListOverride: true,
      followedReputationOverride: false
    })
    expect(policy.overrides).toEqual({
      showAuthors: [],
      hideAuthors: [],
      showItems: [],
      hideItems: [],
      ignoredVoters: []
    })
    expect(policy.custom.feed.mute).toBe('collapse')
    expect(policy.lists.listsOverrideFollows).toBe(false)
    expect(policy.tags).toEqual({ ignored: [] })
  })

  it('normalizes unknown keys, enums and author lists', () => {
    const policy = normalizeModerationPolicy({
      version: '1',
      preset: 'strict',
      disclosureSeen: true,
      safetyFloor: { enabled: false },
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
      },
      tags: { ignored: ['#Hive', ' hive ', 'news', ''] }
    })
    expect(policy.preset).toBe('strict')
    expect(policy.disclosureSeen).toBe(true)
    expect(policy.safetyFloor).toEqual({ enabled: false })
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
    expect(policy.tags.ignored).toEqual(['hive', 'news'])
  })

  it('enables the safety floor for policies written before it existed', () => {
    const policy = normalizeModerationPolicy({ preset: 'balanced', skins: { blockMuted: true } })
    expect(policy.safetyFloor).toEqual({ enabled: true })
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

describe('moderation settings custom rules', () => {
  it('normalizes custom display values and drops unknown signals', () => {
    const policy = normalizeModerationPolicy({
      preset: 'custom',
      custom: {
        feed: { mute: 'hide', listMute: 'nope', reputation: 'label', junk: 'collapse' },
        unknown: { mute: 'hide' }
      },
      lists: { muteOwners: ['@Hive.Blog', 'hive.blog'], listsOverrideFollows: true },
      overrides: {
        showItems: ['alice/post', 'alice/post', ''],
        hideItems: ['bob/post'],
        ignoredVoters: ['@BadActor', 'badactor']
      }
    })
    expect(policy.preset).toBe('custom')
    expect(policy.custom.feed.mute).toBe('hide')
    expect(policy.custom.feed.listMute).toBe('collapse')
    expect(policy.custom.feed.reputation).toBe('label')
    expect(policy.custom.feed.junk).toBeUndefined()
    expect(policy.lists).toEqual({ muteOwners: ['hive.blog'], blacklistOwners: [], listsOverrideFollows: true })
    expect(policy.overrides.showItems).toEqual(['alice/post'])
    expect(policy.overrides.hideItems).toEqual(['bob/post'])
    expect(policy.overrides.ignoredVoters).toEqual(['badactor'])
  })

  it('caps item and voter overrides', () => {
    const items = Array.from({ length: 400 }, (_, index) => 'item-' + index)
    const voters = Array.from({ length: 700 }, (_, index) => 'voter' + index)
    const policy = normalizeModerationPolicy({
      overrides: { showItems: items, hideItems: items, ignoredVoters: voters }
    })
    expect(policy.overrides.showItems).toHaveLength(300)
    expect(policy.overrides.hideItems).toHaveLength(300)
    expect(policy.overrides.ignoredVoters).toHaveLength(500)
  })
})

describe('moderation settings export/import', () => {
  it('round-trips a versioned envelope', () => {
    const policy = defaultModerationPolicy()
    policy.preset = 'strict'
    policy.overrides.showAuthors = ['alice']
    policy.custom.feed.mute = 'label'
    policy.safetyFloor.enabled = false
    policy.tags.ignored = ['#news', 'hive']

    const text = serializeModerationExport(policy)
    const envelope = JSON.parse(text)
    expect(envelope.type).toBe('hive-moderation-policy')
    expect(envelope.version).toBe(MODERATION_VERSION)

    const parsed = parseModerationExport(text)
    expect(parsed.error).toBe('')
    expect(parsed.policy.preset).toBe('strict')
    expect(parsed.policy.overrides.showAuthors).toEqual(['alice'])
    expect(parsed.policy.custom.feed.mute).toBe('label')
    expect(parsed.policy.safetyFloor.enabled).toBe(false)
    expect(parsed.policy.tags.ignored).toEqual(['news', 'hive'])
  })

  it('accepts a bare policy object and rejects foreign or future files', () => {
    expect(parseModerationExport({ preset: 'open' }).policy.preset).toBe('open')
    expect(parseModerationExport('{bad json').error).toContain('valid JSON')
    expect(parseModerationExport({ type: 'hive-saved-searches', version: 1 }).error).toContain('not a')
    expect(parseModerationExport({ type: 'hive-moderation-policy', version: 99, policy: {} }).error).toContain('newer')
  })
})
