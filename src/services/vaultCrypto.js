// Banksia Vault — WebCrypto primitives (banksia.vault@1).
//
// The vault keeps plaintext off-chain. Content keys are AES-256-GCM, the
// per-period ring key seals the keyring blob, and reader keys are P-256 ECDH
// keys that wrap the ring key with HKDF-SHA256.
//
// Everything here uses `globalThis.crypto.subtle` only. There is no Node-only
// API and no new dependency. Callers receive typed `VaultCryptoError`s so the UI
// can render a safe error without ever exposing partial plaintext.

export const VAULT_VERSION = 1
export const VAULT_ALG = 'A256GCM'
export const VAULT_WRAP_ALG = 'P256-HKDF-SHA256-A256GCM'
export const VAULT_WRAP_INFO_PREFIX = 'banksia.vault.wrap.v1'

export const CONTENT_AAD_PREFIX = 'banksia.vault.content.v1'
export const KEYRING_AAD_PREFIX = 'banksia.vault.keyring.v1'
export const BULLETIN_SIG_PREFIX = 'banksia.vault.bulletin.v1'
export const GRANT_SIG_PREFIX = 'banksia.vault.grant.v1'
export const DELEGATION_SIG_PREFIX = 'banksia.vault.delegation.v1'

const P256_UNCOMPRESSED_BYTES = 65
const P256_COORDINATE_BYTES = 32
const AES_KEY_BYTES = 32
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16
const READER_KEY_PREFIX = 'p256:'
const BASE64URL_RE = /^[A-Za-z0-9_-]*$/
const HEX_64_RE = /^[0-9a-f]{64}$/

/** A typed vault failure. `code` is stable for callers and tests. */
export class VaultCryptoError extends Error {
  constructor (code, message, options = {}) {
    super(message || code)
    this.name = 'VaultCryptoError'
    this.code = code
    if (options && options.cause !== undefined) this.cause = options.cause
  }
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const proto = Object.getPrototypeOf(value)
  // Cross-realm plain objects: proto is that realm's Object.prototype, whose
  // own prototype is null. Class instances have a deeper chain.
  return proto === null || Object.getPrototypeOf(proto) === null
}

function isCryptoKey (value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    value.algorithm &&
    typeof value.algorithm.name === 'string' &&
    Array.isArray(value.usages)
  )
}

function subtle () {
  const api = globalThis.crypto && globalThis.crypto.subtle
  if (!api) throw new VaultCryptoError('VAULT_UNAVAILABLE', 'WebCrypto is not available in this environment.')
  return api
}

function isBytesLike (value) {
  return ArrayBuffer.isView(value) || Object.prototype.toString.call(value) === '[object ArrayBuffer]'
}

function toBytes (value, label = 'value') {
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') return new Uint8Array(value)
  if (Array.isArray(value)) return Uint8Array.from(value)
  throw new VaultCryptoError('VAULT_BAD_INPUT', `${label} must be bytes.`)
}

function concatBytes (...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function bytesToHex (bytes) {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

const utf8Encoder = new TextEncoder()

function utf8 (value) {
  return utf8Encoder.encode(String(value))
}

/**
 * Canonical JSON: recursively sorted object keys, no whitespace, UTF-8 safe.
 *
 * Accepts objects, arrays, strings, booleans and null; numbers must be finite
 * integers (floats are rejected by protocol). `undefined`, functions, symbols,
 * BigInt, non-plain objects and cycles throw `VAULT_BAD_INPUT`.
 */
export function canonicalJson (value) {
  return serializeCanonical(value, new Set())
}

function serializeCanonical (value, seen) {
  if (value === null) return 'null'

  const type = typeof value
  if (type === 'string') return JSON.stringify(value)
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new VaultCryptoError('VAULT_BAD_INPUT', 'Canonical JSON rejects non-integer numbers.')
    }
    return JSON.stringify(value)
  }
  if (type === 'undefined') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Canonical JSON rejects undefined values.')
  }
  if (type !== 'object') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `Canonical JSON rejects ${type} values.`)
  }

  if (seen.has(value)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'Canonical JSON rejects cyclic structures.')
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Canonical JSON accepts plain objects and arrays only.')
  }

  seen.add(value)
  let out
  if (Array.isArray(value)) {
    const items = value.map(item => serializeCanonical(item, seen))
    out = `[${items.join(',')}]`
  } else {
    const keys = Object.keys(value).sort()
    const fields = keys.map(key => `${JSON.stringify(key)}:${serializeCanonical(value[key], seen)}`)
    out = `{${fields.join(',')}}`
  }
  seen.delete(value)
  return out
}

