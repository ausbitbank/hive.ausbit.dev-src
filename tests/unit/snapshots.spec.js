import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNAPSHOT_TTL_MS,
  SNAPSHOT_PREFIX,
  loadSnapshot,
  pruneSnapshots,
  removeSnapshot,
  saveSnapshot
} from '../../src/services/snapshots'

function memoryStorage (initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get length () { return values.size },
    key (index) { return [...values.keys()][index] ?? null },
    getItem (key) { return values.has(key) ? values.get(key) : null },
    setItem (key, value) { values.set(key, String(value)) },
    removeItem (key) { values.delete(key) },
    dump () { return Object.fromEntries(values) }
  }
}

describe('offline read snapshots', () => {
  it('saves and loads a snapshot with its age', () => {
    const storage = memoryStorage()
    expect(saveSnapshot('home:block', { number: 1 }, { storage, now: 1000 })).toBe(true)

    const snapshot = loadSnapshot('home:block', { storage, now: 4000 })
    expect(snapshot).toMatchObject({ data: { number: 1 }, savedAt: 1000, ageMs: 3000 })
  })

  it('expires and removes stale snapshots', () => {
    const storage = memoryStorage()
    saveSnapshot('home:block', { number: 1 }, { storage, now: 1000, ttlMs: 500 })

    expect(loadSnapshot('home:block', { storage, now: 2000 })).toBeNull()
    expect(storage.dump()).toEqual({})
  })

  it('ignores corrupt entries and respects the size cap', () => {
    const storage = memoryStorage()
    storage.setItem(SNAPSHOT_PREFIX + 'broken', '{not-json')
    expect(loadSnapshot('broken', { storage })).toBeNull()

    expect(saveSnapshot('huge', { text: 'x'.repeat(1000) }, { storage, maxBytes: 100 })).toBe(false)
    expect(loadSnapshot('huge', { storage })).toBeNull()
  })

  it('removes individual snapshots and prunes expired keys only', () => {
    const storage = memoryStorage()
    saveSnapshot('old', { ok: true }, { storage, now: 1000, ttlMs: 100 })
    saveSnapshot('fresh', { ok: true }, { storage, now: 5000 })

    expect(pruneSnapshots({ storage, now: 6000, ttlMs: DEFAULT_SNAPSHOT_TTL_MS })).toBe(1)
    expect(loadSnapshot('old', { storage, now: 6000 })).toBeNull()
    expect(loadSnapshot('fresh', { storage, now: 6000 })).not.toBeNull()

    expect(removeSnapshot('fresh', { storage })).toBe(true)
    expect(loadSnapshot('fresh', { storage })).toBeNull()
  })
})
