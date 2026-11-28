import { describe, expect, it } from 'vitest'
import { EMOJI_CHOICES, EMOJI_GROUPS } from '../../src/utils/emoji'

describe('composer emoji catalogue', () => {
  it('gives every group and entry a unique accessible identity', () => {
    expect(new Set(EMOJI_GROUPS.map(group => group.id)).size).toBe(EMOJI_GROUPS.length)
    expect(new Set(EMOJI_GROUPS.map(group => group.label)).size).toBe(EMOJI_GROUPS.length)
    const characters = new Set()
    for (const group of EMOJI_GROUPS) {
      expect(group.emoji.length).toBeGreaterThan(0)
      for (const emoji of group.emoji) {
        expect(typeof emoji.char).toBe('string')
        expect(emoji.char.length).toBeGreaterThan(0)
        expect(emoji.label.length).toBeGreaterThan(0)
        expect(characters.has(emoji.char)).toBe(false)
        characters.add(emoji.char)
      }
    }
    expect(EMOJI_CHOICES).toHaveLength(characters.size)
  })
})
