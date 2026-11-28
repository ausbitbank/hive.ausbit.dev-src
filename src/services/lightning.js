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
export const V4VAPP_APP_NAME = 'banksia'
// The auth challenge/validate pair uses the site's domain as its app id.
export const V4VAPP_AUTH_APP_ID = 'banksia.io'
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

// v4v.app reserves a routing-fee buffer from the converted Hive/HBD before it
// checks that a fixed invoice fits. Its defaults are a 50 sat base plus 0.1% of
// the payment. Overfunding by that amount is safe: the bridge returns unused
// sats as change, and it keeps a fixed-invoice payment inside the bridge's
// "amount sent" check instead of failing it.
export const LIGHTNING_FEE_BASE_SATS = 50
export const LIGHTNING_FEE_ESTIMATE_PERCENT = 0.001

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

export const PAY_AMOUNT_UNITS = ['sats', 'hbd', 'hive']

/** Normalise a payment-link amount unit. Unknown values fall back safely. */
export function normalizeAmountUnit (value, fallback = 'sats') {
  const raw = String(value || '').trim().toLowerCase()
  const unit = raw === 'sat' ? 'sats' : raw === 'hp' ? 'hive' : raw
  return PAY_AMOUNT_UNITS.includes(unit) ? unit : fallback
}

/**
 * Read the optional amount from a payment link:
 *
 *   /lightning?pay=alice@getalby.com&amount=5&currency=hbd
 *   /lightning?pay=alice@getalby.com&sats=5000
 *
 * `amount` is the invoice value in `currency`; the bridge fee is added on top
 * when the payment is quoted. A bare `amount` is treated as sats so a link that
 * forgets `currency` cannot quietly spend HIVE/HBD.
 */
export function payLinkAmount (query = {}) {
  const raw = query.amount ?? query.sats ?? ''
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return { amount: null, unit: '' }
  const unit = query.sats != null && query.amount == null
    ? 'sats'
    : normalizeAmountUnit(query.currency || query.unit || query.asset, 'sats')
  return { amount, unit }
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
// LNURL-pay address resolution
// ---------------------------------------------------------------------------

/**
 * Normalise the LNURL-pay response v4v.app's proxy returns for an address.
 * `minSendable`/`maxSendable` are millisats; the UI works in whole sats.
 */
export function normalizeLnurlPayInfo (payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The Lightning address did not return an LNURL-pay response.')
  }
  if (String(payload.tag || '') !== 'payRequest') {
    throw new Error('That address is not a Lightning address (no pay request).')
  }
  const callback = String(payload.callback || '').trim()
  if (!/^https?:\/\//i.test(callback)) {
    throw new Error('The Lightning address returned an invalid callback.')
  }
  const minMsats = Number(payload.minSendable)
  const maxMsats = Number(payload.maxSendable)
  if (!Number.isFinite(minMsats) || !Number.isFinite(maxMsats) || minMsats <= 0 || maxMsats < minMsats) {
    throw new Error('The Lightning address returned an invalid amount range.')
  }
  return {
    callback,
    minSats: Math.ceil(minMsats / 1000),
    maxSats: Math.floor(maxMsats / 1000),
    metadata: String(payload.metadata || ''),
    commentAllowed: Number(payload.commentAllowed) || 0
  }
}

/** Add the exact millisat amount to an LNURL-pay callback. No comment is sent:
 * v4v.app forwards a memo remainder as the comment, and a provider that rejects
 * it makes the bridge fall back to a keepsats deposit. */
export function lnurlCallbackUrl (callback, amountSats) {
  const amount = Math.round(Number(amountSats))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount to send to the Lightning address.')
  }
  let url
  try {
    url = new URL(String(callback))
  } catch {
    throw new Error('The Lightning address returned an invalid callback.')
  }
  url.searchParams.set('amount', String(amount * 1000))
  return url.toString()
}

