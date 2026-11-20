// Local BOLT11 decoder.
//
// Kept separate from lightning.js so the wallet/activity chunks do not pull in
// the bech32 decoder; only the payment dialog needs it.

export const MSATS_PER_BTC = 100000000000
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod (values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const value of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= generators[i]
    }
  }
  return chk
}

function bech32HrpExpand (hrp) {
  const values = []
  for (let i = 0; i < hrp.length; i++) values.push(hrp.charCodeAt(i) >> 5)
  values.push(0)
  for (let i = 0; i < hrp.length; i++) values.push(hrp.charCodeAt(i) & 31)
  return values
}

function bech32Decode (value) {
  const text = String(value || '')
  if (text.length < 8) throw new Error('Invoice is too short')
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) {
    throw new Error('Invoice has mixed case')
  }
  const lower = text.toLowerCase()
  const separator = lower.lastIndexOf('1')
  if (separator < 1 || separator + 7 > lower.length) throw new Error('Invoice has no data part')
  const hrp = lower.slice(0, separator)
  const dataPart = lower.slice(separator + 1)
  const words = []
  for (const char of dataPart) {
    const index = BECH32_CHARSET.indexOf(char)
    if (index < 0) throw new Error('Invoice has an invalid character')
    words.push(index)
  }
  const checksum = bech32Polymod([...bech32HrpExpand(hrp), ...words])
  if (checksum !== 1) throw new Error('Invoice checksum is invalid')
  return { hrp, words: words.slice(0, -6) }
}

function convertBits (data, from, to, pad = false) {
  let acc = 0
  let bits = 0
  const result = []
  const maxValue = (1 << to) - 1
  for (const value of data) {
    if (value < 0 || value >> from !== 0) throw new Error('Invalid bit group')
    acc = (acc << from) | value
    bits += from
    while (bits >= to) {
      bits -= to
      result.push((acc >> bits) & maxValue)
    }
  }
  if (pad) {
    if (bits > 0) result.push((acc << (to - bits)) & maxValue)
  } else if (bits >= from || ((acc << (to - bits)) & maxValue) !== 0) {
    throw new Error('Invalid padding')
  }
  return result
}

function wordsToHex (words) {
  const bytes = convertBits(words, 5, 8, false)
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function wordsToText (words) {
  const bytes = convertBits(words, 5, 8, false)
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function wordsToInt (words) {
  return words.reduce((total, word) => (total * 32) + word, 0)
}

/** BOLT11 amount part: `lnbc670n` -> 67 sats, `lnbc1m` -> 100,000 sats. */
export function bolt11AmountMsats (hrp) {
  const match = /^lnbc(\d*)([munp])?$/.exec(String(hrp || '').toLowerCase())
  if (!match) return null
  const digits = match[1]
  if (!digits) return null
  const value = Number(digits)
  if (!Number.isFinite(value)) return null
  const multiplier = match[2] || ''
  const msatsPerUnit = {
    '': MSATS_PER_BTC,
    m: 100000000,
    u: 100000,
    n: 100,
    p: 0.1
  }[multiplier]
  if (!Number.isFinite(msatsPerUnit)) return null
  return Math.round(value * msatsPerUnit * 1000) / 1000
}

/**
 * Decode a mainnet BOLT11 invoice locally.
 *
 * This verifies the bech32 checksum and reads the amount, timestamp, expiry,
 * payment hash and description. It does not verify the signature; the bridge
 * is still the payer and validates the invoice before spending.
 */
export function decodeBolt11 (value, now = Date.now()) {
  const raw = String(value || '').trim().replace(/^lightning:/i, '').trim()
  if (!raw) return { valid: false, error: 'Paste a Lightning invoice.' }
  if (!/^lnbc/i.test(raw)) {
    return { valid: false, error: 'Only mainnet BOLT11 invoices (lnbc…) are supported here.' }
  }

  try {
    const { hrp, words } = bech32Decode(raw)
    if (words.length < 7) return { valid: false, error: 'Invoice data is incomplete.' }

    let timestamp = 0
    for (let i = 0; i < 7; i++) timestamp = (timestamp * 32) + words[i]

    let amountMsats = bolt11AmountMsats(hrp)
    let expirySeconds = 3600
    let description = ''
    let descriptionHash = ''
    let paymentHash = ''
    let payeeNode = ''

    let index = 7
    while (index + 3 <= words.length) {
      const tag = words[index]
      const length = (words[index + 1] << 5) | words[index + 2]
      const data = words.slice(index + 3, index + 3 + length)
      index += 3 + length
      if (data.length !== length) break

      if (tag === 1) paymentHash = wordsToHex(data) // p
      else if (tag === 19) payeeNode = wordsToHex(data) // n
      else if (tag === 13) description = wordsToText(data) // d
      else if (tag === 23) descriptionHash = wordsToHex(data) // h
      else if (tag === 6) expirySeconds = wordsToInt(data) // x
    }

    const expiresAt = (timestamp + expirySeconds) * 1000
    const amountSats = amountMsats === null ? null : amountMsats / 1000
    return {
      valid: true,
      error: '',
      network: 'bitcoin',
      amountMsats,
      amountSats,
      hasAmount: amountSats !== null && amountSats > 0,
      timestamp,
      expirySeconds,
      expiresAt,
      expired: Number.isFinite(expiresAt) && expiresAt <= now,
      description: description || (descriptionHash ? 'Description is hashed' : ''),
      descriptionHash,
      paymentHash,
      payeeNode,
      hrp,
      raw
    }
  } catch (error) {
    return { valid: false, error: error?.message || 'Could not decode this invoice.' }
  }
}

