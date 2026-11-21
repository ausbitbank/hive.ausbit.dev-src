import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('src/services/v4vapp', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getAuthChallenge: vi.fn(),
    validateAuthSignature: vi.fn(),
    getKeepsats: vi.fn()
  }
})

vi.mock('components/smartlock/index.js', () => ({
  default: {
    isAccountUnlocked: vi.fn(() => true),
    unlockAccount: vi.fn(),
    api: { signBufferWithPublicKey: vi.fn() }
  }
}))

vi.mock('@hiveio/keychain', () => ({
  keychain: vi.fn()
}))

vi.mock('src/services/hive', () => ({
  hive: {
    api: { getAccountsAsync: vi.fn() }
  }
}))

import { keychain } from '@hiveio/keychain'
import smartlock from 'components/smartlock/index.js'
import { hive } from 'src/services/hive'
import {
  V4vappAuthError,
  authenticate,
  clearAuthSession,
  getAuthSession,
  getClientId,
  loadKeepsats,
  resetClientId
} from 'src/services/v4vappAuth'
import {
  V4vappError,
  getAuthChallenge,
  getKeepsats,
  validateAuthSignature
} from 'src/services/v4vapp'

const ACCOUNT = 'ausbit.vsc'
const CHALLENGE = 'alpha beta gamma ausbit.vsc 1795256725.540959 client-id hive.ausbit.dev'
const PUBLIC_KEY = 'STM5Q3cRD4aBmm1dSgxQf9y2KtPakZkgT3uEZM2QjHSsNVKivzTFK'

function token (claims = { scope: 'hive:posting' }, exp = 2000000000) {
  const body = btoa(JSON.stringify({ ...claims, exp })).replace(/=+$/, '')
  return 'header.' + body + '.signature'
}

function signed (overrides = {}) {
  return { signature: '1f'.repeat(65), publicKey: PUBLIC_KEY, ...overrides }
}

