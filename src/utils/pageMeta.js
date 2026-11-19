// Page-level document metadata (title, description, canonical, Open Graph,
// Twitter cards and optional JSON-LD).
//
// Every tag is looked up by a stable selector and updated in place, so client
// side navigation replaces the existing tags instead of appending duplicates.

export const SITE_NAME = 'hive.ausbit.dev'
export const BASE_URL = 'https://hive.ausbit.dev'
export const DEFAULT_DESCRIPTION = 'A block explorer and toolkit for the Hive blockchain: blocks, accounts, posts, witnesses, proposals, HBD, markets and API nodes.'
export const DEFAULT_IMAGE = '/statics/icons/icon-512x512.png'

const JSON_LD_ID = 'page-json-ld'
const DEFAULT_MAX_LENGTH = 200

function absoluteUrl (value, fallback) {
  try {
    return new URL(value || fallback, BASE_URL).href
  } catch {
    return new URL(fallback, BASE_URL).href
  }
}

function truncateText (text, maxLength) {
  if (!maxLength || text.length <= maxLength) return text
  const clipped = text.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  const cut = lastSpace > maxLength * 0.6 ? lastSpace : clipped.length
  return clipped.slice(0, cut).trimEnd() + '…'
}

// Strip tags/entities from untrusted Hive HTML and collapse whitespace.
// DOMParser is used (no extra dependency); a regex fallback keeps this safe in
// environments without a DOM, such as static analysis or tests.
export function stripHtml (value, maxLength = DEFAULT_MAX_LENGTH) {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)

  let text
  const spaced = raw.replace(/<\/?(?:p|div|br|li|h[1-6]|blockquote|tr|section|article)[^>]*>/gi, ' ')
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(spaced, 'text/html')
    text = parsed.body ? parsed.body.textContent || '' : ''
  } else {
    text = spaced.replace(/<[^>]*>/g, ' ')
  }

  return truncateText(text.replace(/\s+/g, ' ').trim(), maxLength)
}

function upsert (selector, create, attribute, value) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  element.setAttribute(attribute, value)
  return element
}

function setNamedMeta (name, content) {
  return upsert('meta[name="' + name + '"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', name)
    return meta
  }, 'content', content)
}

function setPropertyMeta (property, content) {
  return upsert('meta[property="' + property + '"]', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', property)
    return meta
  }, 'content', content)
}

function setCanonical (href) {
  return upsert('link[rel="canonical"]', () => {
    const link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    return link
  }, 'href', href)
}

// Pages that should not be indexed (search results, not-found states) ask for
// `noindex`. Every other page clears a robots tag left by an earlier route.
function setRobots (noindex) {
  if (typeof document === 'undefined' || !document.head) return
  const existing = document.head.querySelector('meta[name="robots"]')
  if (!noindex) {
    if (existing) existing.remove()
    return
  }
  const meta = existing || document.createElement('meta')
  meta.setAttribute('name', 'robots')
  meta.setAttribute('content', 'noindex, follow')
  if (!existing) document.head.appendChild(meta)
}

function removeCanonical () {
  if (typeof document === 'undefined' || !document.head) return
  const existing = document.head.querySelector('link[rel="canonical"]')
  if (existing) existing.remove()
}

// Add, replace or (when called with no object) remove the page JSON-LD block.
export function setJsonLd (jsonLd) {
  if (typeof document === 'undefined' || !document.head) return null
  const existing = document.getElementById(JSON_LD_ID)

  if (!jsonLd) {
    if (existing) existing.remove()
    return null
  }

  const script = existing || document.createElement('script')
  script.id = JSON_LD_ID
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(jsonLd)
  if (!existing) document.head.appendChild(script)
  return script
}

// Apply page metadata. `url` and `image` may be site-relative; they are
// normalised to absolute URLs against BASE_URL. Pass `noindex` for thin or
// not-found pages: they get a robots noindex tag and no canonical.
export function setPageMeta ({ title, description, image, url, type = 'website', jsonLd = null, noindex = false } = {}) {
  if (typeof document === 'undefined' || !document.head) return null

  const pageTitle = stripHtml(title, 120) || SITE_NAME
  const pageDescription = stripHtml(description, DEFAULT_MAX_LENGTH) || DEFAULT_DESCRIPTION
  const canonical = absoluteUrl(url, '/')
  const imageUrl = absoluteUrl(image, DEFAULT_IMAGE)

  document.title = pageTitle

  setNamedMeta('description', pageDescription)
  setRobots(noindex)
  if (noindex) removeCanonical()
  else setCanonical(canonical)

  setPropertyMeta('og:site_name', SITE_NAME)
  setPropertyMeta('og:type', type)
  setPropertyMeta('og:title', pageTitle)
  setPropertyMeta('og:description', pageDescription)
  setPropertyMeta('og:image', imageUrl)
  setPropertyMeta('og:url', canonical)

  setNamedMeta('twitter:card', 'summary_large_image')
  setNamedMeta('twitter:title', pageTitle)
  setNamedMeta('twitter:description', pageDescription)
  setNamedMeta('twitter:image', imageUrl)

  setJsonLd(jsonLd)

  return { title: pageTitle, description: pageDescription, image: imageUrl, url: canonical }
}
