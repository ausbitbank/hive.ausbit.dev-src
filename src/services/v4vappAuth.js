// Read-only v4v.app account session used for the keepsats panel.
//
// v4v.app authenticates a Hive account by handing out a text challenge, asking
// the user to sign it with the posting key, and returning a short-lived bearer
// token. This module orchestrates that exchange and keeps the token in memory
// only. It never asks for the active key and never writes a token to storage.
//
// Verified 2026-11-21 with @ausbit.vsc: /auth/validate accepted a posting-key
// signature, the token carried `scope: "hive:posting"` for ~50 minutes, and it
// could read GET /v2/v4vapp/keepsats. Treat the session as read-only; any write
// action stays on the on-chain signing path.

import { keychain } from '@hiveio/keychain'
import smartlock from 'components/smartlock/index.js'
import { normalizeAccount } from './lightning'
import { normalizeKeepsats } from './keepsats'
import {
  V4vappError,
  getAuthChallenge,
  getKeepsats,
  validateAuthSignature
} from './v4vapp'
import { hive } from './hive'
import {
  clearAuthSession,
  getAuthSession,
  getClientId,
  getSessionRecord,
  setSessionRecord
} from './v4vappSession'

export {
  clearAuthSession,
  generateClientId,
  getAuthSession,
  getClientId,
  resetClientId
} from './v4vappSession'

const DEFAULT_TOKEN_TTL_MS = 45 * 60 * 1000

export class V4vappAuthError extends Error {
  constructor (message, { code = 'auth', cause = null } = {}) {
    super(message)
    this.name = 'V4vappAuthError'
    this.code = code
    this.cause = cause
  }
}

