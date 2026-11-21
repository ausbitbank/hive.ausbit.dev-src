// Pure Lightning helpers for the v4vapp bridge.
//
// Everything here is dependency-free and synchronous so the fee maths,
// BOLT11 parsing and memo rules can be unit tested without a browser, a
// network call or a signing stack.

export const LIGHTNING_ENABLED = true
// Keepsats is custodial; keep a kill switch even though it ships opt-in.
export const KEEPSATS_ENABLED = true
export const V4VAPP_ACCOUNT = 'v4vapp'
export const V4VAPP_API = 'https://api.v4v.app'
export const V4VAPP_APP_NAME = 'hiveausbit'
// The auth challenge/validate pair uses the site's domain as its app id.
export const V4VAPP_AUTH_APP_ID = 'hive.ausbit.dev'
export const V4VAPP_AUTH_SCOPE = 'hive:posting'

export const LIGHTNING_DOMAINS = {
  hive: 'v4v.app',
  hbd: 'hbd.v4v.app',
  sats: 'sats.v4v.app',
  magisats: 'magi.v4v.app'
}

export const SATS_PER_BTC = 100000000

// Server defaults. The live values are read from GET /v1 and should win when
// available; these only keep the UI useful when the bridge config cannot be
// read (offline, outage or a blocked request).
export const DEFAULT_FEE_PERCENT = 0.029
export const DEFAULT_FEE_SATS = 50
export const DEFAULT_MIN_INVOICE_SATS = 50
export const DEFAULT_MAX_INVOICE_SATS = 180000
export const DEFAULT_EXPIRY_SECONDS = 600
export const MAX_EXPIRY_SECONDS = 1800

const HIVE_ACCOUNT_RE = /^[a-z0-9][a-z0-9.-]{1,14}[a-z0-9]$/
const LIGHTNING_ADDRESS_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

export function normalizeAccount (value) {
  const account = String(value || '').trim().replace(/^@/, '').toLowerCase()
  return account
}

export function isValidHiveAccount (value) {
  return HIVE_ACCOUNT_RE.test(normalizeAccount(value))
}

/** `alice` + `hive` -> `alice@v4v.app`. */
export function lightningAddress (account, currency = 'hive') {
  const name = normalizeAccount(account)
  if (!isValidHiveAccount(name)) return ''
  const domain = LIGHTNING_DOMAINS[currency] || LIGHTNING_DOMAINS.hive
  return name + '@' + domain
}

export function lightningAddressDomain (currency = 'hive') {
  return LIGHTNING_DOMAINS[currency] || LIGHTNING_DOMAINS.hive
}

/** Direct image URL. The QR is rendered by an <img>, so it works even when the
 * JSON API is unreachable; the surrounding card always shows the address too. */
export function lightningAddressQrUrl (account, currency = 'hive') {
  const name = normalizeAccount(account)
  if (!name) return ''
  return V4VAPP_API + '/v1/lnurlp/qrcode/' + encodeURIComponent(name) + '?currency=' + encodeURIComponent(currency)
}

/**
 * Classify pasted payment input. This is deliberately permissive: the bridge
 * does the final validation, and the UI only needs to know which form to show.
 */
export function parseLightningTarget (value) {
  const raw = String(value || '').trim().replace(/^lightning:/i, '').trim()
  if (!raw) return { type: 'empty', value: '' }
  if (/^lnbc[0-9a-z]+$/i.test(raw)) return { type: 'invoice', value: raw.toLowerCase() }
  if (/^lnurl1[0-9a-z]+$/i.test(raw)) return { type: 'lnurl', value: raw.toLowerCase() }
  if (LIGHTNING_ADDRESS_RE.test(raw)) return { type: 'address', value: raw.toLowerCase() }
  return { type: 'unknown', value: raw }
}

// ---------------------------------------------------------------------------
// Status and fees
// ---------------------------------------------------------------------------

/**
 * Normalise `/v1/check_invoice`. The API has returned `state: CANCELED` for
 * expired invoices, so the boolean flags are the reliable fields.
 */
export function invoiceStatus (payload) {
  if (!payload || typeof payload !== 'object') return 'unknown'
  if (payload.paid === true || payload.settled === true) return 'paid'
  if (payload.expired === true) return 'expired'
  const state = String(payload.state || '').toUpperCase()
  if (state === 'SETTLED') return 'paid'
  if (state === 'CANCELED' || state === 'CANCELLED' || state === 'EXPIRED') return 'expired'
  if (state === 'OPEN') return 'open'
  return 'unknown'
}

