// Which third party resizes and serves images we render.
//
// Post bodies used to be proxied through Ecency by the render helper's default
// proxy base. A block or outage on that host therefore breaks every body image.
// The reader can pick a different proxy (or none) in Settings; this module is
// the single place that knows how to build those URLs.
//
// Card images only proxy hosts the Hive image host is known to resize. Body
// images arrive already proxied as `<base>/p/<base58-url>`, so the chosen host
// is applied by swapping the base and keeping the hash and query.

export const IMAGE_PROXY_HIVE = 'hive'
export const IMAGE_PROXY_ECENCY = 'ecency'
export const IMAGE_PROXY_DIRECT = 'direct'

export const DEFAULT_IMAGE_PROXY = IMAGE_PROXY_HIVE

export const IMAGE_PROXY_OPTIONS = [
  {
    value: IMAGE_PROXY_HIVE,
    label: 'images.hive.blog',
    hint: 'Resized copies from the Hive image host. Works for Hive, PeakD, Ecency and most public image hosts.'
  },
  {
    value: IMAGE_PROXY_ECENCY,
    label: 'Ecency (i.ecency.com)',
    hint: 'Ecency\'s image proxy. Supports AVIF, but the site stops displaying post images if Ecency blocks your connection.'
  },
  {
    value: IMAGE_PROXY_DIRECT,
    label: 'Direct from the source',
    hint: 'Loads the original file with no resizing. Faster on some hosts, heavier on mobile data, and the image host sees your IP.'
  }
]

export const IMAGE_PROXY_BASES = {
  [IMAGE_PROXY_HIVE]: 'https://images.hive.blog',
  [IMAGE_PROXY_ECENCY]: 'https://i.ecency.com'
}

// Hosts the Hive image host is known to resize for us. Unknown hosts are left
// alone so a broken proxy cannot replace an image that would otherwise load.
export const PROXY_SOURCE_HOSTS = [
  'images.hive.blog',
  'files.peakd.com',
  'images.ecency.com',
  'i.ecency.com',
  'cdn.steemitimages.com',
  'steemitimages.com',
  'images.3speak.tv'
]

// Hosts whose images are already sized/processed by the host itself.
export const SHORT_FORM_DIRECT_HOSTS = [
  'images.hive.blog',
  'i.ecency.com',
  'files.peakd.com',
  'media.giphy.com',
  'media0.giphy.com'
]

const PROXY_HOSTS = new Set(['i.ecency.com', 'images.ecency.com', 'images.hive.blog'])
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_LOOKUP = new Map(BASE58_ALPHABET.split('').map((char, index) => [char, index]))

let currentMode = DEFAULT_IMAGE_PROXY

export function normalizeImageProxyMode (value) {
  const mode = String(value || '').trim().toLowerCase()
  return mode === IMAGE_PROXY_ECENCY || mode === IMAGE_PROXY_DIRECT ? mode : DEFAULT_IMAGE_PROXY
}

export function getImageProxyMode () {
  return currentMode
}

export function setImageProxyMode (value) {
  currentMode = normalizeImageProxyMode(value)
  return currentMode
}

export function imageProxyBase (mode = currentMode) {
  return IMAGE_PROXY_BASES[normalizeImageProxyMode(mode)] || ''
}

export function imageProxyHint (mode = currentMode) {
  const normalized = normalizeImageProxyMode(mode)
  return IMAGE_PROXY_OPTIONS.find(option => option.value === normalized)?.hint || ''
}

function parseUrl (url) {
  try {
    return new URL(String(url || '').trim())
  } catch {
    return null
  }
}

function proxiedParts (url) {
  const parsed = typeof url === 'string' ? parseUrl(url) : null
  if (!parsed || !PROXY_HOSTS.has(parsed.hostname)) return null
  const match = parsed.pathname.match(/^\/p\/([^/]+)\/?$/)
  if (!match) return null
  // A trailing .webp/.png on the encoded segment is ignored by both proxies.
  return { parsed, hash: match[1].replace(/\.(?:webp|png)$/i, '') }
}

/** True when `url` is a `<proxy host>/p/<base58-url>` transform URL. */
export function isProxiedImageUrl (url) {
  return Boolean(proxiedParts(url))
}

/** Decode the base58 URL segment both image proxies use. */
export function decodeBase58 (value) {
  const input = String(value || '').trim()
  if (!input) return null
  const bytes = []
  for (const char of input) {
    const digit = BASE58_LOOKUP.get(char)
    if (digit === undefined) return null
    let carry = digit
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58
      bytes[i] = carry % 256
      carry = Math.floor(carry / 256)
    }
    while (carry > 0) {
      bytes.push(carry % 256)
      carry = Math.floor(carry / 256)
    }
  }
  for (let i = 0; i < input.length && input[i] === '1'; i += 1) bytes.push(0)
  return Uint8Array.from(bytes.reverse())
}

