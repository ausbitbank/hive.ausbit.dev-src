// Banksia Vault — payload transport helpers (banksia.vault@1).
//
// The composer splits a post into a public teaser and a premium payload, then
// encrypts the premium part. Small payloads travel inline in
// `json_metadata.banksia_vault`; larger ones travel as companion comments
// (`parts`). This module owns the marker, the metadata schema, size policy and
// multi-part encryption glue. It never renders or stores plaintext.

import {
  CONTENT_AAD_PREFIX,
  VAULT_ALG,
  VaultCryptoError,
  base64UrlDecode,
  decryptPayload,
  encryptPayload,
  sha256Base64Url
} from './vaultCrypto'

export const VAULT_MARKER = '<!--banksia:vault-->'
export const INLINE_CIPHERTEXT_MAX = 40000
export const MAX_PLAINTEXT_INLINE = 30000
export const MAX_BODY_BYTES = 65535

const COMMENT_PLAINTEXT_MAX = 90000
const MODES = new Set(['section', 'post'])
const KID_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/
const PAYWALL_TITLE_MAX = 80
const PAYWALL_BODY_MAX = 240
const PAYWALL_BENEFITS_MAX = 6
const PAYWALL_BENEFIT_MAX = 80
const HASH_HEX_RE = /^sha256:[0-9a-f]{64}$/
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/

function isPlainObject (value) {
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value)
  // Cross-realm plain objects: proto is that realm's Object.prototype, whose
  // own prototype is null. Class instances have a deeper chain.
  return proto === null || Object.getPrototypeOf(proto) === null
}

function asString (value) {
  return typeof value === 'string' ? value : (value === undefined || value === null ? '' : String(value))
}

function parseJsonObject (value) {
  let root = value
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root)
    } catch {
      return null
    }
  }
  return isPlainObject(root) ? root : null
}

/**
 * Split a post body into public and premium parts.
 *
 * In `section` mode the first `<!--banksia:vault-->` marker separates them; in
 * `post` mode the whole body is the teaser and the premium text is supplied
 * separately. Slices are raw (no trimming) so `joinVaultBody(publicBody)`
 * reproduces the published body exactly.
 */
export function splitVaultBody (body, mode = 'section') {
  const source = asString(body)
  if (mode === 'post') return { publicBody: source, premiumBody: '', hasMarker: false }

  const index = source.indexOf(VAULT_MARKER)
  if (index === -1) return { publicBody: source, premiumBody: '', hasMarker: false }
  return {
    publicBody: source.slice(0, index),
    premiumBody: source.slice(index + VAULT_MARKER.length),
    hasMarker: true
  }
}

/**
 * Resolve the public/premium split for either composer mode.
 *
 * In `section` mode an existing marker always wins; otherwise `premiumBody`
 * supplied by the composer is used as-is. In `post` mode the body is the teaser
 * and `premiumBody` is the locked content.
 */
export function splitVaultPost ({ body = '', premiumBody = '', mode = 'section' } = {}) {
  if (mode === 'post') {
    return { publicBody: asString(body), premiumBody: asString(premiumBody), hasMarker: false }
  }
  const split = splitVaultBody(body, 'section')
  if (split.hasMarker) return split
  return {
    publicBody: split.publicBody,
    premiumBody: asString(premiumBody),
    hasMarker: false
  }
}

/** Append the lock marker for section mode; `post` mode is unchanged. */
export function joinVaultBody (publicBody, mode = 'section') {
  const source = asString(publicBody)
  if (mode === 'post') return source
  if (source.endsWith(VAULT_MARKER)) return source
  return source + VAULT_MARKER
}

/** Insert the lock marker at a clamped character index. */
export function insertVaultMarker (body, index) {
  const source = asString(body)
  const position = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : source.length
  const clamped = Math.min(Math.max(position, 0), source.length)
  return source.slice(0, clamped) + VAULT_MARKER + source.slice(clamped)
}

/** Remove every lock marker from a body. */
export function removeVaultMarker (body) {
  return asString(body).split(VAULT_MARKER).join('')
}

