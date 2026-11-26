// Public-key-only account claim links.
//
// A new user generates their own Hive keys locally, keeps the private keys, and
// shares a link containing only the username and the four public keys. A sponsor
// opens the link, signs in with Keychain/HiveAuth/SmartLock, and broadcasts the
// account creation. The link is therefore not secret, but it must be shared
// privately: whoever creates the account can spend an account token or 3 HIVE,
// and the username is permanent.
//
// Keep this module free of the signing stack: it is used by the public /join
// pages and by tests in Node/jsdom.

import { validateAccountName } from './hiveNames'

export const CLAIM_VERSION = 1
export const CLAIM_FRAGMENT_KEY = 'claim'

// Hive public keys are base58 "STM..." strings. The chain validates the
// checksum; this is a cheap format check so we never render obvious garbage.
const PUBLIC_KEY_RE = /^STM[1-9A-HJ-NP-Za-km-z]{45,52}$/
const NONCE_RE = /^[a-f0-9]{8,64}$/

function randomNonce () {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(8))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(16).slice(2, 18).padEnd(16, '0')
}

function binaryFromBytes (bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return binary
}

function bytesFromBinary (binary) {
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function base64UrlEncode (text) {
  const bytes = new TextEncoder().encode(text)
  return btoa(binaryFromBytes(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode (value) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  return new TextDecoder().decode(bytesFromBinary(atob(padded)))
}

function requirePublicKey (value, label) {
  const key = String(value || '').trim()
  if (!PUBLIC_KEY_RE.test(key)) {
    throw new Error('The claim link has an invalid ' + label + ' public key.')
  }
  return key
}

/**
 * Build a normalised, versioned claim payload. Only public data belongs here.
 *
 * @param {object} input
 * @param {string} input.username
 * @param {string} input.owner
 * @param {string} input.active
 * @param {string} input.posting
 * @param {string} input.memo
 * @param {number} [input.createdAt]
 * @param {string} [input.nonce]
 */
export function buildClaimPayload ({
  username,
  owner,
  active,
  posting,
  memo,
  createdAt = Date.now(),
  nonce = randomNonce()
} = {}) {
  const name = String(username || '').trim().toLowerCase()
  const nameError = validateAccountName(name)
  if (nameError) throw new Error(nameError)

  const created = Number(createdAt)
  if (!Number.isFinite(created) || created <= 0) throw new Error('The claim link has an invalid timestamp.')

  const claimNonce = String(nonce || '').trim()
  if (!NONCE_RE.test(claimNonce)) throw new Error('The claim link has an invalid nonce.')

  return {
    v: CLAIM_VERSION,
    u: name,
    o: requirePublicKey(owner, 'owner'),
    a: requirePublicKey(active, 'active'),
    p: requirePublicKey(posting, 'posting'),
    m: requirePublicKey(memo, 'memo'),
    n: claimNonce,
    t: Math.trunc(created)
  }
}

/** Extract the four public keys from hive-tx's generated authority objects. */
export function publicKeysFromAuthorities (generated) {
  const keyAuth = authority => {
    const key = authority?.key_auths?.[0]?.[0]
    if (!key) throw new Error('Generated keys are incomplete.')
    return key
  }
  return {
    owner: keyAuth(generated?.owner),
    active: keyAuth(generated?.active),
    posting: keyAuth(generated?.posting),
    memo: generated?.memo_key
  }
}

/** Convert a claim payload to the authority objects expected by Hive ops. */
export function authoritiesFromPayload (payload) {
  const authority = key => ({
    weight_threshold: 1,
    account_auths: [],
    key_auths: [[key, 1]]
  })
  return {
    owner: authority(payload.o),
    active: authority(payload.a),
    posting: authority(payload.p),
    memo_key: payload.m
  }
}

export function encodeClaimPayload (payload) {
  const normalised = buildClaimPayload({
    username: payload?.u,
    owner: payload?.o,
    active: payload?.a,
    posting: payload?.p,
    memo: payload?.m,
    createdAt: payload?.t,
    nonce: payload?.n
  })
  return base64UrlEncode(JSON.stringify(normalised))
}

export function decodeClaimPayload (encoded) {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('The claim link is missing its payload.')
  }
  let parsed
  try {
    parsed = JSON.parse(base64UrlDecode(encoded.trim()))
  } catch {
    throw new Error('The claim link is not valid. Ask the new user to copy it again.')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The claim link is not valid.')
  }
  if (Number(parsed.v) !== CLAIM_VERSION) {
    throw new Error('This claim link was made by a newer version of Banksia.')
  }
  try {
    return buildClaimPayload({
      username: parsed.u,
      owner: parsed.o,
      active: parsed.a,
      posting: parsed.p,
      memo: parsed.m,
      createdAt: parsed.t,
      nonce: parsed.n
    })
  } catch (error) {
    throw new Error(error?.message || 'The claim link is not valid.', { cause: error })
  }
}

/**
 * Read a claim from a full URL (or a bare fragment). Returns null when the link
 * has no claim parameter; throws when a claim parameter exists but is invalid.
 */
export function claimFromLink (link) {
  if (!link || typeof link !== 'string') return null
  let url
  try {
    url = new URL(link.trim(), 'https://banksia.io')
  } catch {
    return null
  }

  const hash = url.hash.replace(/^#/, '')
  if (hash) {
    const params = new URLSearchParams(hash)
    const encoded = params.get(CLAIM_FRAGMENT_KEY)
    if (encoded) return decodeClaimPayload(encoded)
    // Accept a raw hash payload as a convenience for hand-copied links.
    if (!hash.includes('=')) return decodeClaimPayload(hash)
  }

  const query = url.searchParams.get(CLAIM_FRAGMENT_KEY)
  if (query) return decodeClaimPayload(query)
  return null
}

export function buildClaimLink (payload, origin) {
  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : 'https://banksia.io')).replace(/\/+$/, '')
  return base + '/create/claim#' + CLAIM_FRAGMENT_KEY + '=' + encodeClaimPayload(payload)
}

/** Short, human-comparable fingerprint of the public keys. */
export async function claimFingerprint (payload) {
  const text = [payload.u, payload.o, payload.a, payload.p, payload.m].join('|')
  const bytes = new TextEncoder().encode(text)
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : null
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest).slice(0, 6), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  // Small deterministic fallback for environments without Web Crypto.
  let hash = 2166136261
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function claimAgeDays (payload, now = Date.now()) {
  const created = Number(payload?.t)
  if (!Number.isFinite(created)) return null
  return Math.max(0, (now - created) / 86400000)
}
