import { describe, expect, it } from 'vitest'
import {
  createSnippet,
  MAX_SNIPPETS,
  mergeSnippets,
  normalizeSnippet,
  parseSnippetExport,
  readSnippets,
  removeSnippetById,
  serializeSnippetExport,
  upsertSnippet,
  writeSnippets
} from '../../src/services/snippets'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.get(key) ?? null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

describe('snippet model', () => {
  it('normalises names, bodies and owners', () => {
    const snippet = normalizeSnippet({
      name: '  Signature  ',
      body: '  Thanks for reading.  ',
      owner: 'alice'
    }, 1000)
    expect(snippet.name).toBe('Signature')
    expect(snippet.body).toBe('Thanks for reading.')
    expect(snippet.owner).toBe('alice')
    expect(snippet.createdAt).toBe(1000)
  })

  it('creates independent snippets and updates without duplicating', () => {
    const first = createSnippet({ name: 'One', body: 'Body' }, 1000)
    const second = createSnippet({ name: 'Two', body: 'Body' }, 1000)
    expect(first.id).not.toBe(second.id)

    const list = upsertSnippet([first], { ...first, name: 'Updated' }, 2000)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Updated')
    expect(list[0].updatedAt).toBe(2000)
    expect(removeSnippetById(list, first.id)).toEqual([])
  })
})

describe('snippet storage', () => {
  it('keeps snippets per account and drops empty entries', () => {
    const storage = memoryStorage()
    writeSnippets(storage, 'alice', [
      { id: 'a', name: 'A', body: 'Body A' },
      { id: 'b', name: 'No body', body: '' }
    ], 1000)
    expect(readSnippets(storage, 'alice').map(item => item.id)).toEqual(['a'])
    expect(readSnippets(storage, 'bob')).toEqual([])
  })

  it('caps the stored list', () => {
    const storage = memoryStorage()
    const list = Array.from({ length: MAX_SNIPPETS + 5 }, (_, index) => ({
      id: 's' + index,
      name: 'Snippet ' + index,
      body: 'Body',
      updatedAt: index
    }))
    writeSnippets(storage, 'alice', list, 1000)
    expect(readSnippets(storage, 'alice')).toHaveLength(MAX_SNIPPETS)
  })

  it('round-trips an export envelope', () => {
    const text = serializeSnippetExport([{ name: 'Signature', body: 'Thanks' }], { now: 3000 })
    const parsed = parseSnippetExport(text, { owner: 'alice', now: 4000 })
    expect(parsed.error).toBe('')
    expect(parsed.snippets[0].name).toBe('Signature')
    expect(parsed.snippets[0].owner).toBe('alice')
  })

  it('merges imported snippets without overwriting newer local copies', () => {
    const local = [{ id: 'a', name: 'Local', body: 'Body', updatedAt: 2000 }]
    const merged = mergeSnippets(local, [
      { id: 'a', name: 'Older', body: 'Body', updatedAt: 1000 },
      { id: 'b', name: 'Imported', body: 'Body', updatedAt: 3000 }
    ], { owner: 'alice', now: 4000 })
    expect(merged.added).toBe(1)
    expect(merged.updated).toBe(0)
    expect(merged.skipped).toBe(1)
    expect(merged.snippets.map(item => item.id).sort()).toEqual(['a', 'b'])
  })
})