function normalizePaywall (paywall, { strict = false } = {}) {
  if (paywall === undefined || paywall === null) return null
  if (!isPlainObject(paywall)) {
    if (strict) throw new Error('paywall must be an object')
    return null
  }

  const title = asString(paywall.title).trim()
  const body = asString(paywall.body).trim()
  const benefits = Array.isArray(paywall.benefits)
    ? paywall.benefits.map(item => asString(item).trim()).filter(Boolean)
    : []

  if (title.length > PAYWALL_TITLE_MAX) {
    if (strict) throw new Error(`paywall.title must be at most ${PAYWALL_TITLE_MAX} characters`)
    return null
  }
  if (body.length > PAYWALL_BODY_MAX) {
    if (strict) throw new Error(`paywall.body must be at most ${PAYWALL_BODY_MAX} characters`)
    return null
  }
  if (benefits.length > PAYWALL_BENEFITS_MAX) {
    if (strict) throw new Error(`paywall.benefits must have at most ${PAYWALL_BENEFITS_MAX} items`)
    return null
  }
  if (benefits.some(item => item.length > PAYWALL_BENEFIT_MAX)) {
    if (strict) throw new Error(`each paywall benefit must be at most ${PAYWALL_BENEFIT_MAX} characters`)
    return null
  }

  return { title, body, benefits }
}

function isHashRef (value) {
  if (typeof value !== 'string' || !value) return false
  if (HASH_HEX_RE.test(value)) return true
  if (!BASE64URL_RE.test(value)) return false
  try {
    return base64UrlDecode(value).length === 32
  } catch {
    return false
  }
}

