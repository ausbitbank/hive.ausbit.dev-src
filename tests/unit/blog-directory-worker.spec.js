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

  it('prunes a stale opted-out entry when the public list is read', async () => {
    const env = fakeEnv()
    await env.BLOGS.put('blog:alice', JSON.stringify({
      account: 'alice',
      updatedAt: '2020-01-01T00:00:00.000Z'
    }))
    stubAccount(DISABLED)

    const response = await worker.fetch(api('/api/blogs'), env)
    expect(await response.json()).toMatchObject({ accounts: [], configured: true })
    expect(env.BLOGS._store.has('blog:alice')).toBe(false)
  })

  it('rejects an invalid account', async () => {
    const response = await worker.fetch(api('/api/blogs/register', { account: 'not a name' }), fakeEnv())
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ listed: false })
  })
})
