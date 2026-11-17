import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HiveApiError,
  apiGetAccounts,
  configureApi,
  getApiNode,
  resetApiClient,
  rpcRequest
} from '../../src/services/api'

function jsonResponse (result) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, result })
  }
}

describe('central Hive API client', () => {
  beforeEach(() => {
    resetApiClient({ nodes: ['https://a.example'], retries: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends JSON-RPC requests and records the healthy node', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ name: 'alice' }]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiGetAccounts(['alice'])

    expect(result).toEqual([{ name: 'alice' }])
    expect(fetchMock).toHaveBeenCalledWith('https://a.example', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [['alice']]
    })
    expect(getApiNode()).toBe('https://a.example')
  })

  it('fails over to the next node after a transport error', async () => {
    configureApi({ nodes: ['https://a.example', 'https://b.example'], retries: 1 })
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse('ok'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await rpcRequest('condenser_api.get_dynamic_global_properties')

    expect(result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('https://a.example')
    expect(fetchMock.mock.calls[1][0]).toBe('https://b.example')
    expect(getApiNode()).toBe('https://b.example')
  })

  it('surfaces RPC errors as HiveApiError with code and attempts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: -32000, message: 'boom' } })
    }))

    const error = await rpcRequest('condenser_api.get_ticker').catch(value => value)

    expect(error).toBeInstanceOf(HiveApiError)
    expect(error.message).toBe('boom')
    expect(error.code).toBe(-32000)
    expect(error.attempts).toBe(1)
  })

  it('times out an unresponsive node', async () => {
    configureApi({ nodes: ['https://slow.example'], timeoutMs: 10, retries: 0 })
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })))

    const error = await rpcRequest('condenser_api.get_ticker').catch(value => value)

    expect(error).toBeInstanceOf(HiveApiError)
    expect(error.message).toContain('timed out')
  })

  it('honours an external cancellation signal', async () => {
    const controller = new AbortController()
    controller.abort()

    const error = await rpcRequest('condenser_api.get_ticker', [], { signal: controller.signal })
      .catch(value => value)

    expect(error.name).toBe('AbortError')
  })
})