/**
 * Base64url (RFC 4648 §5) without padding.
 *
 * Accepts a `Uint8Array`, any `ArrayBuffer` view, or an `ArrayBuffer`.
 */
export function base64UrlEncode (bytesOrArrayBuffer) {
  const bytes = toBytes(bytesOrArrayBuffer, 'Base64url input')
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk))
  }
  const base64 = globalThis.btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a base64url string. Throws `VAULT_BAD_INPUT` on malformed input. */
export function base64UrlDecode (str) {
  if (typeof str !== 'string') throw new VaultCryptoError('VAULT_BAD_INPUT', 'Base64url input must be a string.')
  const cleaned = str.trim().replace(/=+$/, '')
  if (!BASE64URL_RE.test(cleaned) || cleaned.length % 4 === 1) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Invalid base64url string.')
  }
  const padded = cleaned.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (cleaned.length % 4)) % 4)
  let binary
  try {
    binary = globalThis.atob(padded)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'Invalid base64url string.', { cause: error })
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Cryptographically random bytes from the platform CSPRNG. */
export function randomBytes (n) {
  const length = Number(n)
  if (!Number.isInteger(length) || length < 0 || length > 65536) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'randomBytes expects an integer between 0 and 65536.')
  }
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/** A fresh 256-bit raw AES content key, base64url encoded. */
export function randomKey () {
  return base64UrlEncode(randomBytes(AES_KEY_BYTES))
}

function rawKeyBytes (keyB64, label = 'content key') {
  let bytes
  try {
    bytes = base64UrlDecode(keyB64)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', `The ${label} is not valid base64url.`, { cause: error })
  }
  if (bytes.length !== AES_KEY_BYTES) {
    throw new VaultCryptoError('VAULT_BAD_KEY', `The ${label} must be 32 bytes.`)
  }
  return bytes
}

/** Import a raw AES-256-GCM content key from base64url. */
export async function importContentKey (rawB64) {
  const bytes = rawKeyBytes(rawB64)
  try {
    return await subtle().importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The content key could not be imported.', { cause: error })
  }
}

/** Export an AES content key as base64url. */
export async function exportContentKey (key) {
  if (!isCryptoKey(key) || key.type !== 'secret') {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'exportContentKey expects an AES CryptoKey.')
  }
  if (!key.extractable) throw new VaultCryptoError('VAULT_BAD_KEY', 'The content key is not extractable.')
  const raw = await subtle().exportKey('raw', key)
  return base64UrlEncode(raw)
}

/** SHA-256 of a UTF-8 string or bytes, as base64url. */
export async function sha256Base64Url (value) {
  const bytes = typeof value === 'string' ? utf8(value) : toBytes(value, 'sha256 input')
  const digest = await subtle().digest('SHA-256', bytes)
  return base64UrlEncode(digest)
}

