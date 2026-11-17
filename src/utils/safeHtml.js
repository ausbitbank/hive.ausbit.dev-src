import DOMPurify from 'dompurify'

// Keep in sync with the embed allowlist in src/components/render.vue.
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

// Attributes that rendered community descriptions/rules may keep on iframes.
const IFRAME_ATTRS = [
  'allowfullscreen',
  'frameborder',
  'allow',
  'scrolling',
  'referrerpolicy',
  'data-embed-src',
  'data-video-href'
]

let hooksInstalled = false

function installIframeGuard () {
  if (hooksInstalled) return
  hooksInstalled = true

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return

    const src = node.getAttribute('src') || ''
    try {
      // Resolve against the current URL; `window.location.origin` is "null" in
      // some non-browser (test/SSR) environments and is not a valid base.
      const base = (window.location && window.location.href) || 'https://localhost/'
      const url = new URL(src, base)
      if (!['http:', 'https:'].includes(url.protocol) || !EMBED_HOSTS.includes(url.hostname)) {
        node.remove()
      }
    } catch {
      node.remove()
    }
  })
}

/**
 * Sanitize HTML that comes from chain metadata (community descriptions and
 * rules) before attaching it with v-html. Allows normal rich-text markup and
 * video embeds from the known hosts only.
 */
export function sanitizeRichHtml (html) {
  if (!html || typeof html !== 'string') return ''
  installIframeGuard()

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: IFRAME_ATTRS
  })
}
