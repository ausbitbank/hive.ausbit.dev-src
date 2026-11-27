import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../deploy/cloudflare/metadata-worker.mjs'

const ORIGIN_HTML = [
  '<!doctype html><html><head>',
  '<title>Banksia</title>',
  '<meta name="description" content="A Hive explorer.">',
  '<link rel="canonical" href="https://banksia.io/">',
  '</head><body><main data-seo-shell><h1>Banksia</h1><p>A Hive explorer.</p></main></body></html>'
].join('')

const ACCOUNT = {
  name: 'alice',
  posting_json_metadata: JSON.stringify({
    profile: { name: 'Alice', about: 'Writer and photographer.' },
    'banksia.io': {
      blog: {
        version: 1,
        claimed: true,
        title: 'Alice writes',
        description: 'Notes from the garden.'
      }
    }
  })
}

const UNCLAIMED_ACCOUNT = {
  name: 'alice',
  posting_json_metadata: JSON.stringify({ profile: { name: 'Alice', about: 'Writer.' } })
}

const PROFILE = {
  name: 'alice',
  metadata: {
    profile: {
      name: 'Alice',
      about: 'Writer and photographer.',
      profile_image: 'https://images.hive.blog/u/alice/avatar'
    }
  }
}

const POST = {
  author: 'alice',
  permlink: 'a-post',
  title: 'A real post',
  body: 'The body of a real post.',
  created: '2026-11-20T10:00:00',
  last_update: '2026-11-20T10:00:00',
  json_metadata: JSON.stringify({ image: ['https://images.hive.blog/cover.png'], tags: ['hive-123456', 'notes'] })
}

function jsonResponse (result) {
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function stubNetwork ({ account = ACCOUNT, profile = PROFILE, post = POST, posts = [POST], originHtml = ORIGIN_HTML } = {}) {
  const methods = []
  const urls = []
  vi.stubGlobal('fetch', vi.fn(async (input, init = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body)
      methods.push(body.method)
      return jsonResponse(
        body.method === 'condenser_api.get_accounts'
          ? [account]
          : body.method === 'bridge.get_profile'
            ? profile
            : body.method === 'bridge.get_post'
              ? post
              : body.method === 'bridge.get_account_posts'
                ? posts
                : null
      )
    }
    methods.push('origin')
    urls.push(typeof input === 'string' ? input : input.url)
    return new Response(originHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  }))
  methods.urls = urls
  return methods
}

