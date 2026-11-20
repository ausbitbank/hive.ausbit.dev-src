// HTTP client for the v4v.app Hive <-> Lightning bridge.
//
// Only public endpoints are used here. Keeping every request in one module
// means a same-origin proxy can be swapped in with an env var, and a CORS or
// outage failure is reported consistently instead of leaking raw fetch errors
// into components.

import { loadCached } from './cache'
import {
  V4VAPP_API,
  V4VAPP_APP_NAME,
  invoiceStatus,
  lightningAddressQrUrl,
  normalizeFeePolicy
} from './lightning'

export { V4VAPP_API }

const BASE = String(import.meta.env?.VITE_V4VAPP_API || V4VAPP_API).replace(/\/+$/, '')
const DEFAULT_TIMEOUT_MS = 8000
const STATUS_TTL_MS = 30000
const QUOTE_TTL_MS = 45000
const ADDRESS_TTL_MS = 60 * 60 * 1000

let bridgeState = 'unknown'
let lastBridgeError = ''

export class V4vappError extends Error {
  constructor (message, { status = 0, code = '', detail = null, path = '' } = {}) {
    super(message)
    this.name = 'V4vappError'
    this.status = status
    this.code = code
    this.detail = detail
    this.path = path
  }

  get isNetwork () {
    return this.code === 'network' || this.code === 'timeout'
  }

  get isCors () {
    return this.code === 'network' && /failed to fetch|networkerror|load failed/i.test(this.message)
  }
}

export function getBridgeState () {
  return { state: bridgeState, error: lastBridgeError }
}

function markBridge (state, error = '') {
  bridgeState = state
  lastBridgeError = error
}

export function resetBridgeState () {
  bridgeState = 'unknown'
  lastBridgeError = ''
}

function errorMessage (status, data, fallback) {
  const detail = data?.detail
  if (Array.isArray(detail) && detail.length) return detail[0]?.msg || fallback
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message
  if (typeof data?.message === 'string') return data.message
  if (status === 429) return 'The Lightning bridge is rate-limiting requests. Try again shortly.'
  if (status === 503) return 'Lightning bridge pricing is temporarily unavailable.'
  return fallback
}

async function request (path, {
  method = 'GET',
  body,
  signal = null,
  timeout = DEFAULT_TIMEOUT_MS
} = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const abort = () => controller.abort()
  if (signal) signal.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(BASE + path, {
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new V4vappError(errorMessage(response.status, data, 'Lightning bridge request failed.'), {
        status: response.status,
        code: response.status === 429 ? 'rate-limit' : response.status >= 500 ? 'upstream' : 'http',
        detail: data,
        path
      })
    }
    markBridge('available')
    return data
  } catch (error) {
    if (error instanceof V4vappError) {
      if (error.status >= 500 || error.code === 'rate-limit') markBridge('degraded', error.message)
      throw error
    }
    const timedOut = error?.name === 'AbortError'
    const message = timedOut
      ? 'The Lightning bridge did not respond in time.'
      : 'Could not reach the Lightning bridge from this browser.'
    markBridge('blocked', message)
    throw new V4vappError(message, {
      code: timedOut ? 'timeout' : 'network',
      detail: error,
      path
    })
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', abort)
  }
}