function decodeClaims (token) {
  const part = String(token || '').split('.')[1]
  if (!part || typeof atob !== 'function') return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function tokenExpiry (response, claims) {
  const seconds = Number(response?.expire ?? claims?.exp)
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  return Date.now() + DEFAULT_TOKEN_TTL_MS
}

export function isAuthExpired (error) {
  return error instanceof V4vappAuthError && error.code === 'expired'
}

async function postingPublicKey (account) {
  try {
    const accounts = await hive.api.getAccountsAsync([account])
    const keys = accounts?.[0]?.posting?.key_auths || []
    return keys.length === 1 ? keys[0][0] : ''
  } catch {
    return ''
  }
}

async function signWithKeychain ({ account, challenge }) {
  if (typeof window === 'undefined' || !window.hive_keychain) {
    throw new V4vappAuthError('Hive Keychain is not available in this browser.', { code: 'unavailable' })
  }
  const response = await keychain(window, 'requestSignBuffer', account, challenge, 'Posting')
  if (response?.cancel) {
    throw new V4vappAuthError('Signature cancelled in Keychain.', { code: 'cancelled' })
  }
  if (response?.notInstalled) {
    throw new V4vappAuthError('Hive Keychain extension is not installed.', { code: 'unavailable' })
  }
  if (!response?.success || !response?.result) {
    throw new V4vappAuthError(response?.message || response?.msg || 'Keychain did not sign the challenge.')
  }
  return { signature: response.result, publicKey: response.publicKey || '' }
}

async function signWithSmartlock ({ account, challenge }) {
  if (!smartlock.isAccountUnlocked(account)) {
    throw new V4vappAuthError('SmartLock is locked. Unlock it to read the Lightning balance.', { code: 'locked' })
  }
  const result = await smartlock.api.signBufferWithPublicKey(account, challenge)
  return { signature: result.signature, publicKey: result.publicKey }
}

async function signWithHiveauth ({ account, challenge }) {
  let hiveauth
  try {
    hiveauth = (await import('./hiveauth')).default
  } catch {
    throw new V4vappAuthError('HiveAuth is not available in this browser.', { code: 'unavailable' })
  }
  try {
    const result = await hiveauth.signChallenge(account, { keyType: 'posting', challenge })
    return { signature: result.signature, publicKey: result.publicKey }
  } catch (error) {
    if (error?.code === 'cancelled') {
      throw new V4vappAuthError('Signature cancelled in HiveAuth.', { code: 'cancelled' })
    }
    if (error?.code === 'login' || error?.code === 'expired') {
      throw new V4vappAuthError('HiveAuth session expired. Sign in again.', { code: 'login' })
    }
    if (error?.code === 'unavailable') {
      throw new V4vappAuthError('HiveAuth is not available in this browser.', { code: 'unavailable' })
    }
    throw new V4vappAuthError(error?.message || 'HiveAuth did not sign the challenge.')
  }
}

export async function signAuthChallenge ({ account, challenge, loginType }) {
  if (loginType === 'keychain') return signWithKeychain({ account, challenge })
  if (loginType === 'smartlock') return signWithSmartlock({ account, challenge })
  if (loginType === 'hiveauth') return signWithHiveauth({ account, challenge })
  throw new V4vappAuthError('Log in with Keychain, SmartLock or HiveAuth to read a keepsats balance.', { code: 'login' })
}

/**
 * Run the full challenge → sign → validate exchange.
 *
 * `sign` is injectable for tests; production callers pass `loginType` only.
 * The returned value is a session summary, never the token.
 */
export async function authenticate (account, {
  loginType = '',
  sign = null,
  signal = null,
  clientId: explicitClientId = ''
} = {}) {
  const name = normalizeAccount(account)
  if (!name) throw new V4vappAuthError('Choose a Hive account to connect.')

  const existing = getAuthSession(name)
  if (existing && !existing.expired) return existing

  const id = explicitClientId || getClientId()
  let challenge
  try {
    challenge = (await getAuthChallenge(name, { clientId: id, signal })).challenge
  } catch (error) {
    throw new V4vappAuthError(error?.message || 'Could not get a v4v.app challenge.', {
      code: 'challenge',
      cause: error
    })
  }
  if (!challenge) throw new V4vappAuthError('v4v.app did not return a challenge.')

  const signer = sign || (args => signAuthChallenge({ ...args, loginType }))
  const signed = await signer({ account: name, challenge, loginType })
  const signature = signed?.signature || signed?.result || ''
  if (!signature) throw new V4vappAuthError('The challenge was not signed.', { code: 'signature' })
  const publicKey = signed?.publicKey || await postingPublicKey(name)
  if (!publicKey) throw new V4vappAuthError('The posting public key is missing.', { code: 'signature' })

  let response
  try {
    response = await validateAuthSignature({
      success: true,
      publicKey,
      result: signature,
      data: {
        username: name,
        message: challenge,
        key: 'posting'
      }
    }, { clientId: id, signal })
  } catch (error) {
    throw new V4vappAuthError(error?.message || 'v4v.app rejected the signed challenge.', {
      code: error?.status === 401 ? 'rejected' : 'validate',
      cause: error
    })
  }

  const token = response?.access_token || response?.token || response?.accessToken || ''
  if (!token) throw new V4vappAuthError('v4v.app did not return a session token.')
  const claims = decodeClaims(token)
  setSessionRecord({
    account: name,
    token,
    expiresAt: tokenExpiry(response, claims),
    claims
  })
  return getAuthSession(name)
}

/** Read the keepsats balance with the current in-memory session. */
export async function loadKeepsats (account, { signal = null } = {}) {
  const name = normalizeAccount(account)
  const current = getAuthSession(name)
  if (!current) {
    throw new V4vappAuthError('Connect to v4v.app to read the keepsats balance.', { code: 'expired' })
  }
  if (current.expired) {
    clearAuthSession(name)
    throw new V4vappAuthError('The v4v.app session expired. Reconnect to read the balance.', { code: 'expired' })
  }
  try {
    const payload = await getKeepsats(name, getSessionRecord().token, { signal })
    return normalizeKeepsats(payload)
  } catch (error) {
    if (error instanceof V4vappError && (error.status === 401 || error.status === 403)) {
      clearAuthSession(name)
      throw new V4vappAuthError('The v4v.app session expired. Reconnect to read the balance.', {
        code: 'expired',
        cause: error
      })
    }
    throw error
  }
}