export function normalizeFeePolicy (config = {}) {
  const rawPercent = Number(config.conv_fee_percent)
  const percent = Number.isFinite(rawPercent)
    ? Number((rawPercent > 1 ? rawPercent / 100 : rawPercent).toFixed(6))
    : DEFAULT_FEE_PERCENT
  const fixed = Number(config.conv_fee_sats)
  // The bridge exposes two minimums. `minimum_invoice_payment_sats` is the
  // outbound invoice floor; `min_max.min.sats` is the conversion floor that
  // still applies (it was 50 sats when the former briefly reported 1). Taking
  // the larger one prevents the UI from offering amounts the bridge rejects.
  const minCandidates = [config.minimum_invoice_payment_sats, config.min_max?.min?.sats]
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
  const min = minCandidates.length ? Math.max(...minCandidates) : DEFAULT_MIN_INVOICE_SATS
  const max = Number(config.maximum_invoice_payment_sats)
  return {
    percent,
    fixed: Number.isFinite(fixed) && fixed >= 0 ? fixed : DEFAULT_FEE_SATS,
    minSats: min,
    maxSats: Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX_INVOICE_SATS
  }
}

export function feeSats (sats, policy = {}) {
  const amount = Number(sats)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const normalized = normalizeFeePolicy(policy)
  return Math.ceil(amount * normalized.percent + normalized.fixed)
}

/**
 * Cost of sending a fixed invoice from Hive. Inbound invoices already embed
 * the bridge spread; this is specifically for Hive/HBD -> Lightning.
 */
export function quoteSatsPayment ({
  amountSats,
  satsPerHive = null,
  satsPerHbd = null,
  policy = {},
  source = 'estimated'
} = {}) {
  const amount = Number(amountSats)
  const normalized = normalizeFeePolicy(policy)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'Enter an amount in sats.', amountSats: 0, feeSats: 0, totalSats: 0 }
  }
  if (amount < normalized.minSats) {
    return { valid: false, error: 'The bridge minimum is ' + normalized.minSats + ' sats.', amountSats: amount, feeSats: 0, totalSats: amount }
  }
  if (amount > normalized.maxSats) {
    return { valid: false, error: 'The bridge maximum is ' + formatSats(normalized.maxSats) + ' sats per invoice.', amountSats: amount, feeSats: 0, totalSats: amount }
  }
  const fee = feeSats(amount, normalized)
  const total = amount + fee
  const hive = Number.isFinite(satsPerHive) && satsPerHive > 0 ? total / satsPerHive : null
  const hbd = Number.isFinite(satsPerHbd) && satsPerHbd > 0 ? total / satsPerHbd : null
  return {
    valid: true,
    error: '',
    amountSats: amount,
    feeSats: fee,
    totalSats: total,
    hive,
    hbd,
    percent: normalized.percent,
    fixed: normalized.fixed,
    minSats: normalized.minSats,
    maxSats: normalized.maxSats,
    source
  }
}

/** Derive sats-per-Hive/HBD from the site's existing CoinGecko price feed. */
export function satsRatesFromPrices (prices = {}) {
  const btcUsd = Number(prices?.bitcoin?.usd)
  const hiveBtc = Number(prices?.hive?.btc)
  const hiveUsd = Number(prices?.hive?.usd)
  const hbdBtc = Number(prices?.hive_dollar?.btc)
  const hbdUsd = Number(prices?.hive_dollar?.usd) || 1

  let satsPerHive = null
  if (Number.isFinite(hiveBtc) && hiveBtc > 0) satsPerHive = hiveBtc * SATS_PER_BTC
  else if (Number.isFinite(hiveUsd) && Number.isFinite(btcUsd) && btcUsd > 0) satsPerHive = (hiveUsd / btcUsd) * SATS_PER_BTC

  let satsPerHbd = null
  if (Number.isFinite(hbdBtc) && hbdBtc > 0) satsPerHbd = hbdBtc * SATS_PER_BTC
  else if (Number.isFinite(hbdUsd) && Number.isFinite(btcUsd) && btcUsd > 0) satsPerHbd = (hbdUsd / btcUsd) * SATS_PER_BTC

  return { satsPerHive, satsPerHbd, btcUsd: Number.isFinite(btcUsd) ? btcUsd : null }
}

// ---------------------------------------------------------------------------
// Memos and on-chain classification
// ---------------------------------------------------------------------------

/**
 * Build the memo for a Hive/HBD transfer to @v4vapp. Never add unknown flags:
 * an unrecognised memo is treated as a keepsats deposit.
 */
export function lightningMemo (invoice, { hbd = false, appTag = '#v4vapp' } = {}) {
  const clean = String(invoice || '').trim().replace(/^lightning:/i, '').replace(/\s+/g, '')
  if (!/^lnbc[0-9a-z]+$/i.test(clean) && !/^lnurl1[0-9a-z]+$/i.test(clean) && !LIGHTNING_ADDRESS_RE.test(clean)) {
    throw new Error('Paste a mainnet BOLT11 invoice, a Lightning address or an LNURL.')
  }
  return [clean, hbd ? '#HBD' : '', appTag].filter(Boolean).join(' ')
}

