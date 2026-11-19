import { describe, expect, it } from 'vitest'
import { threeSpeakEmbedUrl } from '../../src/components/render.vue'

describe('threeSpeakEmbedUrl', () => {
  it('converts legacy and player watch URLs to the Snapie embed', () => {
    expect(threeSpeakEmbedUrl('https://3speak.tv/watch?v=alice/my-video'))
      .toBe('https://play.3speak.tv/embed?v=alice/my-video&mode=iframe')
    expect(threeSpeakEmbedUrl('https://www.3speak.tv/watch?v=alice/my-video'))
      .toBe('https://play.3speak.tv/embed?v=alice/my-video&mode=iframe')
    expect(threeSpeakEmbedUrl('https://play.3speak.tv/watch?v=alice/my-video'))
      .toBe('https://play.3speak.tv/embed?v=alice/my-video&mode=iframe')
  })

  it('accepts path-style video URLs', () => {
    expect(threeSpeakEmbedUrl('https://3speak.tv/alice/my-video'))
      .toBe('https://play.3speak.tv/embed?v=alice/my-video&mode=iframe')
  })

  it('ignores other hosts and malformed video ids', () => {
    expect(threeSpeakEmbedUrl('https://example.com/watch?v=alice/my-video')).toBe('')
    expect(threeSpeakEmbedUrl('https://3speak.tv/watch?v=nope')).toBe('')
    expect(threeSpeakEmbedUrl('not a url')).toBe('')
  })
})
