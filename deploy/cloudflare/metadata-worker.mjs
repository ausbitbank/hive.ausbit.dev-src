// Cloudflare Worker: chain-aware metadata for shared account and post URLs.
//
// The SPA origin can only describe a post/account from its URL. Link-preview
// scrapers and crawlers that do not run JavaScript therefore see a permlink
// slug and the app icon. This Worker sits in front of the origin and fills the
// title, description, Open Graph image and JSON-LD from Hive before the origin
// HTML is returned.
//
// Deploy (example):
//   wrangler deploy deploy/cloudflare/metadata-worker.mjs \
//     --name hive-metadata --route "hive.ausbit.dev/@*"
//
// It is intentionally dependency-free and fails open: any timeout, missing
// post or API error returns the untouched origin response.
//
// This file is not bundled into the SPA and is not deployed by scripts/deploy.sh.

const HIVE_RPCS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info'
]
const FETCH_TIMEOUT_MS = 2500
const CACHE_SECONDS = 300
const BADGE_CACHE_SECONDS = 3600
const PEAKD_BADGES_URL = 'https://peakd.com/api/public/accounts/badges?account='
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const PEAKD_BADGE_RE = /^badge-\d{6}$/

const POST_PATH = /^\/@([a-z0-9.-]+)\/([a-z0-9][a-z0-9._-]*)\/?$/i
const ACCOUNT_PATH = /^\/@([a-z0-9.-]+)\/?$/i
// Client-side theme surfaces. The origin serves these as a 404 shell because
// the nginx vhost is intentionally explicit about routes; this Worker returns
// the matching prerendered shell with a real 200 at the edge.
const THEME_SHELLS = new Map([
  ['/appearance', '/appearance.html'],
  ['/themes', '/themes.html'],
  ['/settings/skin', '/settings/skin.html']
])
const RESERVED_SUBPATH = /^\/@[a-z0-9.-]+\/(?:wallet|lightning|delegations|transfers|followers|following|posts|blog|feed|replies|comments|communities|tip|trail)(?:\/|$)/i
const LIGHTNING_PATH = /^\/lightning\/?$/i
const ACCOUNT_LIGHTNING_PATH = /^\/@([a-z0-9.-]+)\/lightning\/?$/i

function hasHtml (request) {
  const accept = request.headers.get('accept') || ''
  return request.method === 'GET' && accept.includes('text/html')
}

export function isValidBadgeAccount (value) {
  const name = String(value || '').trim().toLowerCase()
  return HIVE_ACCOUNT_RE.test(name) ? name : ''
}

function jsonResponse (value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers
    }
  })
}

/**
 * Same-origin PeakD badge membership proxy.
 *
 * PeakD rejects browser requests that carry an Origin header, so the client
 * never calls it directly. This route validates the account name, keeps the
 * response at the edge for an hour and returns a small fail-open payload.
 */
