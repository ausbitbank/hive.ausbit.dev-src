import { describe, expect, it } from 'vitest'
import {
  addSavedKey,
  loadSavedKeys,
  removeSavedKey,
  saveSavedKeys,
  saveSigningKeyLabel,
  shortSigningKey
} from '../../src/services/witnessKeys'

const KEY_A = 'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4'
const KEY_B = 'STM7QFGqS2ZzUN1YwaD4uiGE1qyvz3NqdpXc9aF6nUNqTKR9vHm3X'

function memoryStorage () {
  const data = new Map()
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  }
}

describe('saved signing keys', () => {
  it('normalises labels and rejects invalid keys', () => {
    expect(saveSigningKeyLabel('  Primary   node  ')).toBe('Primary node')
    expect(saveSigningKeyLabel('')).toBe('')

    const keys = [
      { key: KEY_A, label: '  Primary   node ' },
      { key: 'not-a-key', label: 'Broken' },
      { key: KEY_A, label: 'Duplicate' },
      { key: KEY_B }
    ]

    expect(addSavedKey([], KEY_A, '  Primary   node ')).toEqual([{ key: KEY_A, label: 'Primary node' }])
    expect(removeSavedKey(keys, KEY_B)).toHaveLength(1)
    expect(removeSavedKey(keys, KEY_B)[0].key).toBe(KEY_A)
  })

  it('adds keys, updates duplicate labels and keeps the list stable', () => {
    let keys = addSavedKey([], KEY_A, 'Primary')
    keys = addSavedKey(keys, KEY_B, 'Backup')
    keys = addSavedKey(keys, KEY_A, 'Main node')

    expect(keys).toEqual([
      { key: KEY_A, label: 'Main node' },
      { key: KEY_B, label: 'Backup' }
    ])
    expect(removeSavedKey(keys, KEY_A)).toEqual([{ key: KEY_B, label: 'Backup' }])
  })

  it('shortens long keys for display', () => {
    expect(shortSigningKey(KEY_A)).toBe(KEY_A.slice(0, 8) + '…' + KEY_A.slice(-6))
    expect(shortSigningKey('short')).toBe('short')
  })

  it('persists saved keys and survives corrupt storage', () => {
    const storage = memoryStorage()
    const keys = [{ key: KEY_A, label: 'Primary' }]
    expect(saveSavedKeys(keys, storage)).toBe(true)
    expect(loadSavedKeys(storage)).toEqual(keys)

    storage.setItem('witnessSigningKeys', '{not json')
    expect(loadSavedKeys(storage)).toEqual([])
  })

  it('returns an empty list when storage is unavailable', () => {
    const broken = {
      getItem () { throw new Error('blocked') },
      setItem () { throw new Error('blocked') }
    }
    expect(loadSavedKeys(broken)).toEqual([])
    expect(saveSavedKeys([], broken)).toBe(false)
  })
})
