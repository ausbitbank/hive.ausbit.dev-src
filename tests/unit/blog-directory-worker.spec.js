import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../deploy/cloudflare/metadata-worker.mjs'

function metadata (directory) {
  return JSON.stringify({
    'banksia.io': {
      blog: {
        version: 1,
        claimed: true,
        title: 'Alice writes',
        directory
      }
    }
  })
}

const ACCOUNT = { name: 'alice', posting_json_metadata: metadata(true), json_metadata: '' }
const DISABLED = { name: 'alice', posting_json_metadata: metadata(false), json_metadata: '' }

function stubAccount (account = ACCOUNT) {
  vi.stubGlobal('fetch', vi.fn(async (input, init = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body)
      const result = body.method === 'condenser_api.get_accounts' ? [account] : null
      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    return new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' }
    })
  }))
}

function fakeEnv () {
  const store = new Map()
  return {
    BLOGS: {
      list: async ({ prefix = '' } = {}) => ({
        keys: [...store.keys()]
          .filter(key => key.startsWith(prefix))
          .map(name => ({ name }))
      }),
      put: async (key, value) => { store.set(key, String(value)) },
      get: async key => (store.has(key) ? store.get(key) : null),
      delete: async key => { store.delete(key) },
      _store: store
    }
  }
}

function api (path, body) {
  if (body === undefined) return new Request('https://banksia.io' + path)
  return new Request('https://banksia.io' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('blog directory API', () => {
  it('reports an unconfigured index instead of failing', async () => {
    const response = await worker.fetch(api('/api/blogs'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accounts: [], configured: false })
  })

  it('lists and registers an opted-in blog', async () => {
    stubAccount(ACCOUNT)
    const env = fakeEnv()

    const register = await worker.fetch(api('/api/blogs/register', { account: 'alice' }), env)
    expect(register.status).toBe(200)
    expect(await register.json()).toMatchObject({ listed: true })
    expect(env.BLOGS._store.has('blog:alice')).toBe(true)

    const list = await worker.fetch(api('/api/blogs'), env)
    expect(list.headers.get('x-hive-meta')).toBe('blog-directory')
    expect(await list.json()).toMatchObject({ accounts: ['alice'], configured: true })
  })

  it('removes a blog that opts out', async () => {
    const env = fakeEnv()
    await env.BLOGS.put('blog:alice', '{}')
    stubAccount(DISABLED)

    const response = await worker.fetch(api('/api/blogs/register', { account: 'alice' }), env)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ listed: false })
    expect(env.BLOGS._store.has('blog:alice')).toBe(false)
  })

  it('prunes an opted-out entry older than the re-verify window', async () => {
    const env = fakeEnv()
    await env.BLOGS.put('blog:alice', JSON.stringify({
      account: 'alice',
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString()
    }))
    stubAccount(DISABLED)

    const response = await worker.fetch(api('/api/blogs'), env)
    expect(await response.json()).toMatchObject({ accounts: [], configured: true })
    expect(env.BLOGS._store.has('blog:alice')).toBe(false)
  })

  it('refreshes a stale opted-in entry instead of deleting it', async () => {
    const env = fakeEnv()
    const old = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    await env.BLOGS.put('blog:alice', JSON.stringify({ account: 'alice', updatedAt: old }))
    stubAccount(ACCOUNT)

    const response = await worker.fetch(api('/api/blogs'), env)
    expect(await response.json()).toMatchObject({ accounts: ['alice'], configured: true })
    const stored = JSON.parse(env.BLOGS._store.get('blog:alice'))
    expect(Date.parse(stored.updatedAt)).toBeGreaterThan(Date.parse(old))
  })

  it('does not re-verify a fresh entry', async () => {
    const env = fakeEnv()
    await env.BLOGS.put('blog:alice', JSON.stringify({
      account: 'alice',
      updatedAt: new Date().toISOString()
    }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(api('/api/blogs'), env)
    expect(await response.json()).toMatchObject({ accounts: ['alice'] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the entry when every chain node fails', async () => {
    const env = fakeEnv()
    await env.BLOGS.put('blog:alice', JSON.stringify({
      account: 'alice',
      updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString()
    }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ result: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })))

    const response = await worker.fetch(api('/api/blogs'), env)
    expect(await response.json()).toMatchObject({ accounts: ['alice'], configured: true })
    expect(env.BLOGS._store.has('blog:alice')).toBe(true)

    const register = await worker.fetch(api('/api/blogs/register', { account: 'alice' }), env)
    expect(register.status).toBe(503)
    expect(env.BLOGS._store.has('blog:alice')).toBe(true)
  })

  it('verifies stale entries with bounded concurrency', async () => {
    const env = fakeEnv()
    const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    const accounts = Array.from({ length: 12 }, (_, index) => 'alice' + index)
    for (const account of accounts) {
      await env.BLOGS.put('blog:' + account, JSON.stringify({ account, updatedAt: stale }))
    }
    let inFlight = 0
    let maxInFlight = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 5))
      inFlight -= 1
      return new Response(JSON.stringify({ result: [ACCOUNT] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }))

    const response = await worker.fetch(api('/api/blogs'), env)
    expect((await response.json()).accounts.sort()).toEqual(accounts.sort())
    expect(maxInFlight).toBeLessThanOrEqual(5)
  })

  it('rejects an invalid account', async () => {
    const response = await worker.fetch(api('/api/blogs/register', { account: 'not a name' }), fakeEnv())
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ listed: false })
  })
})
