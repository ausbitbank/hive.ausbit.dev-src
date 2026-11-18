<template>
  <span ref="root">
    <span v-if="loading" class="postbody-loading" aria-hidden="true">
      <q-skeleton type="rect" height="70vh" />
    </span>
    <span v-else v-html="rendered" />
  </span>
</template>

<script>
import { renderPostBody } from '@ecency/render-helper'
import DOMPurify from 'dompurify'

const EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  '3speak.tv',
  'www.3speak.tv',
  'odysee.com',
  'rumble.com',
  'www.bitchute.com',
  'd.tube',
  'ipfs.io',
  'gateway.ipfs.io'
]

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
      // Image-only links (a logo inside a heading, or an image wrapper) have no
      // text for assistive technology. Name them from the image alt text, or
      // from the destination when the author did not provide any.
      if (!node.textContent.trim()) {
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
    preload: { type: Boolean, default: false }
  },
  data () {
    return {
      rendered: '',
      loading: false,
      renderToken: 0
    }
  },
  watch: {
    input: 'render'
  },
  mounted () {
    installPurifyHooks()
    this.render()
    this.$refs.root.addEventListener('click', this.handleClick)
  },
  beforeUnmount () {
    this.$refs.root?.removeEventListener('click', this.handleClick)
  },
  methods: {
    render () {
      const html = renderPostBody(this.input, false, false)
      const safe = DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allowfullscreen', 'frameborder', 'data-embed-src', 'data-video-href']
      })
      // The page title is the only h1; post content headings start at h2.
      const next = safe
        .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
        .replace(/<\/h1>/gi, '</h2>')

      const token = ++this.renderToken
      if (!this.preload) {
        this.rendered = next
        return
      }

      if (!this.rendered) this.loading = true
      this.preloadImages(safe).then(() => {
        if (token !== this.renderToken) return
        this.rendered = next
        this.loading = false
      })
    },

    preloadImages (html) {
      if (typeof Image === 'undefined') return Promise.resolve()
      const urls = []
      const pattern = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
      let match = pattern.exec(html)
      while (match && urls.length < 4) {
        if (match[1]) urls.push(match[1])
        match = pattern.exec(html)
      }
      if (!urls.length) return Promise.resolve()

      return Promise.all(urls.map(url => new Promise(resolve => {
        const image = new Image()
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve()
        }
        const timer = setTimeout(done, 1500)
        image.onload = done
        image.onerror = done
        image.src = url
      })))
    },

    isAllowedEmbed (src) {
      try {
        const url = new URL(src, window.location.origin)
        return ['http:', 'https:'].includes(url.protocol) && EMBED_HOSTS.includes(url.hostname)
      } catch {
        return false
      }
    },

    handleClick (event) {
      const anchor = event.target.closest?.('a.markdown-video-link')
      if (!anchor) return false

      const embedSrc = anchor.getAttribute('data-embed-src')
      const videoHref = anchor.getAttribute('data-video-href')
      const src = embedSrc || videoHref
      if (!src || !this.isAllowedEmbed(src)) return false

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
