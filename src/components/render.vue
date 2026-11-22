<template>
  <span ref="root">
    <span v-if="loading" class="postbody-loading" aria-hidden="true">
      <q-skeleton type="rect" height="70vh" />
    </span>
    <span v-else v-html="rendered" />
  </span>
</template>

<script>
import DOMPurify from 'dompurify'
import { EMBED_HOSTS } from 'src/utils/embedHosts'

// The render-helper bundle carries a very large serializer. Loading it lazily
// keeps it out of the initial JavaScript for the home, block and account
// surfaces; only post/proposal pages pay for it.
let renderHelperPromise = null
function loadRenderHelper () {
  if (!renderHelperPromise) renderHelperPromise = import('@ecency/render-helper')
  return renderHelperPromise
}

function decodedImageUrl (url) {
  return String(url || '').replace(/&amp;/g, '&')
}

const imageSizes = new Map()
const imagePending = new Map()

function decodeEntities (value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Image URLs from raw post markdown/HTML, in reading order. Bounded because
 * only the first few images are worth sizing before paint.
 */
export function bodyImageUrls (source, limit = 4) {
  const text = String(source || '')
  if (!text) return []
  const urls = []
  const add = raw => {
    const decoded = decodeEntities(decodedImageUrl(raw)).trim()
    if (!/^https?:\/\//i.test(decoded) || urls.includes(decoded)) return
    urls.push(decoded)
  }

  const markdown = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g
  let match = markdown.exec(text)
  while (match && urls.length < limit) {
    add(match[1])
    match = markdown.exec(text)
  }

  const html = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  match = html.exec(text)
  while (match && urls.length < limit) {
    add(match[1])
    match = html.exec(text)
  }

  if (urls.length < limit) {
    const bare = text.match(/https?:\/\/[^\s)"'<>]+/g) || []
    for (const url of bare) {
      if (urls.length >= limit) break
      if (!/\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(url)) continue
      add(url)
    }
  }
  return urls.slice(0, limit)
}

function loadImageSize (url, timeoutMs = 4000) {
  const key = decodedImageUrl(url)
  if (!/^https?:\/\//i.test(key)) return Promise.resolve(null)
  if (imageSizes.has(key)) return Promise.resolve(imageSizes.get(key))
  if (imagePending.has(key)) return imagePending.get(key)
  if (typeof Image === 'undefined') return Promise.resolve(null)

  const promise = new Promise(resolve => {
    const image = new Image()
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const size = image.naturalWidth > 0 && image.naturalHeight > 0
        ? { width: image.naturalWidth, height: image.naturalHeight }
        : null
      if (size) imageSizes.set(key, size)
      imagePending.delete(key)
      resolve(size)
    }
    const timer = setTimeout(done, timeoutMs)
    image.onload = done
    image.onerror = done
    image.src = key
  })
  imagePending.set(key, promise)
  return promise
}

/** Dimensions for every image measured this session, keyed by raw and decoded URL. */
function sizeMap () {
  const map = new Map()
  for (const [url, size] of imageSizes) {
    const entry = { raw: url, decoded: url, ...size }
    map.set(url, entry)
    map.set(decodedImageUrl(url), entry)
  }
  return map
}

/** Convert a 3Speak watch URL into the Snapie player embed URL. */
export function threeSpeakEmbedUrl (href) {
  try {
    const url = new URL(href, 'https://hive.ausbit.dev')
    if (!['3speak.tv', 'www.3speak.tv', 'play.3speak.tv'].includes(url.hostname)) return ''
    const video = url.searchParams.get('v') || (() => {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'watch' || parts[0] === 'embed') parts.shift()
      return parts.length >= 2 ? parts[0] + '/' + parts[1] : ''
    })()
    if (!/^[a-z0-9.-]+\/[a-z0-9._-]+$/i.test(video)) return ''
    return 'https://play.3speak.tv/embed?v=' + video + '&mode=iframe'
  } catch {
    return ''
  }
}

/**
 * The channel behind a Twitch player URL, unless it points at a specific VOD
 * or clip. The render helper embeds every twitch.tv link, including profile
 * pages, so the renderer uses this to turn channel embeds back into links.
 */
export function twitchChannelFromEmbed (src) {
  try {
    const url = new URL(src, 'https://hive.ausbit.dev')
    if (url.hostname !== 'player.twitch.tv') return ''
    if (url.searchParams.get('video') || url.searchParams.get('clip')) return ''
    return (url.searchParams.get('channel') || '').trim()
  } catch {
    return ''
  }
}

let hooksInstalled = false
function installPurifyHooks () {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    // render-helper decorates @mentions with a full-size author avatar image.
    // Keep the mention link and text, but drop the image (PeakD does the same).
    if (data.tagName === 'img') {
      const className = node.getAttribute('class') || ''
      if (className.split(/\s+/).includes('er-author-link-image')) {
        node.remove()
      }
      return
    }

    if (data.tagName === 'iframe') {
      const src = node.getAttribute('src') || ''
      try {
        const url = new URL(src, window.location.origin)
        if (!['http:', 'https:'].includes(url.protocol) || !EMBED_HOSTS.includes(url.hostname)) {
          node.remove()
        }
      } catch {
        node.remove()
      }
    }
  })

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      if (!node.getAttribute('alt')) node.setAttribute('alt', '')
      node.setAttribute('loading', 'lazy')
      node.setAttribute('decoding', 'async')
    }
    if (node.tagName === 'A') {
      if (node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer')
      }
      const classes = (node.getAttribute('class') || '').split(/\s+/)
      const isVideo = classes.includes('markdown-video-link')
      if (isVideo) {
        node.setAttribute('aria-label', 'Play video')
        node.setAttribute('role', 'button')
        if (!node.hasAttribute('href')) node.setAttribute('tabindex', '0')
      }
      // Image-only links (a logo inside a heading, or an image wrapper) have no
      // text for assistive technology. Name them from the image alt text, or
      // from the destination when the author did not provide any. Video links
      // already carry their own label.
      if (!isVideo && !node.textContent.trim()) {
        const image = node.querySelector('img')
        const alt = (image?.getAttribute('alt') || '').trim()
        if (alt) {
          node.setAttribute('aria-label', alt)
        } else {
          const href = node.getAttribute('href') || ''
          let label = 'Open link'
          try {
            const url = new URL(href, window.location.origin)
            label = 'Open ' + url.hostname + (url.pathname === '/' ? '' : url.pathname)
          } catch {
            // Keep the generic label when the URL cannot be parsed.
          }
          node.setAttribute('aria-label', label)
        }
        if (image) image.setAttribute('alt', '')
      }
    }
  })
}

