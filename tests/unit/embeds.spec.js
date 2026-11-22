import { describe, expect, it } from 'vitest'
import { detectEmbed, embedProviderLabel } from '../../src/services/embeds'

describe('media embed detection', () => {
  it('recognises YouTube URL shapes and provides a thumbnail', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    ]) {
      const detected = detectEmbed(url)
      expect(detected.provider).toBe('YouTube')
      expect(detected.markdown).toBe(url)
      expect(detected.thumbnail).toContain('dQw4w9WgXcQ')
    }
  })

  it('recognises video providers that the renderer handles as links', () => {
    expect(detectEmbed('https://vimeo.com/123456789')?.provider).toBe('Vimeo')
    expect(detectEmbed('https://3speak.tv/watch?v=alice/my-video')?.provider).toBe('3Speak')
    expect(detectEmbed('https://odysee.com/@channel:1/video:2')?.provider).toBe('Odysee')
    expect(detectEmbed('https://rumble.com/v123abc-title.html')?.provider).toBe('Rumble')
    expect(detectEmbed('https://www.bitchute.com/video/abc123/')?.provider).toBe('BitChute')
    expect(detectEmbed('https://d.tube/#!/v/alice/video')?.provider).toBe('DTube')
  })

  it('builds audio and live players as iframes on allowed hosts', () => {
    const spotify = detectEmbed('https://open.spotify.com/track/abc123')
    expect(spotify.provider).toBe('Spotify')
    expect(spotify.markdown).toContain('<iframe')
    expect(spotify.markdown).toContain('https://open.spotify.com/embed/track/abc123')

    const soundcloud = detectEmbed('https://soundcloud.com/artist/track')
    expect(soundcloud.provider).toBe('SoundCloud')
    expect(soundcloud.markdown).toContain('w.soundcloud.com/player')

    const video = detectEmbed('https://twitch.tv/videos/123456789')
    expect(video.provider).toBe('Twitch')
    expect(video.markdown).toContain('player.twitch.tv/?video=123456789')

    const clip = detectEmbed('https://clips.twitch.tv/SomeClipSlug')
    expect(clip.provider).toBe('Twitch')
    expect(clip.markdown).toContain('player.twitch.tv/?clip=SomeClipSlug')
  })

  it('leaves Twitch channel profile links as ordinary links', () => {
    expect(detectEmbed('https://twitch.tv/somechannel')).toBeNull()
    expect(detectEmbed('https://www.twitch.tv/somechannel')).toBeNull()
  })

  it('turns image URLs into markdown images and social posts into links', () => {
    expect(detectEmbed('https://images.hive.blog/DQmTest/photo.png')?.markdown)
      .toBe('![image](https://images.hive.blog/DQmTest/photo.png)')
    expect(detectEmbed('https://x.com/alice/status/123456789')?.markdown)
      .toContain('[View this post on X]')
  })

  it('rejects unsupported and unsafe URLs', () => {
    expect(detectEmbed('https://example.com/article')).toBeNull()
    expect(detectEmbed('javascript:alert(1)')).toBeNull()
    expect(detectEmbed('https://x.com/alice')).toBeNull()
    expect(embedProviderLabel('https://youtu.be/dQw4w9WgXcQ')).toBe('YouTube')
  })
})
