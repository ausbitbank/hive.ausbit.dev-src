import { describe, expect, it } from 'vitest'
import {
  dismissWarning,
  dismissedWarningsKey,
  MAX_DISMISSED_WARNINGS,
  readDismissedWarnings,
  restoreDismissedWarnings
} from '../../src/services/checklistPrefs'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.get(key) ?? null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

describe('checklist warning preferences', () => {
  it('stores dismissals per account and guest separately', () => {
    const storage = memoryStorage()
    expect(readDismissedWarnings(storage, 'alice')).toEqual([])
    dismissWarning(storage, 'alice', 'cover-missing')
    expect(readDismissedWarnings(storage, 'alice')).toEqual(['cover-missing'])
    expect(readDismissedWarnings(storage, 'bob')).toEqual([])
    expect(readDismissedWarnings(storage, null)).toEqual([])
    expect(dismissedWarningsKey('alice')).not.toBe(dismissedWarningsKey(null))
  })

  it('deduplicates, caps and restores warnings', () => {
    const storage = memoryStorage()
    dismissWarning(storage, 'alice', 'cover-missing')
    dismissWarning(storage, 'alice', 'cover-missing')
    expect(readDismissedWarnings(storage, 'alice')).toEqual(['cover-missing'])

    for (let index = 0; index < MAX_DISMISSED_WARNINGS + 5; index++) {
      dismissWarning(storage, 'alice', 'warning-' + index)
    }
    expect(readDismissedWarnings(storage, 'alice')).toHaveLength(MAX_DISMISSED_WARNINGS)

    expect(restoreDismissedWarnings(storage, 'alice')).toEqual([])
    expect(readDismissedWarnings(storage, 'alice')).toEqual([])
  })

  it('ignores malformed storage values', () => {
    const storage = memoryStorage()
    storage.set(dismissedWarningsKey('alice'), '__q_objt|not json')
    expect(readDismissedWarnings(storage, 'alice')).toEqual([])
    storage.set(dismissedWarningsKey('alice'), { version: 1, warnings: ['cover-missing', '', 42, 'bad key!'] })
    expect(readDismissedWarnings(storage, 'alice')).toEqual(['cover-missing'])
  })
})
