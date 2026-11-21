// Helpers for composer media and post metadata text.
//
// These are deliberately pure so the editor, the metadata builder and the
// preview all agree on which images and mentions a post contains.

import { safeExternalUrl } from './safeUrl'

const IMAGE_EXTENSION = /\.(?:tiff?|jpe?g|gif|png|svg|webp|avif|apng|bmp)(?:[?#][^\s)"'<>]*)?/i
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g
const HTML_IMAGE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
const MENTION = /(^|[^a-z0-9._%+-])@([a-z][a-z0-9.-]{2,15})\b/gi
const CODE_BLOCK = /```[\s\S]*?```/g
const INLINE_CODE = /`[^`]*`/g
const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/gi

function decodeEntities (value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

/** Trim the decorations a URL picks up in prose, then validate it. */
export function normalizeImageUrl (value) {
  let text = decodeEntities(value).trim()
  if (!text || text.startsWith('<')) text = text.replace(/^<|>$/g, '').trim()
  text = text.replace(/[),.;!?]+$/, '')
  const url = safeExternalUrl(text)
  return url || ''
}

export function isImageUrl (value) {
  const url = normalizeImageUrl(value)
  return Boolean(url && IMAGE_EXTENSION.test(url))
}

/**
 * Images declared in a post body, in document order. Markdown wins over HTML
 * when the same URL appears twice.
 */
export function extractBodyImages (body, { limit = 40 } = {}) {
  const text = String(body || '')
  const found = []
  const seen = new Set()

  const push = (url, alt = '') => {
    const safe = normalizeImageUrl(url)
    if (!safe || seen.has(safe)) return
    seen.add(safe)
    found.push({ url: safe, alt: String(alt || '').trim() })
  }

  let match
  MARKDOWN_IMAGE.lastIndex = 0
  while ((match = MARKDOWN_IMAGE.exec(text)) && found.length < limit) {
    push(match[2], match[1])
  }

  HTML_IMAGE.lastIndex = 0
  while ((match = HTML_IMAGE.exec(text)) && found.length < limit) {
    const tag = match[0]
    const alt = tag.match(/\balt=["']([^"']*)["']/i)
    push(match[1], alt ? alt[1] : '')
  }

  return found
}

export function collectImageUrls (body, options = {}) {
  return extractBodyImages(body, options).map(image => image.url)
}

/** Escape the small set of characters that would break an image link. */
export function markdownImage ({ alt = 'image', url = '' } = {}) {
  const label = String(alt || 'image').replace(/[[\]]/g, '').replace(/\n/g, ' ').trim() || 'image'
  const href = normalizeImageUrl(url) || String(url || '').trim()
  return '![' + label + '](' + href + ')'
}

/** A readable alt text fallback from a file name. */
export function altFromFileName (name) {
  const base = String(name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base.slice(0, 100) || 'image'
}

/** Plain-text excerpt for cards, link previews and `json_metadata.description`. */
export function deriveDescription (body, max = 120) {
  let text = String(body || '')
    .replace(CODE_BLOCK, ' ')
    .replace(INLINE_CODE, ' ')
    .replace(MARKDOWN_IMAGE, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:https?|ftp):\/\/[^\s]+/g, ' ')
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*[>*+-][ \t]*/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  const limit = Math.max(20, Number(max) || 120)
  if (text.length <= limit) return text
  const slice = text.slice(0, limit - 1)
  const cut = slice.lastIndexOf(' ')
  text = (cut > limit * 0.6 ? slice.slice(0, cut) : slice).trimEnd()
  return text + '…'
}

/**
 * Accounts mentioned in the body. Code blocks and URLs are ignored so an
 * email address or an API path never becomes a mention.
 */
export function extractMentionedUsers (body, { limit = 20 } = {}) {
  const text = String(body || '')
    .replace(CODE_BLOCK, ' ')
    .replace(INLINE_CODE, ' ')
    .replace(URL_PATTERN, ' ')
  const users = []
  const seen = new Set()
  let match
  MENTION.lastIndex = 0
  while ((match = MENTION.exec(text))) {
    const user = match[2].toLowerCase().replace(/[.-]+$/, '')
    if (!user || user.length < 3 || seen.has(user)) continue
    seen.add(user)
    users.push(user)
    if (users.length >= limit) break
  }
  return users
}

export function normalizeStringList (list, { limit = 20 } = {}) {
  const seen = new Set()
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const value = String(item || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}
