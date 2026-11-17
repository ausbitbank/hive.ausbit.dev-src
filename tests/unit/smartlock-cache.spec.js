import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeLegacyUnlockedKeyCache } from '../../src/components/smartlock/store'

const LEGACY_DIRECT_KEY = 'ausbitdev_peaklock_cache_v2_alice'
const LEGACY_LSCACHE_KEY = 'lscache-ausbitdev_peaklock_cache_v2_bob'
const LOCKER_KEY = 'ausbitdev_peaklock_v2'
const UNRELATED_KEY = 'some-unrelated-key'

function createStorage (entries = {}) {
  const map = new Map(Object.entries(entries))
  return {
    get length () {
      return map.size
    },
    key: vi.fn(index => Array.from(map.keys())[index] ?? null),
    getItem: vi.fn(key => (map.has(key) ? map.get(key) : null)),
    setItem: vi.fn((key, value) => { map.set(key, String(value)) }),
    removeItem: vi.fn(key => { map.delete(key) }),
    clear: vi.fn(() => { map.clear() }),
    entries: map
  }
}

describe('purgeLegacyUnlockedKeyCache', () => {
  let storage

  beforeEach(() => {
    storage = createStorage({
      [LEGACY_DIRECT_KEY]: 'plaintext-direct',
      [LEGACY_LSCACHE_KEY]: 'plaintext-lscache',
      [LOCKER_KEY]: '{"alice":{"posting":"encrypted"}}',
      [UNRELATED_KEY]: 'keep-me'
    })
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('removes only the two legacy cache entries and returns the count', () => {
    expect(purgeLegacyUnlockedKeyCache()).toBe(2)

    expect(storage.entries.has(LEGACY_DIRECT_KEY)).toBe(false)
    expect(storage.entries.has(LEGACY_LSCACHE_KEY)).toBe(false)
    expect(storage.entries.get(LOCKER_KEY)).toBe('{"alice":{"posting":"encrypted"}}')
    expect(storage.entries.get(UNRELATED_KEY)).toBe('keep-me')
  })

  it('returns 0 on a second call', () => {
    expect(purgeLegacyUnlockedKeyCache()).toBe(2)
    expect(purgeLegacyUnlockedKeyCache()).toBe(0)
  })

  it('returns 0 when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(purgeLegacyUnlockedKeyCache()).toBe(0)
  })

  it('returns 0 when localStorage access throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('localStorage', {
      get length () {
        throw new Error('storage denied')
      },
      key: vi.fn(),
      removeItem: vi.fn()
    })

    expect(purgeLegacyUnlockedKeyCache()).toBe(0)
    expect(warn).toHaveBeenCalled()
  })
})