function blogRequest (path, { host = 'alice.banksia.io', userAgent = 'Twitterbot/1.0', accept = '*/*' } = {}) {
  return new Request('https://' + host + path, {
    headers: { accept, 'user-agent': userAgent }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('blog host metadata', () => {
  it('describes the blog root from on-chain settings', async () => {
    const methods = stubNetwork()
    const response = await worker.fetch(blogRequest('/'))
    const html = await response.text()

    expect(response.headers.get('x-hive-meta')).toBe('blog')
    expect(html).toContain('<title>Alice writes — Hive blog</title>')
    expect(html).toContain('<link rel="canonical" href="https://alice.banksia.io/">')
    expect(html).toContain('property="og:url" content="https://alice.banksia.io/"')
    expect(html).toContain('property="og:site_name" content="Alice writes"')
    expect(html).toContain('rel="alternate" type="application/rss+xml"')
    expect(html).toContain('href="https://alice.banksia.io/rss.xml"')
    expect(methods).toContain('condenser_api.get_accounts')
    expect(methods).toContain('bridge.get_profile')
  })

  it('gives a post its own canonical blog URL', async () => {
    const methods = stubNetwork()
    const response = await worker.fetch(blogRequest('/a-post'))
    const html = await response.text()

    expect(html).toContain('<title>A real post — Alice writes</title>')
    expect(html).toContain('<link rel="canonical" href="https://alice.banksia.io/a-post">')
    expect(html).toContain('https://images.hive.blog/800x0/https://images.hive.blog/cover.png')
    expect(methods.urls).toContain('https://banksia.io/index.html')
  })

  it('serves blog metadata when the client does not advertise HTML', async () => {
    stubNetwork()
    const response = await worker.fetch(blogRequest('/', { userAgent: 'curl/8.0', accept: '*/*' }))
    const html = await response.text()

    expect(response.headers.get('x-hive-meta')).toBe('blog')
    expect(html).toContain('<title>Alice writes — Hive blog</title>')
  })

  it('keeps a contributor post on the author path', async () => {
    stubNetwork({ post: { ...POST, author: 'bob' } })
    const response = await worker.fetch(blogRequest('/@bob/a-post'))
    const html = await response.text()

    expect(html).toContain('<link rel="canonical" href="https://alice.banksia.io/@bob/a-post">')
  })

  it('canonicalises a reserved permlink to the /p/ fallback', async () => {
    stubNetwork({ post: { ...POST, permlink: 'about' } })
    const response = await worker.fetch(blogRequest('/p/about'))
    const html = await response.text()

    expect(html).toContain('<link rel="canonical" href="https://alice.banksia.io/p/about">')
  })

  it('serves an RSS feed for the blog', async () => {
    stubNetwork()
    const response = await worker.fetch(blogRequest('/rss.xml'))
    const xml = await response.text()

    expect(response.headers.get('content-type')).toContain('application/rss+xml')
    expect(response.headers.get('x-hive-meta')).toBe('blog-rss')
    expect(xml).toContain('<title>Alice writes</title>')
    expect(xml).toContain('<link>https://alice.banksia.io/a-post</link>')
    expect(xml).toContain('<category>notes</category>')
  })

  it('serves a sitemap for the blog', async () => {
    stubNetwork()
    const response = await worker.fetch(blogRequest('/sitemap.xml'))
    const xml = await response.text()

    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(response.headers.get('x-hive-meta')).toBe('blog-sitemap')
    expect(xml).toContain('<loc>https://alice.banksia.io/</loc>')
    expect(xml).toContain('<loc>https://alice.banksia.io/about</loc>')
    expect(xml).toContain('<loc>https://alice.banksia.io/a-post</loc>')
  })

  it('allows crawlers and points to the sitemap for a claimed blog', async () => {
    stubNetwork()
    const response = await worker.fetch(blogRequest('/robots.txt'))
    const text = await response.text()

    expect(response.headers.get('x-hive-meta')).toBe('blog-robots')
    expect(text).toContain('Allow: /')
    expect(text).toContain('Sitemap: https://alice.banksia.io/sitemap.xml')
  })

  it('disallows crawlers on an unclaimed preview', async () => {
    stubNetwork({ account: UNCLAIMED_ACCOUNT })
    const response = await worker.fetch(blogRequest('/robots.txt'))
    const text = await response.text()

    expect(text).toContain('Disallow: /')
    expect(text).not.toContain('Sitemap:')
  })

  it('marks an unclaimed preview noindex and drops its canonical', async () => {
    stubNetwork({ account: UNCLAIMED_ACCOUNT })
    const response = await worker.fetch(blogRequest('/'))
    const html = await response.text()

    expect(html).toContain('name="robots" content="noindex, follow"')
    expect(html).not.toContain('rel="canonical"')
    expect(html).toContain('<title>Alice — Hive blog</title>')
  })

  it('drops the apex dashboard snapshot from the blog shell', async () => {
    const originHtml = ORIGIN_HTML.replace(
      '</head>',
      '<script type="application/json" id="home-snapshot">{"big":"payload"}</script></head>'
    )
    stubNetwork({ originHtml })
    const response = await worker.fetch(blogRequest('/'))
    const html = await response.text()

    expect(html).not.toContain('home-snapshot')
    expect(html).not.toContain('payload')
  })

  it('leaves reserved hosts and assets on the normal path', async () => {
    const methods = stubNetwork()
    const reserved = await worker.fetch(blogRequest('/', { host: 'files.banksia.io', userAgent: 'SomeScript/1.0' }))
    expect(reserved.headers.get('x-hive-meta')).toBeNull()
    expect([...methods]).toEqual(['origin'])

    methods.length = 0
    const asset = await worker.fetch(blogRequest('/assets/app.js', { userAgent: 'Mozilla/5.0' }))
    expect(asset.status).toBe(200)
    expect([...methods]).toEqual(['origin'])
  })
})
