// Cloudflare Worker: chain-aware metadata for shared account and post URLs.
//
// The SPA origin can only describe a post/account from its URL. Link-preview
// scrapers and crawlers that do not run JavaScript therefore see a permlink
// slug and the app icon. This Worker sits in front of the origin and fills the
// title, description, Open Graph image and JSON-LD from Hive before the origin
// HTML is returned.
//
// Deploy (example):
//   npx wrangler@4 deploy deploy/cloudflare/metadata-worker.mjs \
//     --name banksia-metadata --route "banksia.io/@*"
//
// It is intentionally dependency-free and fails open: any timeout, missing
// post or API error returns the untouched origin response.
//
// This file is not bundled into the SPA and is not deployed by scripts/deploy.sh.

import { resolveBlogHost, blogPostPathFor } from '../../src/services/blogHost.js'
import { readBlogSettings } from '../../src/services/blogSettings.js'
import { buildBlogRss, blogFeedPosts, escapeXml } from '../../src/services/blogFeed.js'

const HIVE_RPCS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info'
]
const APEX_ORIGIN = 'https://banksia.io'
const FETCH_TIMEOUT_MS = 2500
const CACHE_SECONDS = 300

const POST_PATH = /^\/@([a-z0-9.-]+)\/([a-z0-9][a-z0-9._-]*)\/?$/i
const ACCOUNT_PATH = /^\/@([a-z0-9.-]+)\/?$/i
// Client-side theme surfaces. The origin serves these as a 404 shell because
// the nginx vhost is intentionally explicit about routes; this Worker returns
// the matching prerendered shell with a real 200 at the edge.
const THEME_SHELLS = new Map([
  ['/appearance', '/appearance.html'],
  ['/themes', '/themes.html'],
  ['/settings/skin', '/settings/skin.html'],
  ['/settings/moderation', '/settings/moderation.html'],
  // The blog settings page is a client route without a prerendered shell. Use
  // the app shell so it works before the vhost gains an explicit location.
  ['/settings/blog', '/index.html']
])
const THEME_META = new Map([
  ['/settings/blog', {
    title: 'Blog settings — banksia.io',
    description: 'Claim a free Hive blog at yourname.banksia.io and choose its theme, title and content.',
    image: 'https://banksia.io/statics/og-banksia.png',
    type: 'website',
    path: '/settings/blog',
    origin: 'https://banksia.io',
    siteName: 'Banksia',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Blog settings',
      url: 'https://banksia.io/settings/blog'
    }
  }]
])
const RESERVED_SUBPATH = /^\/@[a-z0-9.-]+\/(?:wallet|lightning|delegations|transfers|followers|following|posts|blog|feed|replies|comments|communities|pos|downvotes|tip|trail)(?:\/|$)/i
const LIGHTNING_PATH = /^\/lightning\/?$/i
const ACCOUNT_LIGHTNING_PATH = /^\/@([a-z0-9.-]+)\/lightning\/?$/i

// Known link-preview fetchers. X/Twitter's card crawler sends
// `Accept: */*` rather than `text/html`, so matching on the Accept header
// alone gave Discord rich cards while X got the generic URL shell.
const PREVIEW_BOT_RE = /(Twitterbot|facebookexternalhit|Discordbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Bluesky|Mastodon|Pleroma|Misskey|Lemmy|Friendica|Akkoma|Kbin|mbin|Pinterest|RedditBot|Embedly|Iframely|SkypeUriPreview|vkShare)/i

function hasHtml (request) {
  if (request.method !== 'GET') return false
  const accept = request.headers.get('accept') || ''
  if (accept.includes('text/html')) return true
  const userAgent = request.headers.get('user-agent') || ''
  return PREVIEW_BOT_RE.test(userAgent)
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
  const meta = THEME_META.get(url.pathname)
  if (!meta) return new Response(response.body, { status: 200, headers })
  headers.delete('content-length')
  headers.delete('content-encoding')
  const html = rewriteHead(stripHomeSnapshot(await response.text()), meta)
  return new Response(html, { status: 200, headers })
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
          'user-agent': 'banksia.io link-preview (+https://banksia.io)'
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

/**
 * Normalise an untrusted image URL. `new URL` percent-encodes characters such
 * as `<` and `>` that would otherwise let a chain-controlled value break out of
 * an HTML attribute or a JSON-LD script block. Returns '' for anything that is
 * not an absolute http(s) URL.
 */
export function normalizeImageUrl (value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.href
  } catch {
    return ''
  }
}