export default {
  name: 'render',
  props: {
    input: { type: String, default: '' },
    preload: { type: Boolean, default: false },
    embeds: { type: Boolean, default: true }
  },
  data () {
    return {
      rendered: '',
      loading: false,
      renderToken: 0
    }
  },
  watch: {
    input: 'render',
    embeds: 'render'
  },
  mounted () {
    installPurifyHooks()
    this.render()
    this.$refs.root.addEventListener('click', this.handleClick)
    this.$refs.root.addEventListener('keydown', this.handleKeydown)
  },
  beforeUnmount () {
    this.$refs.root?.removeEventListener('click', this.handleClick)
    this.$refs.root?.removeEventListener('keydown', this.handleKeydown)
  },
  methods: {
    render () {
      const token = ++this.renderToken
      this.loading = !this.preload || !this.rendered

      loadRenderHelper()
        .then(({ renderPostBody }) => {
          if (token !== this.renderToken) return
          const html = renderPostBody(this.input, false, false)
          const safe = DOMPurify.sanitize(html, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allowfullscreen', 'frameborder', 'data-embed-src', 'data-video-href']
          })
          const enhanced = this.embeds
            ? this.enhanceEmbeds(this.deembedTwitchProfiles(safe))
            : this.stripEmbeds(this.deembedTwitchProfiles(safe))
          // The page title is the only h1; post content headings start at h2.
          const normalizeHeadings = html => html
            .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
            .replace(/<\/h1>/gi, '</h2>')

          if (!this.preload) {
            this.rendered = normalizeHeadings(enhanced)
            this.loading = false
            return
          }

          // Wait for the body images' dimensions before inserting the HTML so
          // the article does not shift while they load. The timeout is bounded
          // (the old code waited up to 10 s per image, which pinned LCP to the
          // slowest image); stragglers are patched into the DOM after paint.
          const images = bodyImageUrls(enhanced, 4)
          const dimensionsReady = Promise.all(images.map(url => loadImageSize(url, 1800)))
          return dimensionsReady.then(() => {
            if (token !== this.renderToken) return
            this.rendered = normalizeHeadings(
              this.prioritizeFirstImage(this.applyImageDimensions(enhanced, sizeMap()))
            )
            this.loading = false
            this.patchImageDimensions()
          })
        })
        .catch(error => {
          if (token !== this.renderToken) return
          console.error('Failed to load the post renderer', error)
          this.rendered = '<p>' + String(this.input || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('\n', '<br>') + '</p>'
          this.loading = false
        })
    },

    /** Set missing width/height attributes after the article has painted. */
    patchImageDimensions () {
      const root = this.$refs.root
      if (!root || typeof root.querySelectorAll !== 'function') return
      for (const image of root.querySelectorAll('img')) {
        if (image.hasAttribute('width') && image.hasAttribute('height')) continue
        const source = image.getAttribute('src') || ''
        const size = imageSizes.get(source) || imageSizes.get(decodedImageUrl(source))
        if (!size) continue
        if (!image.hasAttribute('width')) image.setAttribute('width', String(size.width))
        if (!image.hasAttribute('height')) image.setAttribute('height', String(size.height))
      }
    },

    /**
     * render-helper turns YouTube links into a click-to-load thumbnail, but it
     * does not recognise 3Speak. Add the same suspended-embed contract for
     * 3Speak links so they can play inside the site.
     */
    enhanceEmbeds (html) {
      if (typeof DOMParser === 'undefined' || !/3speak\.tv/i.test(html)) return html
      const doc = new DOMParser().parseFromString(html, 'text/html')
      for (const anchor of doc.querySelectorAll('a[href]')) {
        const embed = threeSpeakEmbedUrl(anchor.getAttribute('href'))
        if (!embed) continue
        anchor.setAttribute('data-embed-src', embed)
        const classes = (anchor.getAttribute('class') || '').split(/\s+/).filter(Boolean)
        if (!classes.includes('markdown-video-link')) classes.push('markdown-video-link')
        if (!anchor.querySelector('img')) classes.push('markdown-video-link--text')
        anchor.setAttribute('class', classes.join(' '))
        anchor.setAttribute('aria-label', 'Play video')
      }
      return doc.body.innerHTML
    },

    /**
     * render-helper turns every Twitch link into a channel player, including
     * bare profile links, which leaves a dead black frame when the channel is
     * offline. Turn those back into ordinary links; VOD and clip players stay.
     */
    deembedTwitchProfiles (html) {
      if (typeof DOMParser === 'undefined' || !/markdown-video-link-twitch/i.test(html)) return html
      const doc = new DOMParser().parseFromString(html, 'text/html')
      let changed = false
      for (const anchor of doc.querySelectorAll('a.markdown-video-link-twitch')) {
        const channel = twitchChannelFromEmbed(anchor.querySelector('iframe')?.getAttribute('src') || '')
        if (!channel) continue
        const href = 'https://www.twitch.tv/' + encodeURIComponent(channel)
        const link = doc.createElement('a')
        link.setAttribute('href', href)
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
        link.textContent = href
        anchor.replaceWith(link)
        changed = true
      }
      return changed ? doc.body.innerHTML : html
    },

    /**
     * The composer's "Preview embeds" setting. Keep the link, but drop the
     * suspended player and its thumbnail so the preview stays lightweight.
     */
    stripEmbeds (html) {
      if (typeof DOMParser === 'undefined') return html
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('iframe').forEach(node => {
        const src = node.getAttribute('src') || ''
        if (!/^https?:\/\//i.test(src)) {
          node.remove()
          return
        }
        const link = doc.createElement('a')
        link.setAttribute('href', src)
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
        link.textContent = 'Open embedded media'
        node.replaceWith(link)
      })
      for (const anchor of doc.querySelectorAll('a.markdown-video-link')) {
        const youtube = anchor.getAttribute('data-youtube')
        const candidate = anchor.getAttribute('href') ||
          anchor.getAttribute('data-video-href') ||
          anchor.getAttribute('data-embed-src') ||
          (youtube ? 'https://www.youtube.com/watch?v=' + youtube : '')
        if (!/^https?:\/\//i.test(candidate || '')) {
          anchor.remove()
          continue
        }
        anchor.className = ''
        anchor.setAttribute('href', candidate)
        anchor.removeAttribute('data-embed-src')
        anchor.removeAttribute('data-video-href')
        anchor.removeAttribute('data-youtube')
        anchor.removeAttribute('role')
        anchor.removeAttribute('tabindex')
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
        anchor.setAttribute('aria-label', 'Open video')
        anchor.textContent = 'Watch video'
      }
      return doc.body.innerHTML
    },

    /** The first body image is usually the post's LCP. Let it fetch eagerly. */
    prioritizeFirstImage (html) {
      let seen = false
      return html.replace(/<img\b[^>]*>/gi, tag => {
        if (seen) return tag
        seen = true
        return tag
          .replace(/\sloading="[^"]*"/i, '')
          .replace(/\sfetchpriority="[^"]*"/i, '')
          .replace(/^<img/i, '<img fetchpriority="high" loading="eager"')
      })
    },

    applyImageDimensions (html, dimensions) {
      if (!dimensions || dimensions.size === 0) return html
      return html.replace(/<img\b[^>]*>/gi, tag => {
        const source = tag.match(/\bsrc=["']([^"']+)["']/i)
        const size = source && (dimensions.get(source[1]) || dimensions.get(decodedImageUrl(source[1])))
        if (!size || /\swidth\s*=\s*["']?\d/i.test(tag)) return tag
        const close = tag.endsWith('/>') ? '/>' : '>'
        return tag.slice(0, tag.length - close.length) +
          ' width="' + size.width + '" height="' + size.height + '"' + close
      })
    },

    isAllowedEmbed (src) {
      try {
        const url = new URL(src, window.location.origin)
        return ['http:', 'https:'].includes(url.protocol) && EMBED_HOSTS.includes(url.hostname)
      } catch {
        return false
      }
    },

    handleKeydown (event) {
      if (!['Enter', ' '].includes(event.key)) return
      const anchor = event.target.closest?.('a.markdown-video-link')
      if (!anchor) return
      event.preventDefault()
      this.handleClick(event)
    },

    handleClick (event) {
      const anchor = event.target.closest?.('a.markdown-video-link')
      if (!anchor) return false

      const embedSrc = anchor.getAttribute('data-embed-src')
      const videoHref = anchor.getAttribute('data-video-href')
      const src = embedSrc || videoHref
      if (!src || !this.isAllowedEmbed(src)) return false
      event.preventDefault()
      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position:relative;padding-top:56.25%;'

      let media
      if (embedSrc) {
        media = document.createElement('iframe')
        media.setAttribute('frameborder', '0')
        media.setAttribute('allowfullscreen', '')
        media.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;'
      } else {
        media = document.createElement('video')
        media.setAttribute('controls', '')
        media.setAttribute('preload', 'auto')
        media.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;'
      }
      media.setAttribute('src', src)

      wrapper.appendChild(media)
      anchor.replaceWith(wrapper)
      return false
    }
  }
}
</script>

<style scoped>
.postbody-loading {
  display: block;
  min-height: 70vh;
}
</style>

<style>
/* Suspended video embeds render as a thumbnail until clicked. Make that
   affordance explicit with a play badge over the image. */
.markdown-video-link {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.markdown-video-link img {
  display: block;
  max-width: 100%;
  height: auto;
}

.markdown-video-link::before {
  content: '';
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--c-shadow) 30%, transparent);
  transition: background-color 160ms ease;
  pointer-events: none;
}

.markdown-video-link::after {
  content: '▶';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 58px;
  height: 58px;
  border: 2px solid color-mix(in srgb, var(--c-text) 90%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-bg-deep) 82%, transparent);
  color: #fff;
  font-size: 20px;
  line-height: 54px;
  text-align: center;
  padding-left: 4px;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  transition: background-color 160ms ease, transform 160ms ease;
  pointer-events: none;
}

