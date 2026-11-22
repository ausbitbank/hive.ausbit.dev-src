import { describe, expect, it } from 'vitest'
import render, { bodyImageUrls, threeSpeakEmbedUrl } from '../../src/components/render.vue'

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

  it('prioritises only the first body image', () => {
    const html = render.methods.prioritizeFirstImage(
      '<p><img src="a.png" loading="lazy"><img src="b.png" loading="lazy"></p>'
    )
    expect(html).toContain('<img fetchpriority="high" loading="eager" src="a.png">')
    expect(html).toContain('<img src="b.png" loading="lazy">')
  })

  it('extracts body images in reading order, de-duplicated', () => {
    expect(bodyImageUrls(
      '![a](https://images.example/a.png) text <img src="https://images.example/b.png"> ' +
      'https://images.example/a.png https://images.example/not-an-image'
    )).toEqual(['https://images.example/a.png', 'https://images.example/b.png'])
  })

  it('ignores non-http image URLs', () => {
    expect(bodyImageUrls('![a](javascript:alert(1)) <img src="data:image/png;base64,x">')).toEqual([])
  })
})
