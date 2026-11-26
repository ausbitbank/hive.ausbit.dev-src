// Recognise media URLs and turn them into editor marks.
//
// Video and social links are inserted as plain URLs because the post renderer
// already turns them into click-to-load embeds. Audio players need an iframe,
// so the shared embed host allow-list includes those providers.

import { isImageUrl, markdownImage, normalizeImageUrl } from '../utils/media'
import { safeExternalUrl } from '../utils/safeUrl'

function hostOf (url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function youTubeId (url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || ''
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
    return parsed.searchParams.get('v') || ''
  } catch {
    return ''
  }
}

function vimeoId (url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts.find(part => /^\d+$/.test(part)) || ''
  } catch {
    return ''
  }
}

function spotifyEmbed (url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const type = parts[0]
    const id = parts[1]
    if (!['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type) || !id) return ''
    return 'https://open.spotify.com/embed/' + type + '/' + id
  } catch {
    return ''
  }
}

// Twitch requires the embedding hostname in the `parent` parameter. The app is
// served on both banksia.io and the legacy hive.ausbit.dev host, so use the
// current host when it is a real domain and fall back to the canonical one.
function twitchParent () {
  try {
    const host = typeof window !== 'undefined' && window.location ? window.location.hostname : ''
    if (host && host !== 'localhost' && !host.startsWith('127.')) return host
  } catch {}
  return 'banksia.io'
}

// Channel pages are profile links, not something the player can show unless
// the channel happens to be live. Only embed a specific VOD or clip.
function twitchEmbed (url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const parts = parsed.pathname.split('/').filter(Boolean)
    const parent = '&parent=' + encodeURIComponent(twitchParent())
    if (host === 'clips.twitch.tv') {
      const slug = parts[0]
      if (!slug) return ''
      return 'https://player.twitch.tv/?clip=' + encodeURIComponent(slug) + parent
    }
    if (parts[0] === 'videos' && /^\d+$/.test(parts[1] || '')) {
      return 'https://player.twitch.tv/?video=' + parts[1] + parent
    }
    if (parts[1] === 'clip' && parts[2]) {
      return 'https://player.twitch.tv/?clip=' + encodeURIComponent(parts[2]) + parent
    }
    return ''
  } catch {
    return ''
  }
}

function soundCloudEmbed (url) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('soundcloud.com')) return ''
    return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
      '&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false'
  } catch {
    return ''
  }
}

function iframeMarkdown (src, title = 'Embedded media') {
  return '<iframe src="' + src + '" title="' + title + '" frameborder="0" allowfullscreen loading="lazy"></iframe>'
}

/**
 * Return a provider description for a URL, or null when it is not a supported
 * media link. `markdown` is what the editor should insert.
 */
export function detectEmbed (value) {
  const url = safeExternalUrl(value)
  if (!url) return null

  if (isImageUrl(url)) {
    const image = normalizeImageUrl(url)
    return image
      ? { kind: 'image', provider: 'Image', url: image, markdown: markdownImage({ alt: 'image', url: image }) }
      : null
  }

  const host = hostOf(url)

  if (['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    const id = youTubeId(url)
    if (!id || !/^[\w-]{6,}$/.test(id)) return null
    return {
      kind: 'video',
      provider: 'YouTube',
      url,
      markdown: url,
      thumbnail: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = vimeoId(url)
    if (!id) return null
    return { kind: 'video', provider: 'Vimeo', url, markdown: url }
  }

  if (host === '3speak.tv' || host === 'play.3speak.tv') {
    if (!/3speak\.tv\/.+/i.test(url)) return null
    return { kind: 'video', provider: '3Speak', url, markdown: url }
  }

  if (host === 'odysee.com') {
    return { kind: 'video', provider: 'Odysee', url, markdown: url }
  }

  if (host === 'rumble.com') {
    return { kind: 'video', provider: 'Rumble', url, markdown: url }
  }

  if (host === 'bitchute.com') {
    return { kind: 'video', provider: 'BitChute', url, markdown: url }
  }

  if (host === 'd.tube') {
    return { kind: 'video', provider: 'DTube', url, markdown: url }
  }

  if (host === 'open.spotify.com') {
    const embed = spotifyEmbed(url)
    if (!embed) return null
    return { kind: 'audio', provider: 'Spotify', url, embedUrl: embed, markdown: iframeMarkdown(embed, 'Spotify player') }
  }

  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    const embed = soundCloudEmbed(url)
    if (!embed) return null
    return { kind: 'audio', provider: 'SoundCloud', url, embedUrl: embed, markdown: iframeMarkdown(embed, 'SoundCloud player') }
  }

  if (host === 'x.com' || host === 'twitter.com') {
    if (!/\/status\/\d+/i.test(url)) return null
    return { kind: 'social', provider: 'X', url, markdown: '[View this post on X](' + url + ')' }
  }

  if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
    const embed = twitchEmbed(url)
    if (!embed) return null
    return { kind: 'live', provider: 'Twitch', url, embedUrl: embed, markdown: iframeMarkdown(embed, 'Twitch player') }
  }

  return null
}

export function embedProviderLabel (value) {
  return detectEmbed(value)?.provider || ''
}
