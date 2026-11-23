import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../deploy/cloudflare/metadata-worker.mjs'

const ORIGIN_HTML = [
  '<!doctype html><html><head>',
  '<title>@alice: a-post — Hive post</title>',
  '<meta name="description" content="Hive post by @alice: a-post.">',
  '<meta name="twitter:title" content="@alice: a-post — Hive post">',
  '<meta name="twitter:image" content="https://images.hive.blog/u/alice/avatar">',
  '<link rel="canonical" href="https://hive.ausbit.dev/@alice/a-post">',
  '</head><body><main data-seo-shell><h1>@alice: a-post</h1><p>Hive post</p></main></body></html>'
].join('')

const POST = {
  author: 'alice',
  permlink: 'a-post',
  title: 'A real post title',
  body: 'The body of a real post.',
  created: '2026-11-23T10:00:00',
  last_update: '2026-11-23T10:00:00',
  json_metadata: JSON.stringify({ image: ['https://images.hive.blog/cover.png'] })
}

function previewRequest (userAgent, accept = '*/*') {
  return new Request('https://hive.ausbit.dev/@alice/a-post', {
    method: 'GET',
    headers: { accept, 'user-agent': userAgent }
  })
}

function stubNetwork () {
  const calls = { rpc: 0, origin: 0 }
  vi.stubGlobal('fetch', vi.fn(async (input, init = {}) => {
    if (init.method === 'POST') {
      calls.rpc += 1
      return new Response(JSON.stringify({ result: POST }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    calls.origin += 1
    return new Response(ORIGIN_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  }))
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('metadata worker', () => {
  it('rewrites metadata for X/Twitter, whose crawler does not ask for text/html', async () => {
    const calls = stubNetwork()
    const response = await worker.fetch(previewRequest('Twitterbot/1.0'))
    const html = await response.text()

    expect(response.headers.get('x-hive-meta')).toBe('hit')
    expect(calls.rpc).toBe(1)
    expect(html).toContain('A real post title')
    expect(html).toContain('<meta name="twitter:image" content="https://images.hive.blog/800x0/https://images.hive.blog/cover.png">')
  })

  it('leaves a non-preview client without text/html on the origin response', async () => {
    const calls = stubNetwork()
    const response = await worker.fetch(previewRequest('SomeScript/1.0'))
    const html = await response.text()

    expect(response.headers.get('x-hive-meta')).toBeNull()
    expect(calls.rpc).toBe(0)
    expect(html).toBe(ORIGIN_HTML)
  })

  it('handles Fediverse preview fetchers that do not send text/html either', async () => {
    const calls = stubNetwork()
    const response = await worker.fetch(previewRequest('http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)'))
    const html = await response.text()

    expect(response.headers.get('x-hive-meta')).toBe('hit')
    expect(calls.rpc).toBe(1)
    expect(html).toContain('A real post title')
  })
})
