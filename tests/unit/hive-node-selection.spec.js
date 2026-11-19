import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hiveMock } = vi.hoisted(() => ({
  hiveMock: {
    config: { set: vi.fn() },
    api: {
      setOptions: vi.fn(),
      getDynamicGlobalPropertiesAsync: vi.fn(),
      getAccountsAsync: vi.fn()
    }
  }
}))

vi.mock('@hiveio/hive-js', () => ({
  default: hiveMock
}))

vi.mock('../../src/services/hiveNodes', () => ({
  DEFAULT_HIVE_NODE: 'https://api.hive.blog',
  HIVE_API_NODES: [
    'https://api.hive.blog',
    'https://node-a.example',
    'https://node-b.example'
  ]
}))

import { probeHiveNode, probeHiveNodeFull, probeHiveNodeVersion, selectHiveNode } from '../../src/services/hive'

const CONFIGURED = 'https://configured.example'

function okResponse (head) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: { head_block_number: head } })
  }
}

function httpError (status) {
  return {
    ok: false,
    status,
    json: async () => ({})
  }
}

function delayed (ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

function deferred () {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('probeHiveNode', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    hiveMock.config.set.mockClear()
    hiveMock.api.setOptions.mockClear()
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('returns ok with the head block on a healthy node', async () => {
    fetchMock.mockResolvedValue(okResponse(123456))

    const result = await probeHiveNode('https://node-a.example')

    expect(result).toEqual({
      url: 'https://node-a.example',
      ok: true,
      latency: expect.any(Number),
      head: 123456,
      rpcMs: null,
      headTime: null,
      serverVersion: null
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://node-a.example',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: expect.any(AbortSignal)
      })
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.method).toBe('condenser_api.get_dynamic_global_properties')
    expect(body.params).toEqual([])
  })

  it('returns ok false for a non-OK HTTP response', async () => {
    fetchMock.mockResolvedValue(httpError(503))

    const result = await probeHiveNode('https://node-a.example')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('HTTP 503')
    expect(result.latency).toEqual(expect.any(Number))
  })

  it('returns ok false when the head block is missing or invalid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { head_block_number: 'not-a-number' } })
    })

    await expect(probeHiveNode('https://node-a.example')).resolves.toMatchObject({
      ok: false,
      error: 'Invalid response'
    })

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { head_block_number: 0 } })
    })

    await expect(probeHiveNode('https://node-a.example')).resolves.toMatchObject({
      ok: false
    })
  })

  it('aborts and returns ok false when the probe times out', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))

    const promise = probeHiveNode('https://slow.example', 50)
    await vi.advanceTimersByTimeAsync(50)

    await expect(promise).resolves.toMatchObject({
      ok: false,
      error: 'Timed out'
    })
  })

  it('returns ok false without fetching when no URL is supplied', async () => {
    await expect(probeHiveNode('')).resolves.toMatchObject({
      ok: false,
      error: 'No node URL'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('captures head time, server version and RPC fields when reported', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          head_block_number: 123456,
          time: '2026-11-19T00:04:36',
          server_version: '1.28.8',
          server_latency: 7
        }
      })
    })

    await expect(probeHiveNode('https://node-a.example')).resolves.toMatchObject({
      ok: true,
      head: 123456,
      headTime: '2026-11-19T00:04:36',
      serverVersion: '1.28.8',
      rpcMs: 7
    })
  })
})

describe('probeHiveNodeVersion', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  function versionResponse (result) {
    return { ok: true, status: 200, json: async () => ({ result }) }
  }

  it('reports the blockchain version, chain id and node type', async () => {
    fetchMock.mockResolvedValue(versionResponse({
      blockchain_version: '1.28.8',
      chain_id: 'beeab0de'.padEnd(64, '0'),
      node_type: 'mainnet'
    }))

    await expect(probeHiveNodeVersion('https://node-a.example')).resolves.toMatchObject({
      ok: true,
      version: '1.28.8',
      nodeType: 'mainnet'
    })
  })

  it('flags a missing get_version method without marking the node broken', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: -32601, message: 'Method not found' } })
    })

    await expect(probeHiveNodeVersion('https://node-a.example')).resolves.toMatchObject({
      ok: false,
      missing: true
    })
  })

  it('carries nodeType through probeHiveNodeFull', async () => {
    fetchMock.mockImplementation((_url, { body }) => {
      const parsed = JSON.parse(body)
      if (parsed.method === 'condenser_api.get_version') {
        return Promise.resolve(versionResponse({ blockchain_version: '1.28.8', node_type: 'mainnet' }))
      }
      return Promise.resolve(okResponse(100))
    })

    await expect(probeHiveNodeFull('https://node-a.example')).resolves.toMatchObject({
      ok: true,
      head: 100,
      version: '1.28.8',
      nodeType: 'mainnet'
    })
  })
})

describe('selectHiveNode', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('keeps a healthy configured node even when a fallback responds faster', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(url => {
      if (url === CONFIGURED) return delayed(1000, okResponse(100))
      return Promise.resolve(okResponse(200))
    })

    const promise = selectHiveNode(CONFIGURED)
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe(CONFIGURED)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('returns the fastest healthy fallback when the configured node fails', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(url => {
      if (url === CONFIGURED) return Promise.resolve(httpError(500))
      if (url === 'https://api.hive.blog') return Promise.resolve(httpError(500))
      if (url === 'https://node-a.example') return delayed(300, okResponse(200))
      if (url === 'https://node-b.example') return delayed(100, okResponse(150))
      return Promise.resolve(httpError(500))
    })

    const promise = selectHiveNode(CONFIGURED)
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe('https://node-b.example')
  })

  it('returns the configured node when every probe fails', async () => {
    fetchMock.mockResolvedValue(httpError(500))

    await expect(selectHiveNode(CONFIGURED)).resolves.toBe(CONFIGURED)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('keeps a configured node that answers without a readable head', async () => {
    // Responses without `head_block_number` (e.g. a request intercept in the
    // browser) still prove the node is reachable, so switching away would only
    // rewrite the client mid-flight.
    fetchMock.mockImplementation(url => {
      if (url === CONFIGURED) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }) })
      }
      return Promise.resolve(okResponse(200))
    })

    await expect(selectHiveNode(CONFIGURED)).resolves.toBe(CONFIGURED)
  })

  it('launches every probe in parallel before awaiting any response', async () => {
    const pending = new Map()
    fetchMock.mockImplementation(url => {
      const entry = deferred()
      pending.set(url, entry)
      return entry.promise
    })

    const promise = selectHiveNode(CONFIGURED)

    // All candidates are requested synchronously, before any response resolves.
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      CONFIGURED,
      'https://api.hive.blog',
      'https://node-a.example',
      'https://node-b.example'
    ])
    expect(pending.size).toBe(4)

    let settled = false
    promise.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    for (const entry of pending.values()) entry.resolve(okResponse(100))

    await expect(promise).resolves.toBe(CONFIGURED)
  })
})