async function peakdBadges (request) {
  const url = new URL(request.url)
  const account = isValidBadgeAccount(url.searchParams.get('account'))
  if (!account) {
    return jsonResponse({ error: 'invalid account' }, 400, { 'cache-control': 'no-store' })
  }
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request('https://hive.ausbit.dev/api/badges/peakd?account=' + encodeURIComponent(account), { method: 'GET' })
  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(PEAKD_BADGES_URL + encodeURIComponent(account), {
      headers: {
        accept: 'application/json',
        'user-agent': 'hive.ausbit.dev badge shelf (+https://hive.ausbit.dev)'
      },
      signal: controller.signal
    })
    if (!response.ok) {
      return jsonResponse({ account, badges: [] }, 502, { 'cache-control': 'no-store' })
    }
    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.badges) ? payload.badges : [])
    const badges = [...new Set(rows.filter(name => typeof name === 'string' && PEAKD_BADGE_RE.test(name)))].slice(0, 40)
    const out = jsonResponse({ account, badges }, 200, {
      'cache-control': 'public, max-age=' + BADGE_CACHE_SECONDS,
      'x-hive-badges': 'peakd'
    })
    if (cache) await cache.put(cacheKey, out.clone())
    return out
  } catch {
    return jsonResponse({ account, badges: [] }, 502, { 'cache-control': 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

async function themeShell (request) {
  if (!hasHtml(request)) return null
  const url = new URL(request.url)
  const shell = THEME_SHELLS.get(url.pathname)
  if (!shell) return null
  const shellUrl = new URL(request.url)
  shellUrl.pathname = shell
  shellUrl.search = ''
  const response = await fetch(shellUrl.toString(), {
    headers: { accept: 'text/html' }
  })
  if (!response.ok) return null
  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.set('cache-control', 'public, max-age=' + CACHE_SECONDS)
  headers.set('x-hive-meta', 'theme-shell')
  return new Response(response.body, { status: 200, headers })
}

async function rpc (method, params) {
  for (const endpoint of HIVE_RPCS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': 'hive.ausbit.dev link-preview (+https://hive.ausbit.dev)'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal
      })
      if (!response.ok) {
        continue
      }
      const json = await response.json()
      if (json && json.result) return json.result
    } catch {
      // Try the next known node.
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

function stripMarkdown (value, length = 160) {
  const text = String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= length) return text
  return text.slice(0, length - 1).trimEnd() + '…'
}

function firstImage (metadata) {
  const images = Array.isArray(metadata?.image) ? metadata.image : [metadata?.image]
  const value = images.find(item => typeof item === 'string' && /^https?:\/\//i.test(item))
  return value || ''
}

function proxiedImage (url, width = 800) {
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return ''
  if (/^https:\/\/images\.hive\.blog\/p\//i.test(url)) return url
  return 'https://images.hive.blog/' + width + 'x0/' + url
}

async function postMetadata (author, permlink) {
  const post = await rpc('bridge.get_post', { author, permlink, observer: '' })
  if (!post || !post.author) return null
  let metadata
  try {
    metadata = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : (post.json_metadata || {})
  } catch {
    metadata = {}
  }
  const title = stripMarkdown(post.title, 100) || permlink.replace(/-/g, ' ')
  const description = stripMarkdown(post.body, 180) || ('A Hive post by @' + author + '.')
  const image = proxiedImage(firstImage(metadata)) || ('https://images.hive.blog/u/' + author + '/avatar')
  return {
    title: title + ' — @' + author + ' on Hive',
    description,
    image,
    type: 'article',
    path: '/@' + author + '/' + permlink,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image: [image],
      datePublished: post.created || undefined,
      dateModified: post.last_update || post.created || undefined,
      author: { '@type': 'Person', name: '@' + author, url: 'https://hive.ausbit.dev/@' + author },
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://hive.ausbit.dev/@' + author + '/' + permlink }
    }
  }
}

async function accountMetadata (name) {
  const profile = await rpc('bridge.get_profile', { account: name })
  if (!profile || !profile.name) return null
  const meta = profile.metadata?.profile || profile.profile || {}
  const display = stripMarkdown(meta.name, 80) || name
  const description = stripMarkdown(meta.about, 180) || ('Hive account @' + name + ' on hive.ausbit.dev.')
  const image = proxiedImage(meta.profile_image, 400) || ('https://images.hive.blog/u/' + name + '/avatar')
  return {
    title: display + ' (@' + name + ') — Hive account',
    description,
    image,
    type: 'profile',
    path: '/@' + name,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        identifier: '@' + name,
        name: display,
        description,
        image,
        url: 'https://hive.ausbit.dev/@' + name
      }
    }
  }
}

function escapeHtml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Pass the origin response through with an observability tag. */
function tagged (response, value) {
  const copy = new Response(response.body, response)
  copy.headers.set('x-hive-meta', value)
  return copy
}

function rewriteHead (html, meta) {
  let next = html
  const title = escapeHtml(meta.title)
  next = next.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>')
  const setMeta = (attribute, key, value) => {
    const escaped = escapeHtml(value)
    const tag = '<meta ' + attribute + '="' + key + '" content="' + escaped + '">'
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`<meta\\b[^>]*${attribute}\\s*=\\s*["']${escapedKey}["'][^>]*>`, 'i')
    if (pattern.test(next)) next = next.replace(pattern, tag)
    else next = next.replace('</head>', tag + '\n  </head>')
  }
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:image', meta.image)
  setMeta('property', 'og:url', 'https://hive.ausbit.dev' + meta.path)
  setMeta('property', 'og:type', meta.type)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  setMeta('name', 'twitter:image', meta.image)
  next = next.replace(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i, '<link rel="canonical" href="https://hive.ausbit.dev' + meta.path + '">')
  next = next.replace(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>[\s\S]*?<\/script>/gi, '')
  next = next.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(meta.jsonLd) + '</script>\n  </head>')
  // Replace the static crawler shell heading and summary as well.
  next = next.replace(/(<main\b[^>]*data-seo-shell[^>]*>[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/i, '$1' + title + '$2')
  next = next.replace(/(<main\b[^>]*data-seo-shell[^>]*>[\s\S]*?<\/h1><p>)[\s\S]*?(<\/p>)/i, '$1' + escapeHtml(meta.description) + '$2')
  return next
}

async function lightningShell (request, account = '') {
  const url = new URL(request.url)
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request('https://hive.ausbit.dev/lightning.html?account=' + encodeURIComponent(account), { method: 'GET' })
  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  const response = await fetch(new URL('/lightning.html', url.origin), {
    headers: { accept: 'text/html' }
  })
  if (!response.ok) return fetch(request)

  let html = await response.text()
  if (account) {
    html = rewriteHead(html, {
      title: '@' + account + ' Lightning — hive.ausbit.dev',
      description: 'Receive sats as HIVE or HBD, or pay a Lightning invoice with Hive for @' + account + '.',
      image: 'https://images.hive.blog/u/' + account + '/avatar',
      type: 'website',
      path: '/@' + account + '/lightning',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '@' + account + ' Lightning',
        url: 'https://hive.ausbit.dev/@' + account + '/lightning'
      }
    })
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('etag')
  headers.delete('last-modified')
  const out = new Response(html, {
    status: 200,
    headers
  })
  out.headers.set('content-type', 'text/html; charset=utf-8')
  out.headers.set('cache-control', 'public, max-age=' + CACHE_SECONDS)
  out.headers.set('x-hive-meta', 'lightning')
  if (cache) await cache.put(cacheKey, out.clone())
  return out
}

export default {
  async fetch (request) {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/api/badges/peakd') {
      return peakdBadges(request)
    }

    const theme = await themeShell(request).catch(() => null)
    if (theme) return theme

    const accountLightning = request.method === 'GET' ? url.pathname.match(ACCOUNT_LIGHTNING_PATH) : null
    if (accountLightning) return lightningShell(request, accountLightning[1])
    if (request.method === 'GET' && LIGHTNING_PATH.test(url.pathname)) return lightningShell(request)

    if (!hasHtml(request)) return fetch(request)

    const post = RESERVED_SUBPATH.test(url.pathname) ? null : url.pathname.match(POST_PATH)
    const account = !post && url.pathname.match(ACCOUNT_PATH)
    if (!post && !account) return fetch(request)

    const cache = typeof caches !== 'undefined' ? caches.default : null
    const cacheKey = new Request(url.toString(), request)
    if (cache) {
      const cached = await cache.match(cacheKey)
      if (cached) return cached
    }

    const originResponse = await fetch(request)
    if (!originResponse.ok || !(originResponse.headers.get('content-type') || '').includes('text/html')) {
      return originResponse
    }
    const fallback = originResponse.clone()

    try {
      const meta = post
        ? await postMetadata(post[1], post[2])
        : await accountMetadata(account[1])
      if (!meta) return tagged(fallback, 'miss')

      const html = rewriteHead(await originResponse.text(), meta)
      const response = new Response(html, {
        status: originResponse.status,
        headers: originResponse.headers
      })
      response.headers.set('content-type', 'text/html; charset=utf-8')
      response.headers.set('cache-control', 'public, max-age=' + CACHE_SECONDS)
      response.headers.set('x-hive-meta', 'hit')
      if (cache) await cache.put(cacheKey, response.clone())
      return response
    } catch {
      return tagged(fallback, 'error')
    }
  }
}
