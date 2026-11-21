import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_PREFIX,
  clearAllSessions,
  clearSession,
  loadSession,
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
})