export function firstImage (metadata) {
  const images = Array.isArray(metadata?.image) ? metadata.image : [metadata?.image]
  const value = images.find(item => typeof item === 'string' && /^https?:\/\//i.test(item))
  return normalizeImageUrl(value)
}

function proxiedImage (url, width = 800) {
  const clean = normalizeImageUrl(url)
  if (!clean) return ''
  if (/^https:\/\/images\.hive\.blog\/p\//i.test(clean)) return clean
  return 'https://images.hive.blog/' + width + 'x0/' + clean
}

async function postMetadata (author, permlink, { origin = 'https://banksia.io', path = '', siteName = '', rss = '', post = null } = {}) {
  const row = post || await rpc('bridge.get_post', { author, permlink, observer: '' })
  if (!row || !row.author) return null
  let metadata
  try {
    metadata = typeof row.json_metadata === 'string' ? JSON.parse(row.json_metadata) : (row.json_metadata || {})
  } catch {
    metadata = {}
  }
  const title = stripMarkdown(row.title, 100) || permlink.replace(/-/g, ' ')
  const description = stripMarkdown(row.body, 180) || ('A Hive post by @' + author + '.')
  const image = proxiedImage(firstImage(metadata)) || ('https://images.hive.blog/u/' + author + '/avatar')
  const canonicalPath = path || '/@' + author + '/' + permlink
  const suffix = siteName || ('@' + author + ' on Hive')
  return {
    title: title + ' — ' + suffix,
    description,
    image,
    type: 'article',
    path: canonicalPath,
    origin,
    siteName,
    rss,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      image: [image],
      datePublished: row.created || undefined,
      dateModified: row.last_update || row.created || undefined,
      author: { '@type': 'Person', name: '@' + author, url: 'https://banksia.io/@' + author },
      mainEntityOfPage: { '@type': 'WebPage', '@id': origin + canonicalPath }
    }
  }
}

async function accountMetadata (name) {
  const profile = await rpc('bridge.get_profile', { account: name })
  if (!profile || !profile.name) return null
  const meta = profile.metadata?.profile || profile.profile || {}
  const display = stripMarkdown(meta.name, 80) || name
  const description = stripMarkdown(meta.about, 180) || ('Hive account @' + name + ' on banksia.io.')
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
        url: 'https://banksia.io/@' + name
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

/**
 * Serialise a value for an inline `<script>` block. JSON.stringify leaves `<`
 * untouched, so a chain-controlled string containing `</script>` would close
 * the block and inject a sibling script. Escaping `<` (and the JS line
 * separators) keeps the payload inert while remaining valid JSON.
 */
export function scriptJson (value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Pass the origin response through with an observability tag. */
function tagged (response, value) {
  const copy = new Response(response.body, response)
  copy.headers.set('x-hive-meta', value)
  return copy
}

function blogTenant (url) {
  const resolved = resolveBlogHost(url.hostname)
  return resolved.mode === 'blog' ? resolved : null
}

/**
 * The apex home shell embeds a ~39 KB JSON snapshot of dashboard data. A blog
 * page never uses it, so drop it before the shell reaches a reader.
 */
export function stripHomeSnapshot (html) {
  return String(html || '').replace(
    /<script\b[^>]*\bid=["']?home-snapshot["']?[^>]*>[\s\S]*?<\/script>/i,
    ''
  )
}

function apexTarget (url) {
  return APEX_ORIGIN + url.pathname + url.search
}

/**
 * Blog HTML is always built from the apex `index.html` shell. The SPA router
 * uses the browser URL, so the shell does not need to be the requested path;
 * this avoids apex 404s for `/<permlink>` and lets the origin keep its existing
 * `banksia.io` certificate in strict SSL mode.
 */
async function fetchBlogShell (request) {
  return fetch(APEX_ORIGIN + '/index.html', {
    headers: {
      accept: 'text/html',
      'user-agent': request.headers.get('user-agent') || 'banksia-blog'
    },
    redirect: 'manual'
  })
}

/** Static assets and non-HTML paths are proxied to the apex origin. */
async function fetchApexAsset (request, url) {
  const init = {
    method: request.method,
    headers: request.headers,
    redirect: 'manual'
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body
  return fetch(apexTarget(url), init)
}

async function getAccount (name) {
  const result = await rpc('condenser_api.get_accounts', [[name]])
  return Array.isArray(result) ? result[0] || null : null
}

function blogProfileMeta (profile, name) {
  const meta = profile?.metadata?.profile || profile?.profile || {}
  return {
    display: stripMarkdown(meta.name, 80) || name,
    about: stripMarkdown(meta.about, 180) || '',
    image: proxiedImage(meta.profile_image, 400) || ('https://images.hive.blog/u/' + name + '/avatar'),
    cover: proxiedImage(meta.cover_image, 1200) || ''
  }
}

async function blogMetadata (url, tenant) {
  const [account, profile] = await Promise.all([
    getAccount(tenant.account),
    rpc('bridge.get_profile', { account: tenant.account })
  ])
  if (!account && !profile) return null

  const read = readBlogSettings(account || { name: tenant.account })
  const settings = read.settings
  const profileMeta = blogProfileMeta(profile, tenant.account)
  const origin = 'https://' + url.hostname
  const title = settings.title || profileMeta.display
  const description = settings.description || profileMeta.about || ('Posts by @' + tenant.account + ' on Hive.')
  const image = profileMeta.cover || profileMeta.image
  const claimed = read.claimed
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: title,
    description,
    url: origin + '/',
    author: {
      '@type': 'Person',
      name: '@' + tenant.account,
      url: 'https://banksia.io/@' + tenant.account
    }
  }

  if (path === '/' || path === '') {
    return {
      title: title + ' — Hive blog',
      description,
      image,
      type: 'website',
      path: '/',
      origin,
      siteName: title,
      rss: origin + '/rss.xml',
      noindex: !claimed,
      jsonLd: blogJsonLd
    }
  }

  if (path === '/about' || path === '/contact') {
    const label = path === '/about' ? 'About' : 'Contact'
    return {
      title: label + ' — ' + title,
      description,
      image,
      type: 'website',
      path,
      origin,
      siteName: title,
      rss: origin + '/rss.xml',
      noindex: !claimed,
      jsonLd: {
        ...blogJsonLd,
        '@type': path === '/about' ? 'AboutPage' : 'ContactPage',
        name: label + ' ' + title,
        url: origin + path
      }
    }
  }

  // Post routes: /<permlink> for the owner, /@author/<permlink> for a
  // contributor, and /p/<permlink> as a collision-proof fallback.
  const ownerPost = path.match(/^\/(?:p\/)?([a-z0-9][a-z0-9._-]*)$/i)
  const authorPost = path.match(/^\/@([a-z0-9.-]+)\/([a-z0-9][a-z0-9._-]*)$/i)
  const author = ownerPost ? tenant.account : (authorPost ? authorPost[1] : '')
  const permlink = ownerPost ? ownerPost[1] : (authorPost ? authorPost[2] : '')
  if (!author || !permlink) return null

  const post = await rpc('bridge.get_post', { author, permlink, observer: '' })
  if (!post || !post.author) return null
  const canonicalPath = blogPostPathFor(post.permlink, post.author, tenant.account)
  return postMetadata(post.author, post.permlink, {
    origin,
    path: canonicalPath,
    siteName: title,
    rss: origin + '/rss.xml',
    post
  })
}

async function blogPostRows (tenant, settings, limit = 20) {
  const accounts = [tenant.account, ...(Array.isArray(settings.authors) ? settings.authors : [])]
  const unique = [...new Set(accounts.filter(Boolean))]
  const perAccount = Math.max(1, Math.min(20, Number(limit) || 20))
  const batches = await Promise.allSettled(unique.map(name => rpc('bridge.get_account_posts', {
    sort: 'posts',
    account: name,
    observer: null,
    limit: perAccount,
    start_author: null,
    start_permlink: null
  })))
  return batches
    .filter(batch => batch.status === 'fulfilled' && Array.isArray(batch.value))
    .flatMap(batch => batch.value)
}

async function blogRss (url, tenant) {
  const [account, profile] = await Promise.all([
    getAccount(tenant.account),
    rpc('bridge.get_profile', { account: tenant.account })
  ])
  const read = readBlogSettings(account || { name: tenant.account })
  const settings = read.settings
  const profileMeta = blogProfileMeta(profile, tenant.account)
  const posts = await blogPostRows(tenant, settings)
  const xml = buildBlogRss({
    account: tenant.account,
    title: settings.title || profileMeta.display,
    description: settings.description || profileMeta.about,
    posts,
    baseUrl: 'https://' + url.hostname,
    limit: 20
  })
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=' + CACHE_SECONDS,
      'x-hive-meta': 'blog-rss'
    }
  })
}

async function blogSitemap (url, tenant) {
  const account = await getAccount(tenant.account)
  const read = readBlogSettings(account || { name: tenant.account })
  const posts = blogFeedPosts(await blogPostRows(tenant, read.settings, 20), 20)
  const origin = 'https://' + url.hostname
  const entries = [
    '  <url><loc>' + escapeXml(origin + '/') + '</loc><changefreq>daily</changefreq><priority>1.0</priority></url>',
    '  <url><loc>' + escapeXml(origin + '/about') + '</loc><changefreq>monthly</changefreq></url>',
    '  <url><loc>' + escapeXml(origin + '/contact') + '</loc><changefreq>monthly</changefreq></url>'
  ]
  for (const post of posts) {
    const loc = origin + blogPostPathFor(post.permlink, post.author, tenant.account)
    const lastmod = String(post.created || post.last_update || '').slice(0, 10)
    entries.push('  <url><loc>' + escapeXml(loc) + '</loc>' +
      (lastmod ? '<lastmod>' + escapeXml(lastmod) + '</lastmod>' : '') +
      '<changefreq>monthly</changefreq></url>')
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') + '\n</urlset>\n'
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=' + CACHE_SECONDS,
      'x-hive-meta': 'blog-sitemap'
    }
  })
}

