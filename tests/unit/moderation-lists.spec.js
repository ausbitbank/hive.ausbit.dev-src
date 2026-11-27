import { describe, expect, it } from 'vitest'
import {
  DISCOVERY_GROUP_LABELS,
  DISCOVERY_LISTS,
  discoveryListById
} from '../../src/services/moderationLists'

describe('curated moderation lists', () => {
  it('has unique ids, owners and complete display data', () => {
    const ids = new Set()
    const ownerType = new Set()
    for (const list of DISCOVERY_LISTS) {
      expect(list.id).toBeTruthy()
      expect(ids.has(list.id)).toBe(false)
      ids.add(list.id)
      expect(list.owner).toMatch(/^[a-z][a-z0-9.-]{2,15}$/)
      expect(['mute', 'blacklist']).toContain(list.type)
      const key = list.owner + ':' + list.type
      expect(ownerType.has(key)).toBe(false)
      ownerType.add(key)
      expect(list.title).toBeTruthy()
      expect(list.description).toBeTruthy()
      expect(list.statusLabel).toBeTruthy()
      expect(Number.isInteger(list.knownCount)).toBe(true)
      expect(list.knownCount).toBeGreaterThan(0)
      expect(list.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(DISCOVERY_GROUP_LABELS[list.group]).toBeTruthy()
    }
  })

  it('marks unsupported lists with a reason and no count fetch', () => {
    for (const list of DISCOVERY_LISTS.filter(item => item.supported === false)) {
      expect(list.fetchCount).toBe(false)
      expect(list.unsupportedReason).toBeTruthy()
    }
  })

  it('looks up by id and returns null for misses', () => {
    expect(discoveryListById('hive-blog-phishing').owner).toBe('hive.blog')
    expect(discoveryListById('missing')).toBeNull()
    expect(discoveryListById('')).toBeNull()
  })
})
