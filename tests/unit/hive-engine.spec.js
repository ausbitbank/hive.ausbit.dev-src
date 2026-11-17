import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { localStorageGetItem } = vi.hoisted(() => ({
  localStorageGetItem: vi.fn()
}))

vi.mock('quasar', () => ({
  LocalStorage: {
    getItem: localStorageGetItem
  }
}))

const NODE = 'https://he.example/'
const PRIMARY_URL = 'https://he.example/contracts'
const FIRST_FALLBACK_URL = 'https://api.hive-engine.com/rpc/contracts'

function jsonResponse (json) {
  return {
    ok: true,
    status: 200,
    json: async () => json
  }
}

async function loadEngine () {
  const { getHiveEngine } = await import('../../src/services/hiveEngine')
  return getHiveEngine()
}

describe('hiveEngine client', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    // The client is cached at module scope, so each test needs a fresh module.
    vi.resetModules()
    localStorageGetItem.mockReset()
    localStorageGetItem.mockReturnValue({ heApiNode: NODE })

    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('posts a JSON-RPC find request to <node>/contracts and returns the result array', async () => {
    const result = [{ _id: 1, symbol: 'HIVE' }, { _id: 2, symbol: 'HBD' }]
    fetchMock.mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1, result }))

    const client = await loadEngine()
    const found = await client.find(
      'tokens',
      'tokens',
      { symbol: 'HIVE' },
      10,
      2,
      [{ index: 'symbol', descending: false }]
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]

    expect(url).toBe(PRIMARY_URL)
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(options.signal).toBeDefined()
    expect(JSON.parse(options.body)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'find',
      params: {
        contract: 'tokens',
        table: 'tokens',
        query: { symbol: 'HIVE' },
        limit: 10,
        offset: 2,
        indexes: [{ index: 'symbol', descending: false }]
      }
    })
    expect(found).toEqual(result)
  })

  it('returns an empty array when the JSON-RPC result is not an array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, result: { not: 'an array' } })
    )

    const client = await loadEngine()

    await expect(client.find('tokens', 'tokens', {})).resolves.toEqual([])

    fetchMock.mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1 }))

    await expect(client.find('tokens', 'tokens', {})).resolves.toEqual([])
  })

  it('rejects when the JSON-RPC response contains an error', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32600, message: 'boom' }
      })
    )

    const client = await loadEngine()
    const promise = client.find('tokens', 'tokens', {})
    const rejection = expect(promise).rejects.toThrow('boom')

    // The transport retries every configured host before surfacing the error.
    await vi.runAllTimersAsync()
    await rejection

    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('falls back to the next host when the first host fails', async () => {
    vi.useFakeTimers()
    const result = [{ _id: 1, symbol: 'HIVE' }]
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result }))

    const client = await loadEngine()
    const promise = client.find('tokens', 'tokens', {})

    // Flushes the 250ms retry delay without waiting in real time.
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual(result)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(PRIMARY_URL)
    expect(fetchMock.mock.calls[1][0]).toBe(FIRST_FALLBACK_URL)
  })
})