/** SHA-256 of a UTF-8 string or bytes, as lowercase hex. */
export async function sha256Hex (value) {
  const bytes = typeof value === 'string' ? utf8(value) : toBytes(value, 'sha256 input')
  const digest = await subtle().digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

/** SHA-256 of a UTF-8 string or bytes, as raw bytes. */
export async function sha256Bytes (value) {
  const bytes = typeof value === 'string' ? utf8(value) : toBytes(value, 'sha256 input')
  const digest = await subtle().digest('SHA-256', bytes)
  return new Uint8Array(digest)
}

function normalizePublicKeyBytes (value) {
  if (isBytesLike(value)) {
    return toBytes(value, 'reader public key')
  }
  if (isPlainObject(value) && value.publicKey !== undefined) return normalizePublicKeyBytes(value.publicKey)
  if (typeof value === 'string') {
    const raw = value.trim().startsWith(READER_KEY_PREFIX)
      ? value.trim().slice(READER_KEY_PREFIX.length)
      : value.trim()
    if (!raw) throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader public key is empty.')
    return base64UrlDecode(raw)
  }
  throw new VaultCryptoError('VAULT_BAD_KEY', 'Unsupported reader public key format.')
}

/**
 * Import a reader public key from `p256:<base64url>`, bare base64url, raw
 * bytes, a JWK, a CryptoKey, or a `{ publicKey }` pair.
 *
 * Import is what validates that the point is on the P-256 curve; malformed or
 * off-curve points throw `VAULT_BAD_KEY`.
 */
export async function importReaderPublicKey (rawOrJwkOrKey) {
  try {
    if (isCryptoKey(rawOrJwkOrKey)) {
      if (rawOrJwkOrKey.type !== 'public') throw new VaultCryptoError('VAULT_BAD_KEY', 'A reader public key is required.')
      return rawOrJwkOrKey
    }
    if (isPlainObject(rawOrJwkOrKey) && typeof rawOrJwkOrKey.kty === 'string') {
      if (rawOrJwkOrKey.kty !== 'EC' || rawOrJwkOrKey.crv !== 'P-256') {
        throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader JWK must be an EC P-256 key.')
      }
      return await subtle().importKey('jwk', rawOrJwkOrKey, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
    }
    const bytes = normalizePublicKeyBytes(rawOrJwkOrKey)
    if (bytes.length !== P256_UNCOMPRESSED_BYTES || bytes[0] !== 0x04) {
      throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader public key must be a 65-byte uncompressed P-256 point.')
    }
    return await subtle().importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  } catch (error) {
    if (error instanceof VaultCryptoError) throw error
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader public key is invalid.', { cause: error })
  }
}

/** Import a reader private JWK for recovery. Non-extractable by default. */
export async function importReaderPrivateKey (jwk, { extractable = false } = {}) {
  if (!isPlainObject(jwk) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader private JWK must be an EC P-256 key.')
  }
  try {
    return await subtle().importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, Boolean(extractable), ['deriveBits'])
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader private key could not be imported.', { cause: error })
  }
}

/**
 * Generate a P-256 ECDH reader keypair.
 *
 * `extractable` controls the private key only; WebCrypto always makes the
 * public key exportable. `publicKeyB64` is the canonical `p256:` form.
 */
export async function generateReaderKeyPair ({ extractable = false } = {}) {
  try {
    const pair = await subtle().generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      Boolean(extractable),
      ['deriveBits']
    )
    const publicKeyB64 = await exportReaderPublicKey(pair.publicKey)
    return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64 }
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader keypair could not be generated.', { cause: error })
  }
}

/** Export a reader public key (or keypair) as `p256:<base64url>`. */
export async function exportReaderPublicKey (keyOrPair) {
  let key = keyOrPair
  if (isPlainObject(key) && key.publicKey !== undefined) key = key.publicKey
  if (!isCryptoKey(key) || key.type !== 'public') {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'exportReaderPublicKey expects a reader public CryptoKey.')
  }
  try {
    const raw = await subtle().exportKey('raw', key)
    return READER_KEY_PREFIX + base64UrlEncode(raw)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader public key could not be exported.', { cause: error })
  }
}

/** Export a reader private key as JWK. Only extractable keys can be exported. */
export async function exportReaderPrivateJwk (privateKey) {
  if (!isCryptoKey(privateKey) || privateKey.type !== 'private') {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'exportReaderPrivateJwk expects a reader private CryptoKey.')
  }
  if (!privateKey.extractable) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader private key is not extractable.')
  }
  try {
    return await subtle().exportKey('jwk', privateKey)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader private key could not be exported.', { cause: error })
  }
}