async function blogRobots (url, tenant) {
  const account = await getAccount(tenant.account)
  const read = readBlogSettings(account || { name: tenant.account })
  const origin = 'https://' + url.hostname
  const lines = read.claimed
    ? ['User-agent: *', 'Allow: /', 'Sitemap: ' + origin + '/sitemap.xml', '']
    : ['User-agent: *', 'Disallow: /', '']
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=' + CACHE_SECONDS,
      'x-hive-meta': 'blog-robots'
    }
  })
}

async function handleBlog (request, tenant) {
  const url = new URL(request.url)
  if (request.method !== 'GET' && request.method !== 'HEAD') return fetchApexAsset(request, url)
  if (url.pathname === '/rss.xml' || url.pathname === '/rss') {
    return blogRss(url, tenant).catch(() => fetchApexAsset(request, url))
  }
  if (url.pathname === '/sitemap.xml') {
    return blogSitemap(url, tenant).catch(() => fetchApexAsset(request, url))
  }
  if (url.pathname === '/robots.txt') {
    return blogRobots(url, tenant).catch(() => fetchApexAsset(request, url))
  }
  // Assets are shared with the main app and never need metadata.
  if (/^\/(?:assets|statics)\//.test(url.pathname) || /\.(?:js|mjs|css|map|json|txt|xml|webmanifest|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|mp4|webm|pdf)$/i.test(url.pathname)) {
    return fetchApexAsset(request, url)
  }

  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(url.toString(), request)
  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  const originResponse = await fetchBlogShell(request)
  if (!originResponse.ok || !(originResponse.headers.get('content-type') || '').includes('text/html')) {
    return originResponse
  }
  const fallback = originResponse.clone()

  try {
    const meta = await blogMetadata(url, tenant)
    if (!meta) return tagged(fallback, 'blog-miss')
    const html = rewriteHead(stripHomeSnapshot(await originResponse.text()), meta)
    const headers = new Headers(originResponse.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    headers.delete('etag')
    headers.delete('last-modified')
    const out = new Response(html, { status: 200, headers })
    out.headers.set('content-type', 'text/html; charset=utf-8')
    out.headers.set('cache-control', 'public, max-age=' + CACHE_SECONDS)
    out.headers.set('x-hive-meta', 'blog')
    if (cache) await cache.put(cacheKey, out.clone())
    return out
  } catch {
    return tagged(fallback, 'blog-error')
  }
}

export function rewriteHead (html, meta) {
  let next = html
  const origin = meta.origin || 'https://banksia.io'
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
  setMeta('property', 'og:url', origin + meta.path)
  setMeta('property', 'og:type', meta.type)
  if (meta.siteName) setMeta('property', 'og:site_name', meta.siteName)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  setMeta('name', 'twitter:image', meta.image)
  if (meta.rss) {
    next = next.replace(/<link\b[^>]*type=["']?application\/rss\+xml["']?[^>]*>/gi, '')
    next = next.replace('</head>', '<link rel="alternate" type="application/rss+xml" title="' + escapeHtml((meta.siteName || 'Blog') + ' RSS') + '" href="' + escapeHtml(meta.rss) + '">\n  </head>')
  }
  if (meta.noindex) {
    setMeta('name', 'robots', 'noindex, follow')
    next = next.replace(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i, '')
  } else {
    next = next.replace(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i, '<link rel="canonical" href="' + escapeHtml(origin + meta.path) + '">')
  }
  next = next.replace(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>[\s\S]*?<\/script>/gi, '')
  if (meta.jsonLd) {
    next = next.replace('</head>', '<script type="application/ld+json">' + scriptJson(meta.jsonLd) + '</script>\n  </head>')
  }
  // Replace the static crawler shell heading and summary as well.
  next = next.replace(/(<main\b[^>]*data-seo-shell[^>]*>[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/i, '$1' + title + '$2')
  next = next.replace(/(<main\b[^>]*data-seo-shell[^>]*>[\s\S]*?<\/h1><p>)[\s\S]*?(<\/p>)/i, '$1' + escapeHtml(meta.description) + '$2')
  return next
}

async function lightningShell (request, account = '') {
  const url = new URL(request.url)
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request('https://banksia.io/lightning.html?account=' + encodeURIComponent(account), { method: 'GET' })
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
      title: '@' + account + ' Lightning — banksia.io',
      description: 'Receive sats as HIVE or HBD, or pay a Lightning invoice with Hive for @' + account + '.',
      image: 'https://images.hive.blog/u/' + account + '/avatar',
      type: 'website',
      path: '/@' + account + '/lightning',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '@' + account + ' Lightning',
        url: 'https://banksia.io/@' + account + '/lightning'
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

const CSP_REPORT_LIMIT = 8192

function clip (value, max) {
  return typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').slice(0, max) : ''
}

/**
 * Accept CSP violation reports. Legacy `report-uri` posts a single
 * `application/csp-report` object; `report-to` posts a
 * `application/reports+json` array. Only a compact, whitespace-collapsed line
 * is logged so `wrangler tail` output stays readable and cannot be forged into
 * multi-line entries.
 */
export async function handleCspReport (request) {
  const headers = { 'x-hive-meta': 'csp-report' }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } })
  }

  const type = (request.headers.get('content-type') || '').toLowerCase()
  if (!type.includes('application/csp-report') && !type.includes('application/reports+json')) {
    return new Response(null, { status: 415, headers })
  }

  let text
  try {
    text = await request.text()
  } catch {
    return new Response(null, { status: 400, headers })
  }
  if (text.length > CSP_REPORT_LIMIT) {
    return new Response(null, { status: 413, headers })
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400, headers })
  }

  const reports = Array.isArray(payload) ? payload : [payload]
  for (const report of reports.slice(0, 5)) {
    const body = report && typeof report === 'object' ? (report['csp-report'] || report.body || report) : {}
    console.log(JSON.stringify({
      type: 'csp-report',
      directive: clip(body['violated-directive'] || body.effectiveDirective, 200),
      blocked: clip(body['blocked-uri'] || body.blockedURL, 300),
      document: clip(body['document-uri'] || body.documentURL, 300),
      referrer: clip(body.referrer, 300),
      sample: clip(body['script-sample'] || body.sample, 200),
      disposition: clip(body.disposition, 30)
    }))
  }

  return new Response(null, { status: 204, headers })
}

export default {
  async fetch (request) {
    const url = new URL(request.url)
    if (url.pathname === '/csp-report' || url.pathname.startsWith('/csp-report/')) {
      return handleCspReport(request)
    }

    // Account blogs are served from the same build on a first-level subdomain.
    // This runs before the apex metadata rules so a blog host never falls
    // through to the explorer's account/post shells.
    const tenant = blogTenant(url)
    if (tenant) return handleBlog(request, tenant)

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
