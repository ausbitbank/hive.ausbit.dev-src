import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PENDING_KEY,
  SESSION_PREFIX,
  clearAllSessions,
  clearPending,
  clearSession,
  loadPending,
  loadSession,
  savePending,
  saveSession
} from '../../src/services/hiveauth/session'

const NOW = new Date('2026-11-22T12:00:00.000Z')
const SESSION = {
  account: 'alice',
  token: 'token-1',
  expire: NOW.getTime() + 60_000,
  key: 'key-1',
  host: 'wss://hive-auth.arcange.eu/'
}

describe('HiveAuth session storage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    clearAllSessions()
    sessionStorage.clear()
  })

  afterEach(() => {
    clearAllSessions()
    sessionStorage.clear()
    vi.useRealTimers()
  })

  it('saves and restores a session', () => {
    saveSession('alice', SESSION)
    expect(loadSession('alice')).toEqual(SESSION)
    expect(sessionStorage.getItem(SESSION_PREFIX + 'alice')).toBeTruthy()
  })

  it('expires a session at its expiry time', () => {
    saveSession('alice', SESSION)
    vi.advanceTimersByTime(60_000)
    expect(loadSession('alice')).toBeNull()
    expect(sessionStorage.getItem(SESSION_PREFIX + 'alice')).toBeNull()
  })

  it('keeps a token-less protocol-v1 session without an expiry', () => {
    saveSession('alice', { ...SESSION, token: null, expire: null })
    expect(loadSession('alice')).toMatchObject({ token: null, expire: null })
  })

  it('ignores malformed or mismatched records', () => {
    sessionStorage.setItem(SESSION_PREFIX + 'alice', '{')
    expect(loadSession('alice')).toBeNull()

    sessionStorage.setItem(SESSION_PREFIX + 'alice', JSON.stringify({ ...SESSION, account: 'bob' }))
    expect(loadSession('alice')).toBeNull()
  })

  it('clears one or all HiveAuth sessions without touching other storage', () => {
    saveSession('alice', SESSION)
    saveSession('bob', { ...SESSION, account: 'bob' })
    sessionStorage.setItem('loggedInUser', 'alice')

    clearSession('alice')
    expect(loadSession('alice')).toBeNull()
    expect(loadSession('bob')).not.toBeNull()

    clearAllSessions()
    expect(loadSession('bob')).toBeNull()
    expect(sessionStorage.getItem('loggedInUser')).toBe('alice')
  })

  it('saves, restores and clears a pending login record', () => {
    const pending = {
      account: 'alice',
      uuid: 'auth-1',
      kind: 'login',
      expire: NOW.getTime() + 60_000,
      key: 'auth-key'
    }
    expect(savePending(pending)).toEqual(pending)
    expect(loadPending()).toEqual(pending)
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY))).toEqual(pending)

    clearPending('different-uuid')
    expect(loadPending()).toEqual(pending)
    clearPending('auth-1')
    expect(loadPending()).toBeNull()
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('keeps the signing key out of pending sign and challenge records', () => {
    savePending({
      account: 'alice',
      uuid: 'sign-1',
      kind: 'sign',
      expire: NOW.getTime() + 60_000,
      key: 'session-key'
    })
    expect(loadPending()).toMatchObject({ kind: 'sign', key: null })
  })

  it('requires a temporary auth key for a pending login', () => {
    expect(savePending({
      account: 'alice',
      uuid: 'auth-2',
      kind: 'login',
      expire: NOW.getTime() + 60_000
    })).toBeNull()
    expect(loadPending()).toBeNull()
  })

  it('expires a pending record and can report the expired copy once', () => {
    savePending({
      account: 'alice',
      uuid: 'auth-3',
      kind: 'login',
      expire: NOW.getTime() + 5_000,
      key: 'auth-key'
    })
    vi.advanceTimersByTime(5_000)
    expect(loadPending({ includeExpired: true })).toMatchObject({
      uuid: 'auth-3',
      expire: NOW.getTime() + 5_000
    })
    expect(loadPending()).toBeNull()
  })

  it('clears a pending record with the rest of the sessions', () => {
    savePending({
      account: 'alice',
      uuid: 'auth-4',
      kind: 'login',
      expire: NOW.getTime() + 60_000,
      key: 'auth-key'
    })
    clearAllSessions()
    expect(loadPending({ includeExpired: true })).toBeNull()
  })
})
