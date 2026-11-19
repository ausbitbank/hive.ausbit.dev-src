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

const HIVE_RPC = 'https://api.hive.blog'
const FETCH_TIMEOUT_MS = 2500
const CACHE_SECONDS = 300

const POST_PATH = /^\/@([a-z0-9.-]+)\/([a-z0-9][a-z0-9._-]*)\/?$/i
const ACCOUNT_PATH = /^\/@([a-z0-9.-]+)\/?$/i

function hasHtml (request) {
  const accept = request.headers.get('accept') || ''
  return request.method === 'GET' && accept.includes('text/html')
}

async function rpc (method, params) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(HIVE_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    })
    if (!response.ok) return null
    const json = await response.json()
    return json && json.result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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

export default {
  async fetch (request) {
    if (!hasHtml(request)) return fetch(request)

    const url = new URL(request.url)
    const post = url.pathname.match(POST_PATH)
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

    try {
      const meta = post
        ? await postMetadata(post[1], post[2])
        : await accountMetadata(account[1])
      if (!meta) return originResponse

      const html = rewriteHead(await originResponse.text(), meta)
      const response = new Response(html, {
        status: originResponse.status,
        headers: originResponse.headers
      })
      response.headers.set('content-type', 'text/html; charset=utf-8')
      response.headers.set('cache-control', 'public, max-age=' + CACHE_SECONDS)
      if (cache) await cache.put(cacheKey, response.clone())
      return response
    } catch {
      return originResponse
    }
  }
}
