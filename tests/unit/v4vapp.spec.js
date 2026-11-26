import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRIDGE_STATES,
  V4vappError,
  checkInvoice,
  createInvoice,
  decodeInvoiceRemote,
  getBridgeProbe,
  getBridgeState,
  getBridgeStatus,
  getSatsToHive,
  isBridgeBlocked,
  isBridgeUnavailable,
  lightningAddressQrUrl,
  probeBridge,
  resetBridgeState
} from '../../src/services/v4vapp'

function response (data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data
  }
}

describe('v4vapp client', () => {
  beforeEach(() => {
    resetBridgeState()
    vi.unstubAllGlobals()
  })

  it('creates a HBD invoice with the expected request body', async () => {
    const fetchMock = vi.fn(async () => response({
      r_hash: 'hash',
      payment_hash: 'phash',
      payment_request: 'lnbc1110n1abc',
      amount: 111,
      memo: 'alice | tip | #v4vapp',
      expiry: 600,
      expires_at: 1795140000,
      qr_code_base64: 'iVBORw0KGgo='
    }))
    vi.stubGlobal('fetch', fetchMock)

    const invoice = await createInvoice({
      account: '@Alice',
      amount: 1,
      currency: 'hbd',
      receiveCurrency: 'hbd',
      message: 'Tip from hive.ausbit.dev'
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.v4v.app/v1/new_invoice_hive')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({
      hive_accname: 'alice',
      hbd_amount: 1,
      receive_currency: 'hbd',
      app_name: 'banksia',
      qr_image: true
    })
    expect(invoice).toMatchObject({
      rHash: 'hash',
      paymentHash: 'phash',
      paymentRequest: 'lnbc1110n1abc',
      amountSats: 111,
      expiresAt: 1795140000,
      qrCodeBase64: 'iVBORw0KGgo='
    })
  })

  it('never calls the side-effecting GET invoice endpoint', async () => {
    const fetchMock = vi.fn(async () => response({}))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createInvoice({ account: 'alice', amount: 0, currency: 'hbd' })).rejects.toBeInstanceOf(V4vappError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalises invoice status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ paid: true, settled: true, state: 'SETTLED' })))
    await expect(checkInvoice('hash')).resolves.toMatchObject({ status: 'paid', paid: true, expired: false })

    vi.stubGlobal('fetch', vi.fn(async () => response({ paid: false, expired: true, state: 'CANCELED' })))
    await expect(checkInvoice('hash')).resolves.toMatchObject({ status: 'expired', paid: false, expired: true })

    vi.stubGlobal('fetch', vi.fn(async () => response({ paid: false, expired: false, state: 'OPEN' })))
    await expect(checkInvoice('hash')).resolves.toMatchObject({ status: 'open' })
  })

  it('reports upstream validation errors without leaking HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(
      { detail: [{ msg: 'Amount is below the bridge minimum' }] },
      { ok: false, status: 422 }
    )))
    await expect(createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }))
      .rejects.toMatchObject({ status: 422, message: 'Amount is below the bridge minimum' })
  })

  it('marks the bridge blocked when the browser cannot reach it while online', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const error = await createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }).catch(err => err)
    expect(error).toBeInstanceOf(V4vappError)
    expect(error.code).toBe('network')
    expect(error.state).toBe(BRIDGE_STATES.BLOCKED)
    expect(isBridgeBlocked(error)).toBe(true)
    expect(isBridgeUnavailable(error)).toBe(true)
    expect(getBridgeState()).toMatchObject({ state: BRIDGE_STATES.BLOCKED })
  })

  it('separates an offline browser from a CORS or intermediary block', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const error = await createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }).catch(err => err)
    expect(error).toMatchObject({ code: 'offline', state: BRIDGE_STATES.OFFLINE })
    expect(isBridgeBlocked(error)).toBe(false)
    expect(isBridgeUnavailable(error)).toBe(true)
    expect(error.message).toMatch(/offline/i)
    expect(getBridgeState()).toMatchObject({ state: BRIDGE_STATES.OFFLINE })
    vi.unstubAllGlobals()
  })

  it('reports a timeout without calling it a CORS block', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }))
    const error = await createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }).catch(err => err)
    expect(error).toMatchObject({ code: 'timeout', state: BRIDGE_STATES.TIMEOUT })
    expect(isBridgeBlocked(error)).toBe(false)
    expect(isBridgeUnavailable(error)).toBe(true)
  })

  it('marks rate limits and server errors as degraded, not blocked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ detail: 'slow down' }, { ok: false, status: 429 })))
    const error = await checkInvoice('hash').catch(err => err)
    expect(error.state).toBe(BRIDGE_STATES.DEGRADED)
    expect(isBridgeBlocked(error)).toBe(false)
    expect(isBridgeUnavailable(error)).toBe(true)
    expect(getBridgeState()).toMatchObject({ state: BRIDGE_STATES.DEGRADED, error: 'slow down' })

    vi.stubGlobal('fetch', vi.fn(async () => response({}, { ok: false, status: 503 })))
    await expect(checkInvoice('hash')).rejects.toMatchObject({ state: BRIDGE_STATES.DEGRADED })
  })

  it('reports an authenticated endpoint as unauthorized rather than offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      detail: 'Could not validate credentials'
    }, { ok: false, status: 401 })))
    const error = await checkInvoice('hash').catch(err => err)
    expect(error).toMatchObject({ state: BRIDGE_STATES.UNAUTHORIZED, status: 401 })
    expect(isBridgeUnavailable(error)).toBe(false)
    expect(getBridgeState()).toMatchObject({ state: BRIDGE_STATES.UNAUTHORIZED })
  })

  it('keeps a successful validation response from looking degraded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(
      { detail: [{ msg: 'Amount is below the bridge minimum' }] },
      { ok: false, status: 422 }
    )))
    await createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }).catch(() => {})
    expect(getBridgeState()).toMatchObject({ state: BRIDGE_STATES.AVAILABLE, error: '' })
  })

  it('caches the capability probe and refreshes it on demand', async () => {
    const fetchMock = vi.fn(async () => response({
      message: 'alive',
      version: '6.6.1',
      config: { conv_fee_percent: 0.029 }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await probeBridge()
    expect(first).toMatchObject({ state: BRIDGE_STATES.AVAILABLE, error: '' })
    expect(first.status?.version).toBe('6.6.1')

    await probeBridge()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getBridgeProbe()).toMatchObject({ state: BRIDGE_STATES.AVAILABLE })

    await probeBridge({ force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns a probe result instead of throwing when the bridge is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const result = await probeBridge({ force: true })
    expect(result).toMatchObject({ state: BRIDGE_STATES.BLOCKED, status: null })
    expect(result.error).toMatch(/could not reach/i)
  })

  it('records when the bridge state was last checked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ message: 'alive' })))
    await getBridgeStatus({ force: true })
    expect(getBridgeState().checkedAt).toBeGreaterThan(0)
  })

  it('marks the bridge available after a successful read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      message: 'alive',
      config: { conv_fee_percent: 0.029, conv_fee_sats: 50, minimum_invoice_payment_sats: 50, maximum_invoice_payment_sats: 180000 }
    })))
    const status = await getBridgeStatus({ force: true })
    expect(status.message).toBe('alive')
    await expect(getBridgeState()).toMatchObject({ state: 'available' })
  })

  it('encodes invoice requests and ignores empty sats quotes', async () => {
    const fetchMock = vi.fn(async () => response({ num_satoshis: '67' }))
    vi.stubGlobal('fetch', fetchMock)
    await decodeInvoiceRemote('lightning:lnbc670n1abc')
    expect(fetchMock.mock.calls[0][0]).toContain('/v1/decode_lightning/?pay_req=lnbc670n1abc')
    await expect(getSatsToHive(0)).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('builds a direct QR image URL and rejects a missing invoice hash', async () => {
    expect(lightningAddressQrUrl('@Alice', 'hbd'))
      .toBe('https://api.v4v.app/v1/lnurlp/qrcode/alice?currency=hbd')
    await expect(checkInvoice('')).rejects.toBeInstanceOf(V4vappError)
  })
})
