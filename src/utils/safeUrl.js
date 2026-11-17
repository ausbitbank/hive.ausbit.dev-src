const HTTP_PROTOCOLS = ['http:', 'https:']
const MAILTO_PROTOCOL = 'mailto:'

// Control characters are never valid in a user-facing link and can be used to
// smuggle schemes past naive checks.
function hasControlChars (value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * Return a safe absolute URL for untrusted, metadata-driven links.
 * Only http:/https: are allowed by default; mailto: can be opted into.
 * Protocol-relative, javascript:, data:, vbscript: and malformed values are
 * rejected (null is returned).
 */
export function safeExternalUrl (value, { allowMailto = false } = {}) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (hasControlChars(trimmed)) return null
  if (trimmed.startsWith('//')) return null

  const protocols = allowMailto ? [...HTTP_PROTOCOLS, MAILTO_PROTOCOL] : HTTP_PROTOCOLS

  try {
    const url = new URL(trimmed)
    if (!protocols.includes(url.protocol)) return null

    if (url.protocol === MAILTO_PROTOCOL) {
      return url.pathname ? url.href : null
    }

    if (!url.hostname) return null
    return url.href
  } catch {
    return null
  }
}

/**
 * Convenience helper for anchor attributes. Returns an empty object when the
 * URL is unsafe so callers can render plain text instead of a link.
 */
export function safeHrefAttrs (value, options) {
  const href = safeExternalUrl(value, options)
  if (!href) return {}

  return {
    href,
    target: '_blank',
    rel: 'noopener noreferrer'
  }
}
