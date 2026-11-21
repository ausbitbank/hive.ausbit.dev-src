// HTTP client for the v4v.app Hive <-> Lightning bridge.
//
// Only public endpoints are used here. Keeping every request in one module
// means a same-origin proxy can be swapped in with an env var, and a CORS or
// outage failure is reported consistently instead of leaking raw fetch errors
// into components.
//
// CORS was the original blocker: https://hive.ausbit.dev is now on v4v.app's
// allowlist (verified 2026-11-21, API 6.6.1). Keep the failure states below
// distinct anyway — an offline browser, a slow bridge, a rate limit and a
// lapsed allowlist need different copy, and only the last one is a browser
// restriction.

import { loadCached, invalidateCache } from './cache'
import {
  V4VAPP_API,
  V4VAPP_APP_NAME,
  V4VAPP_AUTH_APP_ID,
  V4VAPP_AUTH_SCOPE,
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
const PROBE_TTL_MS = 5 * 60 * 1000

export const BRIDGE_STATES = Object.freeze({
  UNKNOWN: 'unknown',
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  OFFLINE: 'offline',
  TIMEOUT: 'timeout',
  BLOCKED: 'blocked',
  UNAUTHORIZED: 'unauthorized'
})

let bridge = { state: BRIDGE_STATES.UNKNOWN, error: '', checkedAt: 0 }
let probe = { at: 0, state: BRIDGE_STATES.UNKNOWN, error: '', status: null }

export class V4vappError extends Error {
  constructor (message, { status = 0, code = '', detail = null, path = '', state = '' } = {}) {
    super(message)
    this.name = 'V4vappError'
    this.status = status
    this.code = code
    this.detail = detail
    this.path = path
    this.state = state
  }

  get isNetwork () {
    return this.code === 'network' || this.code === 'timeout' || this.code === 'offline'
  }

  get isCors () {
    return this.state === BRIDGE_STATES.BLOCKED
  }
}

export function getBridgeState () {
  return { ...bridge }
}

function markBridge (state, error = '') {
  bridge = { state, error, checkedAt: Date.now() }
}

export function resetBridgeState () {
  bridge = { state: BRIDGE_STATES.UNKNOWN, error: '', checkedAt: 0 }
  probe = { at: 0, state: BRIDGE_STATES.UNKNOWN, error: '', status: null }
  invalidateCache('v4vapp:')
}

function browserOffline () {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function errorMessage (status, data, fallback) {
  const detail = data?.detail
  if (Array.isArray(detail) && detail.length) return detail[0]?.msg || fallback
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message
  if (typeof data?.message === 'string') return data.message
  if (status === 401) return 'The Lightning bridge needs a signed-in session for that request.'
  if (status === 403) return 'The Lightning bridge refused this request.'
  if (status === 429) return 'The Lightning bridge is rate-limiting requests. Try again shortly.'
  if (status === 503) return 'Lightning bridge pricing is temporarily unavailable.'
  return fallback
}

async function request (path, {
  method = 'GET',
  body,
  signal = null,
  timeout = DEFAULT_TIMEOUT_MS,
  token = ''
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
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const state = response.status === 401 || response.status === 403
        ? BRIDGE_STATES.UNAUTHORIZED
        : response.status === 429 || response.status >= 500
          ? BRIDGE_STATES.DEGRADED
          : BRIDGE_STATES.AVAILABLE
      markBridge(state, state === BRIDGE_STATES.AVAILABLE ? '' : errorMessage(response.status, data, ''))
      throw new V4vappError(errorMessage(response.status, data, 'Lightning bridge request failed.'), {
        status: response.status,
        code: response.status === 429 ? 'rate-limit' : response.status >= 500 ? 'upstream' : 'http',
        detail: data,
        path,
        state
      })
    }
    markBridge(BRIDGE_STATES.AVAILABLE)
    return data
  } catch (error) {
    if (error instanceof V4vappError) throw error

    // A caller aborting the request (dialog closed, invoice replaced) is not a
    // bridge failure and must not change the capability state.
    if (signal?.aborted) {
      throw new V4vappError('Lightning bridge request cancelled.', {
        code: 'aborted',
        detail: error,
        path
      })
    }

    const timedOut = error?.name === 'AbortError'
    const offline = browserOffline()
    const state = offline
      ? BRIDGE_STATES.OFFLINE
      : timedOut ? BRIDGE_STATES.TIMEOUT : BRIDGE_STATES.BLOCKED
    const message = offline
      ? 'You are offline. The Lightning bridge cannot be reached.'
      : timedOut
        ? 'The Lightning bridge did not respond in time.'
        : 'Could not reach the Lightning bridge from this browser.'
    markBridge(state, message)
    throw new V4vappError(message, {
      code: offline ? 'offline' : timedOut ? 'timeout' : 'network',
      detail: error,
      path,
      state
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

/**
 * Capability probe used by the Lightning screens and the health page.
 *
 * `GET /v1` is the cheapest read that proves the browser can reach the bridge
 * and exposes the live fee/limit config. It never creates an invoice and never
 * throws: the UI needs a state, not an exception. The result is cached so a
 * page with several Lightning cards makes one request.
 */
export async function probeBridge ({ force = false } = {}) {
  if (!force && probe.at && Date.now() - probe.at < PROBE_TTL_MS) return { ...probe }
  try {
    const status = await getBridgeStatus({ force })
    probe = {
      at: Date.now(),
      state: bridge.state,
      error: '',
      status
    }
  } catch (error) {
    probe = {
      at: Date.now(),
      state: bridge.state,
      error: error?.message || 'The Lightning bridge could not be reached.',
      status: null
    }
  }
  return { ...probe }
}

export function getBridgeProbe () {
  return { ...probe }
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
// Read-only account session (keepsats)
// ---------------------------------------------------------------------------

/**
 * Ask v4v.app for a posting-scope challenge. `clientId` is a stable random id,
 * not a secret; it is 10–100 characters because the API rejects shorter ones.
 */
export async function getAuthChallenge (account, { clientId, signal = null } = {}) {
  const name = String(account || '').trim().replace(/^@/, '').toLowerCase()
  const id = String(clientId || '').trim()
  if (!name) throw new V4vappError('Choose a Hive account to connect.')
  if (id.length < 10 || id.length > 100) throw new V4vappError('The Lightning session id is invalid.')
  const query = [
    'clientId=' + encodeURIComponent(id),
    'appId=' + encodeURIComponent(V4VAPP_AUTH_APP_ID),
    'scope=' + encodeURIComponent(V4VAPP_AUTH_SCOPE)
  ].join('&')
  const data = await request('/auth/' + encodeURIComponent(name) + '?' + query, { signal })
  return { challenge: String(data?.challenge || '').trim(), raw: data }
}

/** Exchange a signed challenge for a short-lived bearer token. */
export async function validateAuthSignature (body, { clientId, signal = null } = {}) {
  const id = String(clientId || '').trim()
  if (!id) throw new V4vappError('The Lightning session id is missing.')
  if (!body || typeof body !== 'object') throw new V4vappError('The signed challenge is missing.')
  return request('/auth/validate/?clientId=' + encodeURIComponent(id), {
    method: 'POST',
    body,
    signal
  })
}

/** Read the keepsats balance and (when present) recent activity. */
export async function getKeepsats (account, token, { signal = null } = {}) {
  const name = String(account || '').trim().replace(/^@/, '').toLowerCase()
  if (!name) throw new V4vappError('Choose a Hive account to read the balance.')
  if (!token) throw new V4vappError('The Lightning session has expired. Reconnect to read the balance.')
  return request('/v2/v4vapp/keepsats?hive_accname=' + encodeURIComponent(name), {
    token,
    signal
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function bridgeFeePolicy (status) {
  return normalizeFeePolicy(status?.config || {})
}

export function isBridgeBlocked (error) {
  return error instanceof V4vappError && error.state === BRIDGE_STATES.BLOCKED
}

/** Offline, slow, rate-limited or blocked by the browser — any case where a
 * live invoice or quote cannot be read but the address/QR and the on-chain
 * fallback still work. */
export function isBridgeUnavailable (error) {
  return error instanceof V4vappError && [
    BRIDGE_STATES.BLOCKED,
    BRIDGE_STATES.OFFLINE,
    BRIDGE_STATES.TIMEOUT,
    BRIDGE_STATES.DEGRADED
  ].includes(error.state)
}
