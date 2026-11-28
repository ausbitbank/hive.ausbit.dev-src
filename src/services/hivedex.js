// Hivedex account-creation API client.
//
// Hivedex generates the account from public keys only. Keys are created in the
// browser by the new user; the request below never contains a password or a
// private key. CORS is open on api2.hivedex.io (verified 2026-11-26).
//
// Endpoints used:
//   GET  /price                { price, assets }
//   POST /invoice              { username, owner, active, posting, memo, returnUrl, referrer }
//                              -> { payLink, trackId, orderId }
//   GET  /status/{trackId}     -> { status: new|waiting|paying|paid|expired }

const BASE = 'https://api2.hivedex.io'
const DEFAULT_TIMEOUT_MS = 10000
const PRICE_TTL_MS = 5 * 60 * 1000

export const HIVEDEX_STATUS = Object.freeze({
  NEW: 'new',
  WAITING: 'waiting',
  PAYING: 'paying',
  PAID: 'paid',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown'
})

const KNOWN_STATUSES = new Set(Object.values(HIVEDEX_STATUS).filter(value => value !== HIVEDEX_STATUS.UNKNOWN))

let priceCache = { at: 0, value: null }

export class HivedexError extends Error {
  constructor (message, { status = 0, code = '', detail = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'HivedexError'
    this.status = status
    this.code = code
    this.detail = detail
  }

  get isNetwork () {
    return this.code === 'network' || this.code === 'timeout'
  }
}

export function normalizeStatus (value) {
  const status = String(value || '').trim().toLowerCase()
  return KNOWN_STATUSES.has(status) ? status : HIVEDEX_STATUS.UNKNOWN
}

export function isTerminalStatus (value) {
  const status = normalizeStatus(value)
  return status === HIVEDEX_STATUS.PAID || status === HIVEDEX_STATUS.EXPIRED
}

export function isPaidStatus (value) {
  return normalizeStatus(value) === HIVEDEX_STATUS.PAID
}

export function buildInvoiceBody ({ username, owner, active, posting, memo, returnUrl, referrer = 'ausbitbank' } = {}) {
  const name = String(username || '').trim().toLowerCase()
  if (!name) throw new Error('A username is required.')
  for (const [label, key] of Object.entries({ owner, active, posting, memo })) {
    if (!key || typeof key !== 'string') throw new Error('The ' + label + ' public key is required.')
  }
  const body = {
    username: name,
    owner,
    active,
    posting,
    memo
  }
  if (returnUrl) body.returnUrl = String(returnUrl)
  if (referrer) body.referrer = String(referrer).trim().toLowerCase()
  return body
}

async function request (path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(BASE + path, {
      method,
      headers: body
        ? { Accept: 'application/json', 'Content-Type': 'application/json' }
        : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      signal: controller.signal
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!response.ok) {
      const message = data?.error || data?.message || ('Hivedex returned HTTP ' + response.status + '.')
      throw new HivedexError(message, { status: response.status, detail: data })
    }
    return data
  } catch (error) {
    if (error instanceof HivedexError) throw error
    if (error?.name === 'AbortError') {
      throw new HivedexError('Hivedex did not respond in time.', { code: 'timeout', detail: error, cause: error })
    }
    throw new HivedexError('Could not reach Hivedex.', { code: 'network', detail: error, cause: error })
  } finally {
    clearTimeout(timer)
  }
}

export async function getPrice ({ force = false } = {}) {
  if (!force && priceCache.value && Date.now() - priceCache.at < PRICE_TTL_MS) {
    return priceCache.value
  }
  const data = await request('/price')
  const price = Number(data?.price)
  if (!Number.isFinite(price) || price <= 0) {
    throw new HivedexError('Hivedex returned an invalid price.')
  }
  const value = {
    price,
    assets: Array.isArray(data?.assets) ? data.assets : []
  }
  priceCache = { at: Date.now(), value }
  return value
}

export function safeHivedexPayLink (value) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol !== 'https:' || !url.hostname) return ''
    return url.href
  } catch {
    return ''
  }
}

export async function createInvoice (details) {
  const body = buildInvoiceBody(details)
  const data = await request('/invoice', { method: 'POST', body })
  const payLink = safeHivedexPayLink(data?.payLink)
  if (!payLink || !data?.trackId) {
    throw new HivedexError('Hivedex did not return a safe https payment link.', { detail: data })
  }
  return {
    payLink,
    trackId: String(data.trackId),
    orderId: data.orderId ? String(data.orderId) : ''
  }
}

export async function getInvoiceStatus (trackId) {
  const id = String(trackId || '').trim()
  if (!id) throw new Error('A Hivedex order id is required.')
  const data = await request('/status/' + encodeURIComponent(id))
  return normalizeStatus(data?.status)
}

export function clearPriceCache () {
  priceCache = { at: 0, value: null }
}