/** Raw 65-byte uncompressed point for a reader key, `p256:` string or pair. */
export async function readerPublicKeyBytes (keyOrB64) {
  if (typeof keyOrB64 === 'string' || isBytesLike(keyOrB64)) {
    const bytes = normalizePublicKeyBytes(keyOrB64)
    if (bytes.length !== P256_UNCOMPRESSED_BYTES || bytes[0] !== 0x04) {
      throw new VaultCryptoError('VAULT_BAD_KEY', 'The reader public key must be a 65-byte uncompressed P-256 point.')
    }
    return bytes
  }
  if (isCryptoKey(keyOrB64) && keyOrB64.type === 'private') {
    const jwk = await exportReaderPrivateJwk(keyOrB64)
    return readerPublicKeyBytes({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y })
  }
  const key = await importReaderPublicKey(keyOrB64)
  const raw = await subtle().exportKey('raw', key)
  return new Uint8Array(raw)
}

/**
 * Reader key thumbprint (`rkt`): the first 16 lowercase hex characters of
 * SHA-256 over the canonical 65-byte public key.
 */
export async function readerKeyThumbprint (publicKey) {
  const bytes = await readerPublicKeyBytes(publicKey)
  const digest = await sha256Bytes(bytes)
  return bytesToHex(digest).slice(0, 16)
}

/** Raw ECDH shared secret between a private key and a peer public key. */
export async function ecdhSharedSecret (privateKey, publicKey) {
  if (!isCryptoKey(privateKey) || privateKey.type !== 'private') {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'ECDH requires a private CryptoKey.')
  }
  const peer = await importReaderPublicKey(publicKey)
  try {
    const bits = await subtle().deriveBits({ name: 'ECDH', public: peer }, privateKey, 256)
    return new Uint8Array(bits)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'ECDH key agreement failed.', { cause: error })
  }
}

async function hkdfWrapKey (sharedSecret, readerBytes, epkBytes, header) {
  const salt = concatBytes(epkBytes, readerBytes, utf8(VAULT_WRAP_INFO_PREFIX))
  const info = utf8(canonicalJson(header))
  try {
    const hkdfKey = await subtle().importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
    return await subtle().deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The ring wrapping key could not be derived.', { cause: error })
  }
}

function normalizeEpkBytes (epk) {
  const bytes = typeof epk === 'string' ? base64UrlDecode(epk) : toBytes(epk, 'ephemeral public key')
  if (bytes.length !== P256_UNCOMPRESSED_BYTES || bytes[0] !== 0x04) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The ephemeral public key must be a 65-byte uncompressed P-256 point.')
  }
  return bytes
}

async function aesGcmEncrypt (key, plaintextBytes, iv, aadBytes) {
  try {
    const ct = await subtle().encrypt(
      { name: 'AES-GCM', iv, additionalData: aadBytes, tagLength: 128 },
      key,
      plaintextBytes
    )
    return new Uint8Array(ct)
  } catch (error) {
    throw new VaultCryptoError('VAULT_TAG', 'The payload could not be encrypted.', { cause: error })
  }
}

async function aesGcmDecrypt (key, ciphertextBytes, iv, aadBytes) {
  if (ciphertextBytes.length < GCM_TAG_BYTES) {
    throw new VaultCryptoError('VAULT_TAG', 'The ciphertext is too short to contain an AES-GCM tag.')
  }
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv, additionalData: aadBytes, tagLength: 128 },
      key,
      ciphertextBytes
    )
    return new Uint8Array(plain)
  } catch (error) {
    throw new VaultCryptoError('VAULT_TAG', 'Decryption failed: the key, IV or authenticated data does not match.', { cause: error })
  }
}