/** The original source URL behind a proxy URL, or the input when it is not one. */
export function decodeProxiedImageUrl (url, depth = 0) {
  const parts = proxiedParts(url)
  if (!parts || depth > 3) return url
  const bytes = decodeBase58(parts.hash)
  if (!bytes) return url
  let decoded
  try {
    decoded = new TextDecoder().decode(bytes)
  } catch {
    return url
  }
  if (!/^https?:\/\//i.test(decoded)) return url
  return isProxiedImageUrl(decoded) ? decodeProxiedImageUrl(decoded, depth + 1) : decoded
}

function retargetSearch (search, base) {
  if (base !== IMAGE_PROXY_BASES[IMAGE_PROXY_HIVE] || !search) return search
  const params = new URLSearchParams(search)
  // The Hive image host rejects format=avif; let it negotiate or use webp.
  if ((params.get('format') || '').toLowerCase() === 'avif') params.set('format', 'match')
  const next = params.toString()
  return next ? '?' + next : ''
}

function retargetProxied (url, mode) {
  const parts = proxiedParts(url)
  if (!parts) return url
  const base = imageProxyBase(mode)
  return base + parts.parsed.pathname + retargetSearch(parts.parsed.search, base)
}

/**
 * Rewrite one image URL for the selected mode.
 *
 * - proxied transform URLs keep their hash and move to the chosen proxy host
 * - direct mode decodes back to the original source URL
 * - non-proxied URLs are returned unchanged
 */
export function rewriteProxiedImageUrl (url, mode = currentMode) {
  if (typeof url !== 'string' || !url) return url
  if (!isProxiedImageUrl(url)) return url
  const normalized = normalizeImageProxyMode(mode)
  if (normalized === IMAGE_PROXY_DIRECT) return decodeProxiedImageUrl(url)
  const decoded = decodeProxiedImageUrl(url)
  if (normalized === IMAGE_PROXY_HIVE && decoded !== url) {
    const source = parseUrl(decoded)
    // The Hive image host returns 403 for query-string sources and for hosts
    // it does not know how to fetch. Load those from the origin instead of
    // replacing a working image with a broken proxy.
    if (!source || !PROXY_SOURCE_HOSTS.includes(source.hostname) || decoded.includes('?')) {
      return decoded
    }
  }
  return retargetProxied(url, normalized)
}

/** Rewrite a comma-separated `srcset` value for the selected mode. */
export function rewriteSrcset (value, mode = currentMode) {
  const entries = String(value || '').split(',').map(entry => entry.trim()).filter(Boolean)
  const seen = new Set()
  const rewritten = []
  for (const entry of entries) {
    const [url, ...descriptor] = entry.split(/\s+/)
    const next = rewriteProxiedImageUrl(url, mode)
    if (!next) continue
    const key = next + (descriptor.length ? ' ' + descriptor.join(' ') : '')
    if (seen.has(key)) continue
    seen.add(key)
    rewritten.push([next, ...descriptor].join(' '))
  }
  return rewritten.join(', ')
}

function imageSize (width, height) {
  const w = Math.max(0, Math.round(Number(width) || 0))
  const h = Math.max(0, Math.round(Number(height) || 0))
  return h > 0 ? w + 'x' + h : w + 'x0'
}

/**
 * Card/cover image URL. Only known Hive image hosts are proxied; unknown hosts
 * keep loading directly.
 */
export function resizeImageUrl (url, width, height = 0, mode = currentMode) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url
  const normalized = normalizeImageProxyMode(mode)
  if (isProxiedImageUrl(url)) return rewriteProxiedImageUrl(url, normalized)
  if (normalized === IMAGE_PROXY_DIRECT) return url
  const parsed = parseUrl(url)
  if (!parsed || !PROXY_SOURCE_HOSTS.includes(parsed.hostname)) return url
  // Avatars already come at the requested size and the Hive host refuses to
  // chain-proxy them.
  if (parsed.pathname.startsWith('/u/')) return url
  // Query-string sources are refused by the Hive image host.
  if (normalized === IMAGE_PROXY_HIVE && parsed.search) return url
  return imageProxyBase(normalized) + '/' + imageSize(width, height) + '/' + url
}

/** Short-form gallery image URL. Unknown hosts are proxied so a feed stays small. */
export function shortFormImageUrl (url, width, height = 0, mode = currentMode) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url
  const normalized = normalizeImageProxyMode(mode)
  if (isProxiedImageUrl(url)) return rewriteProxiedImageUrl(url, normalized)
  if (normalized === IMAGE_PROXY_DIRECT) return url
  const parsed = parseUrl(url)
  if (!parsed || SHORT_FORM_DIRECT_HOSTS.includes(parsed.hostname)) return url
  if (normalized === IMAGE_PROXY_HIVE && parsed.search) return url
  return imageProxyBase(normalized) + '/' + imageSize(width, height) + '/' + url
}
