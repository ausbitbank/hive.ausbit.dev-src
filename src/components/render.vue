<template>
  <span ref="root" v-html="rendered" />
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
}

export default {
  name: 'render',
  props: {
    input: { type: String, default: '' }
  },
  data () {
    return {
      rendered: ''
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
      this.rendered = DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allowfullscreen', 'frameborder', 'data-embed-src', 'data-video-href']
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