function isPositiveInteger (value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * Build `json_metadata.banksia_vault` for a premium post.
 *
 * Exactly one of `ct` (inline ciphertext, requires `iv`) or `parts` (companion
 * comment payloads) must be present. `bytes` is the plaintext byte length and
 * `hash` is `sha256:<hex>`. Throws `Error` on invalid input.
 */
export function buildVaultMetadata ({
  mode,
  kid,
  iv,
  ct,
  hash,
  bytes,
  tier = 'member',
  price,
  product,
  container,
  paywall,
  parts
} = {}) {
  if (!MODES.has(mode)) throw new Error('mode must be "section" or "post"')
  if (typeof kid !== 'string' || !KID_RE.test(kid.trim())) throw new Error('kid must be YYYY-MM')
  if (typeof hash !== 'string' || !isHashRef(hash)) throw new Error('hash must be sha256:<hex> or a base64url SHA-256')
  if (!isPositiveInteger(bytes)) throw new Error('bytes must be a non-negative integer')
  if (typeof tier !== 'string' || !tier.trim()) throw new Error('tier must be a non-empty string')

  const hasCt = typeof ct === 'string' && ct.length > 0
  const hasParts = Array.isArray(parts) && parts.length > 0
  if (hasCt === hasParts) throw new Error('exactly one of ct or parts is required')

  const metadata = {
    v: 1,
    mode,
    alg: VAULT_ALG,
    kid: kid.trim()
  }

  if (hasCt) {
    if (typeof iv !== 'string' || !iv) throw new Error('iv is required with inline ciphertext')
    metadata.iv = iv
    metadata.ct = ct
  } else {
    if (!parts.every(part => typeof part === 'string' && part.length > 0)) {
      throw new Error('parts must be non-empty strings')
    }
    metadata.parts = [...parts]
  }

  metadata.hash = hash
  metadata.bytes = bytes
  metadata.tier = tier.trim()

  if (price !== undefined && price !== null) {
    if (typeof price !== 'string' || price.length > 32) throw new Error('price must be a short string')
    metadata.price = price
  }
  if (product !== undefined && product !== null) {
    if (typeof product !== 'string' || !product.includes('/')) throw new Error('product must be "author/permlink"')
    metadata.product = product
  }
  if (container !== undefined && container !== null) {
    if (typeof container !== 'string' || !container) throw new Error('container must be a permlink')
    metadata.container = container
  }

  const normalizedPaywall = normalizePaywall(paywall, { strict: true })
  if (normalizedPaywall) metadata.paywall = normalizedPaywall

  return metadata
}

function extractMetadata (value) {
  const root = parseJsonObject(value)
  if (!root) return null
  if (isPlainObject(root.banksia_vault)) return root.banksia_vault
  return root
}

/**
 * Parse and validate `banksia_vault` metadata from a JSON string or object.
 *
 * Accepts the wrapped `{ banksia_vault: {...} }` form or the bare metadata
 * object. Returns a normalised copy with only known fields, or null.
 */
export function parseVaultMetadata (value) {
  const meta = extractMetadata(value)
  if (!meta) return null
  if (meta.v !== 1) return null
  if (!MODES.has(meta.mode)) return null
  if (meta.alg !== VAULT_ALG) return null
  if (typeof meta.kid !== 'string' || !meta.kid.trim()) return null

  const hasCt = typeof meta.ct === 'string' && meta.ct.length > 0
  const hasParts = Array.isArray(meta.parts) && meta.parts.length > 0
  if (hasCt === hasParts) return null
  if (hasCt && (typeof meta.iv !== 'string' || !meta.iv)) return null
  if (hasParts && !meta.parts.every(part => typeof part === 'string' && part.length > 0)) return null

  if (!isHashRef(meta.hash)) return null
  if (!isPositiveInteger(meta.bytes)) return null

  const normalized = {
    v: 1,
    mode: meta.mode,
    alg: VAULT_ALG,
    kid: meta.kid.trim()
  }
  if (hasCt) {
    normalized.iv = meta.iv
    normalized.ct = meta.ct
  } else {
    normalized.parts = [...meta.parts]
  }
  normalized.hash = meta.hash
  normalized.bytes = meta.bytes
  normalized.tier = typeof meta.tier === 'string' && meta.tier ? meta.tier : 'member'

  for (const field of ['price', 'product', 'container']) {
    if (typeof meta[field] === 'string' && meta[field]) normalized[field] = meta[field]
  }

  const paywall = normalizePaywall(meta.paywall)
  if (paywall) normalized.paywall = paywall

  return normalized
}

/**
 * Validate vault metadata and return readable errors.
 *
 * `{ ok: true, errors: [] }` means the payload can be decrypted; it does not
 * test cryptography.
 */
export function validateVaultMetadata (meta) {
  const errors = []
  const value = extractMetadata(meta)
  if (!value) return { ok: false, errors: ['banksia_vault must be an object or JSON object'] }

  if (value.v !== 1) errors.push('v must be 1')
  if (!MODES.has(value.mode)) errors.push('mode must be "section" or "post"')
  if (value.alg !== VAULT_ALG) errors.push(`alg must be "${VAULT_ALG}"`)
  if (typeof value.kid !== 'string' || !value.kid.trim()) errors.push('kid is required')

  const hasCt = typeof value.ct === 'string' && value.ct.length > 0
  const hasParts = Array.isArray(value.parts) && value.parts.length > 0
  if (hasCt === hasParts) errors.push('exactly one of ct or parts is required')
  if (hasCt) {
    if (typeof value.iv !== 'string' || !value.iv) {
      errors.push('iv is required with inline ciphertext')
    } else {
      try {
        if (base64UrlDecode(value.iv).length !== 12) errors.push('iv must be 12 bytes')
      } catch {
        errors.push('iv must be base64url')
      }
    }
  }
  if (hasParts && !value.parts.every(part => typeof part === 'string' && part.length > 0)) {
    errors.push('parts must be non-empty strings')
  }

  if (!isHashRef(value.hash)) errors.push('hash must be sha256:<hex> or a base64url SHA-256')
  if (!isPositiveInteger(value.bytes)) errors.push('bytes must be a non-negative integer')
  if (typeof value.tier !== 'string' || !value.tier) errors.push('tier must be a non-empty string')

  if (value.paywall !== undefined && value.paywall !== null) {
    if (!isPlainObject(value.paywall)) {
      errors.push('paywall must be an object')
    } else {
      if (asString(value.paywall.title).length > PAYWALL_TITLE_MAX) {
        errors.push(`paywall.title must be at most ${PAYWALL_TITLE_MAX} characters`)
      }
      if (asString(value.paywall.body).length > PAYWALL_BODY_MAX) {
        errors.push(`paywall.body must be at most ${PAYWALL_BODY_MAX} characters`)
      }
      if (Array.isArray(value.paywall.benefits)) {
        if (value.paywall.benefits.length > PAYWALL_BENEFITS_MAX) {
          errors.push(`paywall.benefits must have at most ${PAYWALL_BENEFITS_MAX} items`)
        }
        if (value.paywall.benefits.some(item => asString(item).length > PAYWALL_BENEFIT_MAX)) {
          errors.push(`each paywall benefit must be at most ${PAYWALL_BENEFIT_MAX} characters`)
        }
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Merge a `banksia_vault` block into a post's json_metadata object. */
export function mergeVaultMetadata (metadata, vaultMeta) {
  const root = parseJsonObject(metadata)
  const next = root ? { ...root } : {}
  if (vaultMeta === undefined || vaultMeta === null) {
    delete next.banksia_vault
  } else {
    next.banksia_vault = vaultMeta
  }
  return next
}

/** Copy json_metadata without `banksia_vault`. */
export function stripVaultMetadata (metadata) {
  const root = parseJsonObject(metadata)
  const next = root ? { ...root } : {}
  delete next.banksia_vault
  return next
}

/** base64url length of the ciphertext for a given plaintext byte length. */
export function estimateCiphertextLength (plaintextBytes) {
  const bytes = Number(plaintextBytes)
  if (!Number.isFinite(bytes) || bytes <= 0) return 0
  return 4 * Math.ceil(bytes / 3)
}

/**
 * Choose the transport for a payload:
 * `inline` up to 30,000 plaintext bytes, `comment` up to 90,000, else
 * `too-large`.
 */
export function chooseVaultTransport (plaintextBytes) {
  const bytes = Number(plaintextBytes)
  if (!Number.isFinite(bytes) || bytes < 0) return 'too-large'
  if (bytes <= MAX_PLAINTEXT_INLINE) return 'inline'
  if (bytes <= COMMENT_PLAINTEXT_MAX) return 'comment'
  return 'too-large'
}

function utf8Length (char) {
  const code = char.codePointAt(0)
  if (code <= 0x7f) return 1
  if (code <= 0x7ff) return 2
  if (code <= 0xffff) return 3
  return 4
}

function splitUtf8 (plaintext, chunkSize) {
  const parts = []
  let current = ''
  let bytes = 0
  for (const char of plaintext) {
    const size = utf8Length(char)
    if (bytes > 0 && bytes + size > chunkSize) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts
}

/**
 * Split plaintext on UTF-8 code-point boundaries and encrypt each part.
 *
 * Every part uses the same content key and the same AAD header, so callers can
 * decrypt parts independently with `decryptPayload`. Each returned object adds
 * `part` (1-based) and `parts` (total).
 */
export async function chunkVaultPayload (plaintext, contentKeyB64, header, { chunkSize = 30000 } = {}) {
  if (typeof plaintext !== 'string') throw new VaultCryptoError('VAULT_BAD_INPUT', 'chunkVaultPayload expects a string.')
  const size = Number(chunkSize)
  if (!Number.isInteger(size) || size < 1) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'chunkSize must be a positive integer.')
  }

  const textParts = splitUtf8(plaintext, size)
  const encrypted = []
  for (const text of textParts) {
    encrypted.push(await encryptPayload(text, contentKeyB64, header))
  }
  return encrypted.map((payload, index) => ({
    ...payload,
    part: index + 1,
    parts: encrypted.length
  }))
}

/**
 * Decrypt multi-part payloads in order and concatenate them.
 *
 * Each part's hash is verified by `decryptPayload`; a tag or hash failure
 * throws the corresponding typed error and no partial plaintext is returned.
 */
export async function decryptVaultParts (parts, contentKeyB64, header) {
  if (!Array.isArray(parts) || !parts.length) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'decryptVaultParts expects a non-empty parts array.')
  }
  const ordered = parts
    .map((payload, index) => ({ payload, index }))
    .sort((left, right) => {
      const leftPart = Number.isInteger(left.payload && left.payload.part) ? left.payload.part : left.index + 1
      const rightPart = Number.isInteger(right.payload && right.payload.part) ? right.payload.part : right.index + 1
      return leftPart - rightPart
    })
    .map(item => item.payload)

  let plaintext = ''
  for (const payload of ordered) {
    plaintext += await decryptPayload(payload, contentKeyB64, header)
  }
  return plaintext
}

/** UTF-8 byte length of a metadata object when serialised as JSON. */
export function vaultMetadataSize (meta) {
  try {
    return new TextEncoder().encode(JSON.stringify(meta)).length
  } catch {
    return 0
  }
}

/** Re-exported for callers that build AAD strings or hashes directly. */
export const VAULT_PAYLOAD_AAD_PREFIX = CONTENT_AAD_PREFIX

/** SHA-256 over the canonical plaintext, base64url; mirrors `encryptPayload`. */
export async function payloadHash (plaintext) {
  return sha256Base64Url(plaintext)
}
