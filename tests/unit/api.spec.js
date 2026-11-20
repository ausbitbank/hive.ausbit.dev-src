import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HiveApiError,
  apiGetAccountHistory,
  apiGetAccounts,
  configureApi,
  getApiNode,
  getApiNodeHealth,
  resetApiClient,
  rpcRequest
} from '../../src/services/api'
import { getTelemetrySnapshot, resetTelemetry } from '../../src/services/telemetry'

function jsonResponse (result) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, result })
  }
}

describe('central Hive API client', () => {
  beforeEach(() => {
    resetApiClient({ nodes: ['https://a.example'], retries: 0, retryDelayMs: 0 })
    resetTelemetry()
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

  it('forwards an explicit cache mode to fetch for live reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await apiGetAccountHistory('alice', -1, 50, { cache: 'no-store' })

    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store')
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

  it('records attempts, retries, failovers and node cooldowns', async () => {
    configureApi({ nodes: ['https://a.example', 'https://b.example'], retries: 1, retryDelayMs: 0 })
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse('ok'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(rpcRequest('condenser_api.get_ticker')).resolves.toBe('ok')

    const snapshot = getTelemetrySnapshot()
    expect(snapshot.requests).toMatchObject({ total: 1, successes: 1, failures: 0 })
    expect(snapshot.attempts).toMatchObject({ total: 2, retries: 1, failovers: 1 })
    expect(snapshot.recent.some(event => event.type === 'failover')).toBe(true)

    const health = getApiNodeHealth()
    expect(health.find(node => node.url === 'https://a.example')).toMatchObject({
      coolingDown: true,
      consecutiveFailures: 1
    })
    expect(health.find(node => node.url === 'https://b.example')).toMatchObject({
      active: true,
      consecutiveFailures: 0
    })
  })

  it('never retries beyond the available node list', async () => {
    configureApi({ nodes: ['https://only.example'], retries: 9, retryDelayMs: 0 })
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', fetchMock)

    const error = await rpcRequest('condenser_api.get_ticker').catch(value => value)

    expect(error).toBeInstanceOf(HiveApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getTelemetrySnapshot().attempts.retries).toBe(0)
  })

  it('does not fail over after a caller cancellation', async () => {
    configureApi({ nodes: ['https://a.example', 'https://b.example'], retries: 1, retryDelayMs: 0 })
    const controller = new AbortController()
    const fetchMock = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
      setTimeout(() => controller.abort(), 5)
    }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await rpcRequest('condenser_api.get_ticker', [], { signal: controller.signal })
      .catch(value => value)

    expect(error.name).toBe('AbortError')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getTelemetrySnapshot().requests.aborted).toBe(1)
  })
})