/** Read the BOLT11 invoice from v4v.app's LNURL-pay callback proxy. */
export function parseLnurlInvoice (payload) {
  const value = payload && typeof payload === 'object'
    ? payload.pr || payload.payment_request || payload.paymentRequest
    : ''
  const paymentRequest = String(value || '').trim().replace(/^lightning:/i, '')
  if (!/^lnbc[0-9a-z]+$/i.test(paymentRequest)) {
    throw new Error('The Lightning address provider did not return a mainnet BOLT11 invoice.')
  }
  return paymentRequest.toLowerCase()
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

/** Routing buffer v4v.app holds back while it checks a fixed invoice. */
export function lightningFeeBufferSats (sats) {
  const amount = Number(sats)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.ceil(LIGHTNING_FEE_BASE_SATS + amount * LIGHTNING_FEE_ESTIMATE_PERCENT)
}

/**
 * Cost of sending a fixed invoice from Hive. Inbound invoices already embed
 * the bridge spread; this is specifically for Hive/HBD -> Lightning.
 *
 * The bridge charges its percentage on the gross deposit, not on the invoice,
 * and it reserves a small routing buffer before checking that the invoice fits.
 * Solve for the gross that leaves exactly `amountSats` after both, and send a
 * little extra so the bridge returns change instead of rejecting the payment.
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
  const buffer = lightningFeeBufferSats(amount)
  const percent = normalized.percent >= 1 ? 0 : normalized.percent
  const total = Math.ceil((amount + normalized.fixed + buffer) / (1 - percent))
  const fee = total - amount
  const hive = Number.isFinite(satsPerHive) && satsPerHive > 0 ? total / satsPerHive : null
  const hbd = Number.isFinite(satsPerHbd) && satsPerHbd > 0 ? total / satsPerHbd : null
  return {
    valid: true,
    error: '',
    amountSats: amount,
    feeSats: fee,
    bridgeFeeSats: Math.max(0, fee - buffer),
    bufferSats: buffer,
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

/**
 * Cost of spending a fixed HIVE/HBD amount, where the entered amount is the
 * total wallet debit. The recipient invoice is the remainder after the bridge
 * fee and the routing buffer, so the payer can spend a whole liquid balance and
 * the bridge returns any unused sats as change.
 */
export function quoteSpendPayment ({
  spendAmount,
  asset = 'hbd',
  satsPerHive = null,
  satsPerHbd = null,
  policy = {},
  source = 'estimated'
} = {}) {
  const normalized = normalizeFeePolicy(policy)
  const spend = roundAmount(spendAmount, 3)
  const rate = asset === 'hive' ? Number(satsPerHive) : Number(satsPerHbd)
  const empty = {
    valid: false,
    error: '',
    amountSats: 0,
    feeSats: 0,
    bridgeFeeSats: 0,
    bufferSats: 0,
    totalSats: 0,
    spend: 0,
    spendAsset: asset,
    hive: null,
    hbd: null,
    percent: normalized.percent,
    fixed: normalized.fixed,
    minSats: normalized.minSats,
    maxSats: normalized.maxSats,
    source
  }
  if (!Number.isFinite(spend) || spend <= 0) {
    return { ...empty, error: 'Enter an amount greater than zero.' }
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ...empty, spend, error: 'Could not read a ' + String(asset).toUpperCase() + ' price to convert the amount.' }
  }

  const totalSats = Math.round(spend * rate)
  // The bridge charges its fee on the gross amount, then reserves a routing
  // buffer before checking the invoice. The invoice is what remains; the
  // transfer still spends exactly `spend`, and the bridge returns the buffer
  // (and any rounding) as change.
  const bridgeFee = Math.ceil(totalSats * normalized.percent + normalized.fixed)
  const afterFee = totalSats - bridgeFee
  const buffer = lightningFeeBufferSats(afterFee)
  const amountSats = Math.max(0, afterFee - buffer)
  const fee = totalSats - amountSats
  const hive = Number.isFinite(satsPerHive) && satsPerHive > 0 ? totalSats / satsPerHive : null
  const hbd = Number.isFinite(satsPerHbd) && satsPerHbd > 0 ? totalSats / satsPerHbd : null
  const result = {
    ...empty,
    spend,
    totalSats,
    feeSats: fee,
    bridgeFeeSats: Math.max(0, bridgeFee),
    bufferSats: buffer,
    amountSats,
    hive,
    hbd
  }

  if (amountSats < normalized.minSats) {
    return {
      ...result,
      amountSats: Math.max(0, amountSats),
      error: 'The bridge minimum is ' + normalized.minSats + ' sats after the fee.'
    }
  }
  if (totalSats > normalized.maxSats) {
    return {
      ...result,
      error: 'The bridge maximum is ' + formatSats(normalized.maxSats) + ' sats per payment.'
    }
  }
  return { ...result, valid: true }
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

/**
 * Read the bridge's own sats-per-HIVE/HBD rates from `GET /v1/cryptoprices/`.
 * These are authoritative when present; callers fall back to the market feed.
 */
export function satsRatesFromBridgeQuote (quote = {}) {
  const hive = Number(quote?.v4vapp?.sats_Hive)
  const hbd = Number(quote?.v4vapp?.sats_HBD)
  return {
    satsPerHive: Number.isFinite(hive) && hive > 0 ? hive : null,
    satsPerHbd: Number.isFinite(hbd) && hbd > 0 ? hbd : null
  }
}

// ---------------------------------------------------------------------------
// Memos and on-chain classification
// ---------------------------------------------------------------------------

/**
 * Build the memo for a Hive/HBD transfer to @v4vapp. Never add unknown flags:
 * an unrecognised memo is treated as a keepsats deposit.
 *
 * A BOLT11 invoice can carry the `#v4vapp` attribution tag because the bridge
 * ignores everything after an invoice. A Lightning address or LNURL is
 * different: v4vapp forwards the rest of the memo to the provider as the LNURL
 * comment. A provider that rejects that comment makes the bridge fail the
 * invoice lookup and silently convert the transfer into a keepsats deposit, so
 * address and LNURL memos must stay bare.
 */
export function lightningMemo (invoice, { appTag = '#v4vapp' } = {}) {
  const clean = String(invoice || '').trim().replace(/^lightning:/i, '').replace(/\s+/g, '')
  const target = parseLightningTarget(clean)
  if (target.type === 'address' || target.type === 'lnurl') return target.value
  if (target.type !== 'invoice') {
    throw new Error('Paste a mainnet BOLT11 invoice or a Lightning address.')
  }
  return [target.value, appTag].filter(Boolean).join(' ')
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

export function roundAmount (value, precision = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const factor = Math.pow(10, precision)
  return Math.round(number * factor) / factor
}
