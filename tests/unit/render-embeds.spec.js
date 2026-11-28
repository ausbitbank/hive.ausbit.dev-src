import { describe, expect, it } from 'vitest'
import render, { bodyImageUrls, threeSpeakEmbedUrl, twitchChannelFromEmbed } from '../../src/components/render.vue'

describe('twitchChannelFromEmbed', () => {
  it('reads the channel from a channel player URL', () => {
    expect(twitchChannelFromEmbed('https://player.twitch.tv/?channel=thecrazygamer16&parent=hive.ausbit.dev'))
      .toBe('thecrazygamer16')
  })

  it('ignores VOD and clip players', () => {
    expect(twitchChannelFromEmbed('https://player.twitch.tv/?video=123456789&parent=hive.ausbit.dev')).toBe('')
    expect(twitchChannelFromEmbed('https://player.twitch.tv/?clip=SomeClipSlug&parent=hive.ausbit.dev')).toBe('')
    expect(twitchChannelFromEmbed('https://example.com/?channel=alice')).toBe('')
  })

  it('turns channel embeds back into plain profile links', () => {
    const html = '<p><a class="markdown-video-link markdown-video-link-twitch">' +
      '<iframe src="https://player.twitch.tv/?channel=thecrazygamer16&parent=hive.ausbit.dev"></iframe></a></p>'
    const result = render.methods.deembedTwitchProfiles(html)
    expect(result).toContain('href="https://www.twitch.tv/thecrazygamer16"')
    expect(result).toContain('>https://www.twitch.tv/thecrazygamer16</a>')
    expect(result).not.toContain('<iframe')
  })

  it('keeps VOD and clip players embedded', () => {
    const html = '<a class="markdown-video-link markdown-video-link-twitch">' +
      '<iframe src="https://player.twitch.tv/?video=123456789&parent=hive.ausbit.dev"></iframe></a>'
    expect(render.methods.deembedTwitchProfiles(html)).toBe(html)
  })
})

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

  it('keeps parentheses in image filenames', () => {
    expect(bodyImageUrls('![a](https://images.example/photo(2).png)'))
      .toEqual(['https://images.example/photo(2).png'])
  })

  it('ignores non-http image URLs', () => {
    expect(bodyImageUrls('![a](javascript:alert(1)) <img src="data:image/png;base64,x">')).toEqual([])
  })
})