.markdown-video-link:hover::before {
  background: color-mix(in srgb, var(--c-shadow) 12%, transparent);
}

.markdown-video-link:hover::after,
.markdown-video-link:focus-visible::after {
  background: var(--c-link);
  color: var(--c-bg-deep);
  transform: translate(-50%, -50%) scale(1.06);
}

.markdown-video-link--text {
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-link) !important;
  text-decoration: none;
}

.markdown-video-link--text::before {
  content: '▶';
  position: static;
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 0.4rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-link) 16%, transparent);
  color: var(--c-link);
  font-size: 10px;
  line-height: 20px;
  text-align: center;
  padding-left: 2px;
  box-sizing: border-box;
  vertical-align: -4px;
  transform: none;
}

.markdown-video-link--text::after {
  display: none;
}

/* render-helper's 3Speak placeholder is an empty anchor: give it a real,
   clickable 16:9 box so the play badge is not a floating speck. */
.markdown-video-link:not([href]),
.markdown-video-link-speak {
  display: block;
  width: 100%;
  min-height: 200px;
  aspect-ratio: 16 / 9;
  margin: 0.6rem 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-bg-deep);
  cursor: pointer;
}

.markdown-video-link-speak .markdown-video-play {
  display: none;
}

.markdown-video-link:not([href]):focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: 2px;
}
</style>
