import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  V4vappError,
  checkInvoice,
  createInvoice,
  decodeInvoiceRemote,
  getBridgeState,
  getBridgeStatus,
  getSatsToHive,
  isBridgeBlocked,
  lightningAddressQrUrl,
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
      app_name: 'hiveausbit',
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

  it('marks the bridge blocked on a network/CORS failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const error = await createInvoice({ account: 'alice', amount: 1, currency: 'hbd' }).catch(err => err)
    expect(error).toBeInstanceOf(V4vappError)
    expect(error.code).toBe('network')
    expect(isBridgeBlocked(error)).toBe(true)
    expect(getBridgeState()).toMatchObject({ state: 'blocked' })
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