async function importAesKey (rawB64, label) {
  const bytes = rawKeyBytes(rawB64, label)
  try {
    return await subtle().importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', `The ${label} could not be imported.`, { cause: error })
  }
}

function assertHeaderObject (header, label = 'header') {
  if (!isPlainObject(header)) throw new VaultCryptoError('VAULT_BAD_INPUT', `The ${label} must be an object.`)
}

function requireHeaderString (header, key) {
  if (typeof header[key] !== 'string' || !header[key]) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `The header is missing "${key}".`)
  }
}

/**
 * Derive the AES-256-GCM KEK that wraps the ring key.
 *
 * ECDH is performed between `privateKey` and `readerPublicKey` (the wrap
 * direction: an ephemeral private key and the reader's public key). The salt
 * binds the ephemeral public key, the reader public key and the domain prefix;
 * the HKDF info and the AES-GCM AAD are the canonical grant header.
 */
export async function deriveWrapKey (privateKey, readerPublicKey, epkBytes, header) {
  assertHeaderObject(header)
  const readerKey = await importReaderPublicKey(readerPublicKey)
  const readerBytes = await readerPublicKeyBytes(readerKey)
  const epk = normalizeEpkBytes(epkBytes)
  const secret = await ecdhSharedSecret(privateKey, readerKey)
  return hkdfWrapKey(secret, readerBytes, epk, header)
}

/**
 * Wrap the raw 32-byte ring key to a reader public key.
 *
 * Returns a bulletin entry body: `{ alg, epk, iv, ct }`. `alg` names the
 * complete wrap construction (`VAULT_WRAP_ALG`); the AES-GCM layer is implied.
 */
export async function wrapRingKey (ringKeyB64, readerPublicKey, header) {
  assertHeaderObject(header)
  const ringBytes = rawKeyBytes(ringKeyB64, 'ring key')
  const readerKey = await importReaderPublicKey(readerPublicKey)
  const readerBytes = await readerPublicKeyBytes(readerKey)

  let ephemeral
  try {
    ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The ephemeral wrapping key could not be generated.', { cause: error })
  }

  const epkBytes = new Uint8Array(await subtle().exportKey('raw', ephemeral.publicKey))
  const secret = await ecdhSharedSecret(ephemeral.privateKey, readerKey)
  const kek = await hkdfWrapKey(secret, readerBytes, epkBytes, header)
  const headerBytes = utf8(canonicalJson(header))
  const iv = randomBytes(GCM_IV_BYTES)
  const ct = await aesGcmEncrypt(kek, ringBytes, iv, headerBytes)

  return {
    alg: VAULT_WRAP_ALG,
    epk: base64UrlEncode(epkBytes),
    iv: base64UrlEncode(iv),
    ct: base64UrlEncode(ct)
  }
}

async function readerPublicKeyForUnwrap (readerPrivateKey, readerPublicKey) {
  if (isReaderPairLike(readerPrivateKey)) {
    const pair = readerPrivateKey
    return { privateKey: pair.privateKey, publicKey: await readerPublicKeyBytes(pair.publicKey) }
  }
  if (readerPublicKey !== undefined && readerPublicKey !== null) {
    return { privateKey: readerPrivateKey, publicKey: await readerPublicKeyBytes(readerPublicKey) }
  }
  if (isCryptoKey(readerPrivateKey) && readerPrivateKey.extractable) {
    const jwk = await exportReaderPrivateJwk(readerPrivateKey)
    return {
      privateKey: readerPrivateKey,
      publicKey: await readerPublicKeyBytes({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y })
    }
  }
  throw new VaultCryptoError(
    'VAULT_BAD_KEY',
    'unwrapRingKey needs the reader public key for a non-extractable private key; pass it as the fourth argument.'
  )
}

function isReaderPairLike (value) {
  return Boolean(value && typeof value === 'object' && value.privateKey && value.publicKey)
}

/**
 * Unwrap a bulletin entry's ring key.
 *
 * `readerKey` may be a private CryptoKey or a `{ privateKey, publicKey }` pair.
 * `readerPublicKey` is required when the private key is non-extractable and a
 * bare CryptoKey is passed, because the HKDF salt binds the reader public key.
 * Returns the raw ring key as base64url.
 */
