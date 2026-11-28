// HiveAuth uses the CryptoJS/OpenSSL AES envelope:
//   base64("Salted__" + 8-byte salt + AES-256-CBC(PKCS#7, key, iv))
// with key+iv derived by EVP_BytesToKey(MD5, salt, 1 iteration).
//
// Web Crypto has AES-CBC but not MD5, so MD5 comes from @noble/hashes. This is
// deliberately a small adapter: the protocol only needs this one envelope.

import { md5 } from '@noble/hashes/legacy.js'
import { HiveAuthError } from './errors'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const SALT_LENGTH = 8
const KEY_LENGTH = 32
const IV_LENGTH = 16
const PREFIX = 'Salted__'

function concatBytes (...chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function webCrypto () {
  const crypto = globalThis.crypto
  if (!crypto?.subtle || typeof crypto.getRandomValues !== 'function') {
    throw new HiveAuthError('This browser cannot encrypt HiveAuth requests.', { code: 'unavailable' })
  }
  return crypto
}

export function randomBytes (length) {
  return webCrypto().getRandomValues(new Uint8Array(length))
}

export function bytesToBase64 (bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes (value) {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    throw new HiveAuthError('HiveAuth returned an invalid payload.', { code: 'protocol' })
  }
}

function deriveKeyAndIv (passphrase, salt) {
  const password = encoder.encode(passphrase)
  let previous = new Uint8Array(0)
  let derived = new Uint8Array(0)
  while (derived.length < KEY_LENGTH + IV_LENGTH) {
    previous = md5(concatBytes(previous, password, salt))
    derived = concatBytes(derived, previous)
  }
  return {
    key: derived.slice(0, KEY_LENGTH),
    iv: derived.slice(KEY_LENGTH, KEY_LENGTH + IV_LENGTH)
  }
}

async function importAesKey (key, usage) {
  try {
    return await webCrypto().subtle.importKey('raw', key, { name: 'AES-CBC' }, false, [usage])
  } catch (error) {
    throw new HiveAuthError('This browser cannot use the HiveAuth encryption key.', {
      code: 'unavailable',
      cause: error
    })
  }
}

export async function encryptPayload (value, passphrase) {
  if (typeof value !== 'string') throw new TypeError('HiveAuth payload must be a string')
  if (!passphrase) throw new HiveAuthError('Missing HiveAuth encryption key.', { code: 'protocol' })
  const crypto = webCrypto()
  const salt = randomBytes(SALT_LENGTH)
  const { key, iv } = deriveKeyAndIv(passphrase, salt)
  const cryptoKey = await importAesKey(key, 'encrypt')
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    encoder.encode(value)
  )
  return bytesToBase64(concatBytes(encoder.encode(PREFIX), salt, new Uint8Array(ciphertext)))
}

export async function decryptPayload (payload, passphrase) {
  if (typeof payload !== 'string' || !payload) {
    throw new HiveAuthError('HiveAuth returned an empty payload.', { code: 'protocol' })
  }
  if (!passphrase) throw new HiveAuthError('Missing HiveAuth encryption key.', { code: 'protocol' })
  const raw = base64ToBytes(payload)
  if (raw.length < SALT_LENGTH + IV_LENGTH || decoder.decode(raw.subarray(0, PREFIX.length)) !== PREFIX) {
    throw new HiveAuthError('HiveAuth returned an invalid encrypted payload.', { code: 'protocol' })
  }
  const salt = raw.subarray(PREFIX.length, PREFIX.length + SALT_LENGTH)
  const ciphertext = raw.subarray(PREFIX.length + SALT_LENGTH)
  const { key, iv } = deriveKeyAndIv(passphrase, salt)
  const cryptoKey = await importAesKey(key, 'decrypt')
  try {
    const plaintext = await webCrypto().subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext)
    return decoder.decode(plaintext)
  } catch (error) {
    throw new HiveAuthError('Could not decrypt the HiveAuth payload.', {
      code: 'protocol',
      cause: error
    })
  }
}

/** A UUID v4, used as the shared encryption key between the app and the PKSA. */
export function createAuthKey () {
  const crypto = webCrypto()
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}
