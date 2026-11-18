import { describe, expect, it } from 'vitest'
import {
  SAVED_SEARCH_LIMIT,
  addSavedSearch,
  defaultSavedSearches,
  importSavedSearches,
  normalizeSearchPath,
  readSavedSearches,
  removeSavedSearch,
  savedSearchRecord,
  serializeSavedSearches,
  writeSavedSearches
} from '../../src/services/savedSearches'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    getItem (key) { return map.has(key) ? map.get(key) : null },
    setItem (key, value) { map.set(key, value) },
    removeItem (key) { map.delete(key) }
  }
}

describe('saved search records', () => {
  it('only accepts internal /search URLs', () => {
    expect(normalizeSearchPath('/search?q=hive')).toBe('/search?q=hive')
    expect(normalizeSearchPath('https://hive.ausbit.dev/search?q=hive')).toBe('/search?q=hive')
    expect(normalizeSearchPath('https://evil.example/search?q=hive')).toBe('')
    expect(normalizeSearchPath('/@ausbitbank')).toBe('')
    expect(normalizeSearchPath('javascript:alert(1)')).toBe('')
  })

  it('drops records without a label or a valid URL', () => {
    expect(savedSearchRecord({ label: '', url: '/search?q=a' })).toBeNull()
    expect(savedSearchRecord({ label: 'A', url: '/nope' })).toBeNull()
    expect(savedSearchRecord({ label: 'A', url: '/search?q=a', savedAt: 5000 })).toMatchObject({ label: 'A', url: '/search?q=a', savedAt: 5000 })
  })

  it('de-duplicates by URL, keeps newest first and caps the list', () => {
    const older = savedSearchRecord({ label: 'Old', url: '/search?q=a', savedAt: 1000 })
    const newer = savedSearchRecord({ label: 'New', url: '/search?q=a', savedAt: 2000 })
    const list = defaultSavedSearches([older, newer])
    expect(list).toHaveLength(1)
    expect(list[0].label).toBe('New')

    const many = Array.from({ length: SAVED_SEARCH_LIMIT + 5 }, (_, index) =>
      ({ label: 'S' + index, url: '/search?q=' + index, savedAt: index }))
    expect(defaultSavedSearches(many)).toHaveLength(SAVED_SEARCH_LIMIT)
  })

  it('adds and removes searches', () => {
    const base = savedSearchRecord({ label: 'Hive', url: '/search?q=hive', savedAt: 1000 })
    const next = addSavedSearch([base], { label: 'Art', url: '/search?q=art', savedAt: 2000 }, 3000)
    expect(next.map(item => item.label)).toEqual(['Art', 'Hive'])
    expect(removeSavedSearch(next, '/search?q=art').map(item => item.label)).toEqual(['Hive'])
  })
})

describe('saved search storage', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const list = [savedSearchRecord({ label: 'Hive', url: '/search?q=hive', savedAt: 1000 })]
    expect(writeSavedSearches(storage, list)).toBe(true)
    expect(readSavedSearches(storage).map(item => item.label)).toEqual(['Hive'])
  })

  it('tolerates missing or corrupt storage', () => {
    expect(readSavedSearches(memoryStorage())).toEqual([])
    const storage = memoryStorage()
    storage.setItem('savedSearches', '{oops')
    expect(readSavedSearches(storage)).toEqual([])
    expect(writeSavedSearches(null, [])).toBe(false)
  })
})

describe('saved search export and import', () => {
  it('exports a versioned envelope', () => {
    const text = serializeSavedSearches([savedSearchRecord({ label: 'Hive', url: '/search?q=hive' })])
    const parsed = JSON.parse(text)
    expect(parsed.type).toBe('hive-saved-searches')
    expect(parsed.searches).toHaveLength(1)
  })

  it('imports envelopes, arrays and single records', () => {
    expect(importSavedSearches('').error).toMatch(/empty/)
    expect(importSavedSearches('nope').error).toMatch(/valid JSON/)
    expect(importSavedSearches(JSON.stringify([{ label: 'A', url: '/search?q=a' }])).searches).toHaveLength(1)
    expect(importSavedSearches(JSON.stringify({ label: 'B', url: '/search?q=b' })).searches).toHaveLength(1)
    expect(importSavedSearches(JSON.stringify({ searches: [{ label: '', url: '/search' }] })).error).toMatch(/No valid/)
  })
})