export async function unwrapRingKey (entry, readerKey, header, readerPublicKey = null) {
  assertHeaderObject(entry, 'wrapped ring key')
  if (typeof entry.epk !== 'string' || typeof entry.iv !== 'string' || typeof entry.ct !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The wrapped ring key is missing epk, iv or ct.')
  }
  if (entry.alg !== undefined && entry.alg !== VAULT_WRAP_ALG && entry.alg !== VAULT_ALG) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `Unsupported ring key wrap algorithm: ${entry.alg}`)
  }

  const resolved = await readerPublicKeyForUnwrap(readerKey, readerPublicKey)
  const epkBytes = normalizeEpkBytes(entry.epk)
  const epkKey = await importReaderPublicKey(epkBytes)
  const secret = await ecdhSharedSecret(resolved.privateKey, epkKey)
  const kek = await hkdfWrapKey(secret, resolved.publicKey, epkBytes, header)

  const iv = base64UrlDecode(entry.iv)
  if (iv.length !== GCM_IV_BYTES) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The wrapping IV must be 12 bytes.')
  const ct = base64UrlDecode(entry.ct)
  const ringBytes = await aesGcmDecrypt(kek, ct, iv, utf8(canonicalJson(header)))
  if (ringBytes.length !== AES_KEY_BYTES) {
    throw new VaultCryptoError('VAULT_BAD_KEY', 'The unwrapped ring key is not 32 bytes.')
  }
  return base64UrlEncode(ringBytes)
}

function keyringContextAad (context) {
  if (!isPlainObject(context)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring context must be an object.')
  const blog = String(context.blog || '')
  const period = String(context.period || '')
  if (!blog || !period) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring context needs blog and period.')
  return utf8(`${KEYRING_AAD_PREFIX}|${blog}|${period}`)
}

/**
 * Seal the keyring (`{ kid: rawKeyB64 }`) with the period ring key.
 *
 * AAD is `banksia.vault.keyring.v1|blog|period`.
 */
export async function sealKeyring (keyring, ringKeyB64, context) {
  let keyringObject = keyring
  if (typeof keyring === 'string') {
    try {
      keyringObject = JSON.parse(keyring)
    } catch (error) {
      throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring is not valid JSON.', { cause: error })
    }
  }
  if (!isPlainObject(keyringObject)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring must be an object.')

  const key = await importAesKey(ringKeyB64, 'ring key')
  const iv = randomBytes(GCM_IV_BYTES)
  const plaintext = utf8(canonicalJson(keyringObject))
  const ct = await aesGcmEncrypt(key, plaintext, iv, keyringContextAad(context))
  return { alg: VAULT_ALG, iv: base64UrlEncode(iv), ct: base64UrlEncode(ct) }
}

/** Open a sealed keyring. Tag failure throws `VAULT_TAG`. */
export async function openKeyring (sealed, ringKeyB64, context) {
  assertHeaderObject(sealed, 'sealed keyring')
  if (sealed.alg !== undefined && sealed.alg !== VAULT_ALG) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `Unsupported keyring algorithm: ${sealed.alg}`)
  }
  if (typeof sealed.iv !== 'string' || typeof sealed.ct !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The sealed keyring is missing iv or ct.')
  }
  const key = await importAesKey(ringKeyB64, 'ring key')
  const iv = base64UrlDecode(sealed.iv)
  if (iv.length !== GCM_IV_BYTES) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring IV must be 12 bytes.')
  const plain = await aesGcmDecrypt(key, base64UrlDecode(sealed.ct), iv, keyringContextAad(context))
  let parsed
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain))
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring could not be parsed.', { cause: error })
  }
  if (!isPlainObject(parsed)) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The keyring must decode to an object.')
  return parsed
}