describe('v4vapp read-only session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetClientId()
    clearAuthSession()
    localStorage.clear()
    sessionStorage.clear()
    delete window.hive_keychain
    getAuthChallenge.mockResolvedValue({ challenge: CHALLENGE })
    validateAuthSignature.mockResolvedValue({
      access_token: token(),
      token_type: 'bearer',
      expire: 2000000000
    })
    smartlock.isAccountUnlocked.mockReturnValue(true)
    smartlock.api.signBufferWithPublicKey.mockReturnValue(signed())
    hive.api.getAccountsAsync.mockResolvedValue([{ posting: { key_auths: [[PUBLIC_KEY, 1]] } }])
  })

  it('runs challenge, posting signature and validate, and keeps the token in memory only', async () => {
    const sign = vi.fn(async () => signed())

    const session = await authenticate(ACCOUNT, { loginType: 'keychain', sign })

    expect(getAuthChallenge).toHaveBeenCalledWith(ACCOUNT, {
      clientId: expect.any(String),
      signal: null
    })
    expect(sign).toHaveBeenCalledWith({ account: ACCOUNT, challenge: CHALLENGE, loginType: 'keychain' })
    expect(validateAuthSignature).toHaveBeenCalledWith({
      success: true,
      publicKey: PUBLIC_KEY,
      result: '1f'.repeat(65),
      data: { username: ACCOUNT, message: CHALLENGE, key: 'posting' }
    }, {
      clientId: expect.any(String),
      signal: null
    })

    expect(session).toMatchObject({ account: ACCOUNT, expired: false })
    expect(session.token).toBeUndefined()
    expect(session.claims).toMatchObject({ scope: 'hive:posting' })
    expect(localStorage.length + sessionStorage.length).toBe(1)
    expect(JSON.stringify(localStorage)).not.toContain('header.')
    expect(JSON.stringify(sessionStorage)).not.toContain('header.')
  })

  it('keeps a stable 10–100 character client id', () => {
    const first = getClientId()
    expect(first.length).toBeGreaterThanOrEqual(10)
    expect(first.length).toBeLessThanOrEqual(100)
    expect(getClientId()).toBe(first)
    expect(localStorage.getItem('v4vapp:clientId')).toBe(first)

    resetClientId()
    expect(getClientId()).not.toBe(first)
  })

  it('scopes the session to one account', async () => {
    await authenticate(ACCOUNT, { sign: async () => signed() })

    expect(getAuthSession('someone.else')).toBeNull()
    clearAuthSession('someone.else')
    expect(getAuthSession(ACCOUNT)).toMatchObject({ account: ACCOUNT })

    clearAuthSession(ACCOUNT)
    expect(getAuthSession(ACCOUNT)).toBeNull()
  })

  it('treats an expired session as disconnected and clears it before reading', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 10
    validateAuthSignature.mockResolvedValue({ access_token: token({}, expiredAt), expire: expiredAt })
    await authenticate(ACCOUNT, { sign: async () => signed() })

    expect(getAuthSession(ACCOUNT).expired).toBe(true)
    await expect(loadKeepsats(ACCOUNT)).rejects.toMatchObject({ code: 'expired' })
    expect(getAuthSession(ACCOUNT)).toBeNull()
    expect(getKeepsats).not.toHaveBeenCalled()
  })

  it('clears the session when keepsats returns 401', async () => {
    await authenticate(ACCOUNT, { sign: async () => signed() })
    getKeepsats.mockRejectedValue(new V4vappError('expired', { status: 401 }))

    const error = await loadKeepsats(ACCOUNT).catch(err => err)
    expect(error).toBeInstanceOf(V4vappAuthError)
    expect(error.code).toBe('expired')
    expect(getAuthSession(ACCOUNT)).toBeNull()
  })

  it('returns the normalised balance and in-progress amount', async () => {
    await authenticate(ACCOUNT, { sign: async () => signed() })
    getKeepsats.mockResolvedValue({
      hive_accname: ACCOUNT,
      net_sats: 12345,
      net_hbd: 1.5,
      net_hive: 2,
      net_usd: 1.51,
      in_progress_sats: 100,
      all_transactions: { sub: ACCOUNT, last_transaction_date: '2026-11-21T10:00:00Z' }
    })

    const data = await loadKeepsats(ACCOUNT)

    expect(getKeepsats).toHaveBeenCalledWith(ACCOUNT, expect.any(String), { signal: null })
    expect(data).toMatchObject({
      account: ACCOUNT,
      netSats: 12345,
      netHbd: 1.5,
      netHive: 2,
      netUsd: 1.51,
      inProgressSats: 100,
      hasHistory: false
    })
  })

  it('clears the session on the header logout event', async () => {
    await authenticate(ACCOUNT, { sign: async () => signed() })
    expect(getAuthSession(ACCOUNT)).not.toBeNull()

    window.dispatchEvent(new CustomEvent('hive:auth-logout'))

    expect(getAuthSession(ACCOUNT)).toBeNull()
  })

  it('reports a rejected signature without creating a session', async () => {
    validateAuthSignature.mockRejectedValue(new V4vappError('ERROR: message was signed with a different key', { status: 401 }))

    const error = await authenticate(ACCOUNT, { sign: async () => signed() }).catch(err => err)

    expect(error).toBeInstanceOf(V4vappAuthError)
    expect(error.code).toBe('rejected')
    expect(getAuthSession(ACCOUNT)).toBeNull()
  })

  it('uses Keychain for the posting signature', async () => {
    window.hive_keychain = {}
    keychain.mockResolvedValue({ success: true, result: 'sig', publicKey: PUBLIC_KEY })

    await authenticate(ACCOUNT, { loginType: 'keychain' })

    expect(keychain).toHaveBeenCalledWith(window, 'requestSignBuffer', ACCOUNT, CHALLENGE, 'Posting')
    expect(validateAuthSignature).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: PUBLIC_KEY,
      result: 'sig'
    }), expect.anything())
  })

  it('refuses to use Keychain when the extension is absent', async () => {
    const error = await authenticate(ACCOUNT, { loginType: 'keychain' }).catch(err => err)
    expect(error).toBeInstanceOf(V4vappAuthError)
    expect(error.code).toBe('unavailable')
    expect(getAuthSession(ACCOUNT)).toBeNull()
  })

  it('uses SmartLock and refuses when it is locked', async () => {
    await authenticate(ACCOUNT, { loginType: 'smartlock' })
    expect(smartlock.api.signBufferWithPublicKey).toHaveBeenCalledWith(ACCOUNT, CHALLENGE)

    clearAuthSession()
    smartlock.isAccountUnlocked.mockReturnValue(false)
    const error = await authenticate(ACCOUNT, { loginType: 'smartlock' }).catch(err => err)
    expect(error).toBeInstanceOf(V4vappAuthError)
    expect(error.code).toBe('locked')
  })

  it('requires a Keychain or SmartLock login', async () => {
    const error = await authenticate(ACCOUNT, { loginType: '' }).catch(err => err)
    expect(error).toBeInstanceOf(V4vappAuthError)
    expect(error.code).toBe('login')
  })
})
