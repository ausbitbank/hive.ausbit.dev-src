import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HivedexError,
  buildInvoiceBody,
  createInvoice,
  getInvoiceStatus,
  isPaidStatus,
  isTerminalStatus,
  normalizeStatus
} from '../../src/services/hivedex'

const PUBLIC_KEYS = {
  owner: 'STM' + 'A'.repeat(50),
  active: 'STM' + 'B'.repeat(50),
  posting: 'STM' + 'C'.repeat(50),
  memo: 'STM' + 'D'.repeat(50)
}

function mockFetch (body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    text: async () => JSON.stringify(body)
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Hivedex client', () => {
  it('normalises known and unknown order statuses', () => {
    expect(normalizeStatus('PAID')).toBe('paid')
    expect(normalizeStatus(' waiting ')).toBe('waiting')
    expect(normalizeStatus('something-new')).toBe('unknown')
    expect(normalizeStatus(null)).toBe('unknown')
  })

  it('identifies terminal and paid states', () => {
    expect(isTerminalStatus('paid')).toBe(true)
    expect(isTerminalStatus('expired')).toBe(true)
    expect(isTerminalStatus('paying')).toBe(false)
    expect(isPaidStatus('paid')).toBe(true)
    expect(isPaidStatus('expired')).toBe(false)
  })

  it('builds a public-key-only invoice body', () => {
    const body = buildInvoiceBody({
      username: ' Alice ',
      ...PUBLIC_KEYS,
      returnUrl: 'https://banksia.io/join/hivedex?resume=1'
    })
    expect(body).toEqual({
      username: 'alice',
      ...PUBLIC_KEYS,
      returnUrl: 'https://banksia.io/join/hivedex?resume=1',
      referrer: 'ausbitbank'
    })
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('privateKeys')
  })

  it('rejects incomplete invoice details', () => {
    expect(() => buildInvoiceBody({ username: 'alice' })).toThrow(/public key/)
    expect(() => buildInvoiceBody({ ...PUBLIC_KEYS })).toThrow(/username/)
  })

  it('creates an invoice with the public keys and reads its status', async () => {
    const fetchMock = mockFetch({ payLink: 'https://pay.example/1', trackId: '123', orderId: '42' })
    const invoice = await createInvoice({ username: 'alice', ...PUBLIC_KEYS, returnUrl: 'https://banksia.io/return' })

    expect(invoice).toEqual({
      payLink: 'https://pay.example/1',
      trackId: '123',
      orderId: '42'
    })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api2.hivedex.io/invoice')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({ username: 'alice', ...PUBLIC_KEYS, referrer: 'ausbitbank' })
    expect(body).not.toHaveProperty('password')

    mockFetch({ status: 'paid' })
    await expect(getInvoiceStatus('123')).resolves.toBe('paid')
  })

  it('maps a failed invoice response to a HivedexError', async () => {
    mockFetch({ error: 'No capacity right now' }, { ok: false, status: 503 })
    await expect(createInvoice({ username: 'alice', ...PUBLIC_KEYS })).rejects.toMatchObject({
      name: 'HivedexError',
      status: 503,
      message: 'No capacity right now'
    })
  })

  it('maps a network failure to a HivedexError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const error = await createInvoice({ username: 'alice', ...PUBLIC_KEYS }).catch(caught => caught)
    expect(error).toBeInstanceOf(HivedexError)
    expect(error.code).toBe('network')
    expect(error.isNetwork).toBe(true)
  })
})