function normalizeInvoice (invoice) {
  if (!invoice || typeof invoice !== 'object') return null
  const amount = Number(invoice.amount)
  return {
    rHash: invoice.r_hash || '',
    paymentHash: invoice.payment_hash || '',
    paymentRequest: invoice.payment_request || '',
    amountSats: Number.isFinite(amount) ? amount : 0,
    memo: invoice.memo || '',
    appName: invoice.app_name || '',
    expirySeconds: Number(invoice.expiry) || 0,
    expiresAt: Number(invoice.expires_at) || 0,
    qrCodeBase64: invoice.qr_code_base64 || '',
    feeSats: Number.isFinite(Number(invoice.fee_sats)) ? Number(invoice.fee_sats) : null,
    raw: invoice
  }
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getBridgeStatus ({ force = false } = {}) {
  return loadCached('v4vapp:status', () => request('/v1'), { ttl: STATUS_TTL_MS, force })
}

export async function getBridgeQuote ({ force = false } = {}) {
  return loadCached('v4vapp:quote', () => request('/v1/cryptoprices/'), { ttl: QUOTE_TTL_MS, force })
}

export async function getSatsToHive (sats, { force = false } = {}) {
  const amount = Math.max(0, Math.round(Number(sats) || 0))
  if (!amount) return null
  return loadCached('v4vapp:sats-to-hive:' + amount, () => {
    return request('/v1/cryptoprices/sats_to_hive/?sats=' + encodeURIComponent(amount))
  }, { ttl: QUOTE_TTL_MS, force })
}

export async function getLightningAddressInfo (account, currency = 'hive', { force = false } = {}) {
  const name = String(account || '').trim().replace(/^@/, '').toLowerCase()
  if (!name) return null
  return loadCached('v4vapp:address:' + name + ':' + currency, () => {
    return request('/v1/lnurlp/bech32/' + encodeURIComponent(name) + '?currency=' + encodeURIComponent(currency))
  }, { ttl: ADDRESS_TTL_MS, force })
}

export { lightningAddressQrUrl }

export async function getAccountCost ({ force = false } = {}) {
  return loadCached('v4vapp:account-cost', () => request('/v2/v4vapp/account/cost'), {
    ttl: 5 * 60 * 1000,
    force
  })
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/**
 * Create an invoice that a Lightning wallet pays; the Hive account receives
 * HIVE, HBD or keepsats. `amount` is in `currency` units.
 */
export async function createInvoice ({
  account,
  amount,
  currency = 'hbd',
  receiveCurrency = 'hbd',
  message = '',
  expiry = 600,
  includeQr = true
} = {}) {
  const name = String(account || '').trim().replace(/^@/, '').toLowerCase()
  const value = Number(amount)
  if (!name) throw new V4vappError('Choose a Hive account to receive the payment.')
  if (!Number.isFinite(value) || value <= 0) throw new V4vappError('Enter an amount greater than zero.')

  const body = {
    hive_accname: name,
    receive_currency: receiveCurrency,
    app_name: V4VAPP_APP_NAME,
    expiry: Math.max(60, Math.min(1800, Number(expiry) || 600)),
    qr_image: Boolean(includeQr),
    message: String(message || '').slice(0, 280)
  }
  if (currency === 'hive') body.hive_amount = value
  else if (currency === 'hbd') body.hbd_amount = value
  else if (currency === 'usd') body.usd_amount = value
  else if (currency === 'sats') body.sats_amount = Math.round(value)
  else throw new V4vappError('Unsupported invoice currency.')

  const invoice = normalizeInvoice(await request('/v1/new_invoice_hive', {
    method: 'POST',
    body
  }))
  if (!invoice?.paymentRequest || !invoice.rHash) {
    throw new V4vappError('The bridge returned an incomplete invoice.')
  }
  return invoice
}

/** Poll an invoice. POST avoids base64 path-encoding pitfalls. */
export async function checkInvoice (rHash, { signal = null } = {}) {
  if (!rHash) throw new V4vappError('Invoice hash is missing.')
  const data = await request('/v1/check_invoice', {
    method: 'POST',
    body: { r_hash: rHash },
    signal
  })
  return {
    status: invoiceStatus(data),
    paid: Boolean(data?.paid || data?.settled),
    expired: Boolean(data?.expired),
    state: data?.state || '',
    raw: data
  }
}

/** Server-side decode. Components fall back to local `decodeBolt11`. */
export async function decodeInvoiceRemote (invoice, { signal = null } = {}) {
  const value = String(invoice || '').trim().replace(/^lightning:/i, '')
  if (!value) return null
  return request('/v1/decode_lightning/?pay_req=' + encodeURIComponent(value), { signal })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function bridgeFeePolicy (status) {
  return normalizeFeePolicy(status?.config || {})
}

export function isBridgeBlocked (error) {
  return error instanceof V4vappError && (error.isNetwork || error.isCors)
}