function contentHeaderAad (header) {
  assertHeaderObject(header)
  for (const field of ['blog', 'permlink', 'kid', 'mode']) requireHeaderString(header, field)
  return utf8(`${CONTENT_AAD_PREFIX}|${header.blog}|${header.permlink}|${header.kid}|${header.mode}`)
}

function normalizeSha256 (value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.startsWith('sha256:')) {
    const hex = trimmed.slice('sha256:'.length).toLowerCase()
    return HEX_64_RE.test(hex) ? hex : null
  }
  try {
    const bytes = base64UrlDecode(trimmed)
    return bytes.length === 32 ? bytesToHex(bytes) : null
  } catch {
    return null
  }
}

/**
 * Encrypt a premium payload with a content key.
 *
 * AAD is `banksia.vault.content.v1|blog|permlink|kid|mode`. The returned object
 * includes the plaintext byte length and a `sha256:<hex>` hash of the plaintext.
 */
export async function encryptPayload (plaintext, contentKeyB64, header) {
  const aad = contentHeaderAad(header)
  const key = await importAesKey(contentKeyB64, 'content key')
  const plaintextBytes = typeof plaintext === 'string' ? utf8(plaintext) : toBytes(plaintext, 'plaintext')
  const iv = randomBytes(GCM_IV_BYTES)
  const ct = await aesGcmEncrypt(key, plaintextBytes, iv, aad)
  const digest = new Uint8Array(await subtle().digest('SHA-256', plaintextBytes))
  return {
    alg: VAULT_ALG,
    iv: base64UrlEncode(iv),
    ct: base64UrlEncode(ct),
    bytes: plaintextBytes.length,
    hash: `sha256:${bytesToHex(digest)}`
  }
}

/**
 * Decrypt a payload and verify its plaintext hash.
 *
 * Throws `VAULT_TAG` when AES-GCM authentication fails and `VAULT_HASH` when
 * the plaintext does not match `payload.hash`.
 */
export async function decryptPayload (payload, contentKeyB64, header) {
  assertHeaderObject(payload, 'payload')
  if (payload.alg !== undefined && payload.alg !== VAULT_ALG) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', `Unsupported payload algorithm: ${payload.alg}`)
  }
  if (typeof payload.iv !== 'string' || typeof payload.ct !== 'string') {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The payload is missing iv or ct.')
  }
  const aad = contentHeaderAad(header)
  const key = await importAesKey(contentKeyB64, 'content key')
  const iv = base64UrlDecode(payload.iv)
  if (iv.length !== GCM_IV_BYTES) throw new VaultCryptoError('VAULT_BAD_INPUT', 'The payload IV must be 12 bytes.')
  const plain = await aesGcmDecrypt(key, base64UrlDecode(payload.ct), iv, aad)

  let plaintext
  try {
    plaintext = new TextDecoder('utf-8', { fatal: true }).decode(plain)
  } catch (error) {
    throw new VaultCryptoError('VAULT_BAD_INPUT', 'The decrypted payload is not valid UTF-8.', { cause: error })
  }

  const expected = normalizeSha256(payload.hash)
  if (!expected) throw new VaultCryptoError('VAULT_HASH', 'The payload hash is missing or malformed.')
  const actual = bytesToHex(new Uint8Array(await subtle().digest('SHA-256', plain)))
  if (actual !== expected) throw new VaultCryptoError('VAULT_HASH', 'The decrypted payload does not match its hash.')
  return plaintext
}

/** True when `value` is a 65-byte uncompressed P-256 point. */
export function isP256PublicKeyBytes (value) {
  try {
    const bytes = toBytes(value)
    return bytes.length === P256_UNCOMPRESSED_BYTES && bytes[0] === 0x04
  } catch {
    return false
  }
}

export const VAULT_CONSTANTS = Object.freeze({
  AES_KEY_BYTES,
  GCM_IV_BYTES,
  GCM_TAG_BYTES,
  P256_UNCOMPRESSED_BYTES,
  P256_COORDINATE_BYTES
})
