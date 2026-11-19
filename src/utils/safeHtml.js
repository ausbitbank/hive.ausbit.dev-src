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
  'play.3speak.tv',
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

// Tags that should read as a word break rather than run words together when
// their markup is stripped (for example "<p>one</p><p>two</p>").
const BLOCK_TAG_PATTERN = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|section|article|hr)[^>]*>/gi
const IGNORED_TEXT_TAGS = 'script, style, noscript, template'

/**
 * Convert untrusted HTML (or plain text) from chain metadata into plain text.
 * Entities are decoded by the parser, block tags become spaces and runs of
 * whitespace are collapsed. Returns '' for null/non-string input.
 */
export function stripHtml (value) {
  if (value === null || value === undefined || typeof value !== 'string') return ''

  const spaced = value.replace(BLOCK_TAG_PATTERN, ' ')

  let text
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(spaced, 'text/html')
    if (parsed.body) {
      // Script/style contents are not visible text; drop them entirely.
      parsed.body.querySelectorAll(IGNORED_TEXT_TAGS).forEach(node => node.remove())
      text = parsed.body.textContent || ''
    } else {
      text = ''
    }
  } else {
    // Fallback for environments without a DOM.
    text = spaced.replace(/<[^>]*>/g, ' ')
  }

  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Parse JSON metadata that came from the chain (`posting_json_metadata`,
 * `json_metadata`). Malformed or non-object values use the fallback so callers
 * can read `.profile`/`.tags` without guarding every access.
 */
export function safeJsonParse (value, fallback = {}) {
  if (typeof value !== 'string') return fallback

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

/**
 * Minimal, safe markdown for short metadata such as community descriptions.
 * The output still goes through `sanitizeRichHtml`; this only avoids pulling
 * the full render-helper (and its ~1 MB serializer) into the browse chunk.
 */
export function simpleMarkdownToHtml (value) {
  if (value === null || value === undefined || typeof value !== 'string') return ''
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .split(/\n{2,}/)
    .map(paragraph => '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>')
    .join('')
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
