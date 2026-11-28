import { beforeEach, describe, expect, it } from 'vitest'
import { loadNotes, notesSummary, removeNote, saveNote } from '../../src/services/downvoteNotes'

beforeEach(() => {
  localStorage.clear()
})

describe('downvote notes', () => {
  it('saves, reads and removes a private row note', () => {
    saveNote('viewer', 'i:42', { note: 'No answer after asking why.', tags: ['asked why', 'no reason given'] })
    const notes = loadNotes('viewer')
    expect(notes['i:42']).toMatchObject({
      note: 'No answer after asking why.',
      tags: ['asked why', 'no reason given']
    })
    expect(notesSummary(notes)).toMatchObject({ count: 1 })
    removeNote('viewer', 'i:42')
    expect(loadNotes('viewer')).toEqual({})
  })

  it('keeps scopes separate and drops an empty note', () => {
    saveNote('alice', 'i:1', { note: 'note', tags: [] })
    expect(loadNotes('bob')).toEqual({})
    saveNote('alice', 'i:1', { note: '   ', tags: [] })
    expect(loadNotes('alice')).toEqual({})
  })

  it('caps note length and tag count while normalizing duplicates', () => {
    saveNote('viewer', 'i:2', {
      note: 'x'.repeat(5000),
      tags: ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']
    })
    const note = loadNotes('viewer')['i:2']
    expect(note.note).toHaveLength(4000)
    expect(note.tags).toHaveLength(6)
    expect(note.tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})