export function isV4vappAccount (value) {
  const account = normalizeAccount(value)
  return account === V4VAPP_ACCOUNT || account.startsWith(V4VAPP_ACCOUNT + '.')
}

export function isV4vappTransfer (data = {}) {
  return isV4vappAccount(data.from) || isV4vappAccount(data.to)
}

/**
 * Read the information v4vapp puts in Hive transfer memos. It is intentionally
 * tolerant: the bridge has changed wording before and the raw memo is always
 * still available in the activity row.
 */
export function parseV4vappMemo (value) {
  const memo = typeof value === 'string' ? value : ''
  if (!memo) return null
  const lower = memo.toLowerCase()
  if (!lower.includes('v4v.app') && !lower.includes('v4vapp') && !lower.includes('sats') && !lower.includes('lightning') && !lower.includes('#sats')) {
    return null
  }

  const converted = /Converted\s+([\d,]+(?:\.\d+)?)\s+sats\s+to\s+([\d.]+)\s+(HIVE|HBD)\s+with fee:\s*([\d,]+)\s+sats/i.exec(memo)
  const deposit = /Deposit\s+([\d.]+)\s+(HIVE|HBD)\s+to\s+([\d,]+)\s+sats\s+with fee:\s*([\d,]+)/i.exec(memo)
  const invoice = /lnbc[0-9a-z]+/i.exec(memo)
  const reference = /§\s*([A-Za-z0-9_+/=-]+)/.exec(memo)
  const messageMatch = /\|\s*([^|]+?)\s*(?:\||§|$)/g
  let message = ''
  let match
  while ((match = messageMatch.exec(memo))) {
    const candidate = match[1].trim()
    if (!candidate || /^converted\s/i.test(candidate) || /^deposit\s/i.test(candidate) || /^thank you/i.test(candidate)) continue
    message = candidate
  }

  let kind = 'other'
  let sats = null
  let fee = null
  let amount = null
  let asset = ''
  if (converted) {
    kind = 'received'
    sats = Number(converted[1].replace(/,/g, ''))
    amount = Number(converted[2])
    asset = converted[3].toUpperCase()
    fee = Number(converted[4].replace(/,/g, ''))
  } else if (deposit) {
    kind = 'deposit'
    amount = Number(deposit[1])
    asset = deposit[2].toUpperCase()
    sats = Number(deposit[3].replace(/,/g, ''))
    fee = Number(deposit[4].replace(/,/g, ''))
  } else if (invoice) {
    kind = 'payment'
  } else if (lower.includes('#sats') || lower.includes('#keepsats')) {
    kind = 'deposit'
  }

  return {
    kind,
    sats: Number.isFinite(sats) ? sats : null,
    feeSats: Number.isFinite(fee) ? fee : null,
    amount: Number.isFinite(amount) ? amount : null,
    asset,
    invoice: invoice ? invoice[0] : '',
    reference: reference ? reference[1] : '',
    message: message || '',
    zap: memo.includes('⚡') || lower.includes('zapped'),
    lightning: Boolean(invoice) || lower.includes('lightning') || lower.includes('#lightningaddress'),
    raw: memo
  }
}

export function cleanV4vappMemo (value) {
  const parsed = parseV4vappMemo(value)
  if (!parsed) return typeof value === 'string' ? value : ''
  if (parsed.invoice) return 'Lightning invoice payment'
  if (parsed.kind === 'received' && parsed.sats !== null) {
    return 'Converted ' + formatSats(parsed.sats) + (parsed.feeSats ? ' (fee ' + formatSats(parsed.feeSats) + ')' : '')
  }
  if (parsed.kind === 'deposit' && parsed.sats !== null) {
    return 'Deposit of ' + formatSats(parsed.sats) + (parsed.feeSats ? ' (fee ' + formatSats(parsed.feeSats) + ')' : '')
  }
  if (parsed.zap) return parsed.message || 'Lightning zap'
  return parsed.message || String(value || '')
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatSats (value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }) + ' sats'
}

export function formatBtc (value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toFixed(8) + ' BTC'
}

export function satsToHbd (sats, satsPerHbd) {
  const amount = Number(sats)
  const rate = Number(satsPerHbd)
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null
  return amount / rate
}

export function satsToHive (sats, satsPerHive) {
  const amount = Number(sats)
  const rate = Number(satsPerHive)
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null
  return amount / rate
}

export function ceilAmount (value, precision = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const factor = Math.pow(10, precision)
  return Math.ceil(number * factor) / factor
}
