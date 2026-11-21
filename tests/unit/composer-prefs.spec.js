import { describe, expect, it } from 'vitest'
import { clearRecentValues, readRecentValues, rememberRecentValue } from '../../src/services/composerPrefs'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.get(key) ?? null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

describe('composer recent values', () => {
  it('stores recent tags per account, newest first and deduplicated', () => {
    const storage = memoryStorage()
    rememberRecentValue(storage, 'tags', 'alice', '#Hive')
    rememberRecentValue(storage, 'tags', 'alice', 'writing')
    rememberRecentValue(storage, 'tags', 'alice', 'hive')
    expect(readRecentValues(storage, 'tags', 'alice')).toEqual(['hive', 'writing'])
    expect(readRecentValues(storage, 'tags', 'bob')).toEqual([])
  })

  it('caps the list and clears it', () => {
    const storage = memoryStorage()
    for (let index = 0; index < 15; index++) {
      rememberRecentValue(storage, 'communities', 'alice', 'tag' + index, 8)
    }
    expect(readRecentValues(storage, 'communities', 'alice', 8)).toHaveLength(8)
    clearRecentValues(storage, 'communities', 'alice')
    expect(readRecentValues(storage, 'communities', 'alice')).toEqual([])
  })
})
