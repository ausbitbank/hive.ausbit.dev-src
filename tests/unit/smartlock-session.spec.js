import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SESSION_TIMEOUT_MS,
  getPosting,
  isUnlocked,
  lock,
  lockExpired,
  save,
  touchActivity
} from '../../src/components/smartlock/store'

const NOW = new Date('2026-11-17T12:00:00.000Z')

describe('SmartLock session timeout', { tags: ['slow'] }, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })

  afterEach(() => {
    lock('alice')
    lock('bob')
    vi.useRealTimers()
  })

  it('unlocks on save and expires after the configured idle period', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })

    expect(isUnlocked('alice', 1000)).toBe(true)

    vi.advanceTimersByTime(1001)
    expect(isUnlocked('alice', 1000)).toBe(false)
  })

  it('uses the default timeout when none is supplied', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })
    vi.advanceTimersByTime(DEFAULT_SESSION_TIMEOUT_MS - 1)
    expect(isUnlocked('alice')).toBe(true)
    vi.advanceTimersByTime(2)
    expect(isUnlocked('alice')).toBe(false)
  })

  it('refuses to hand out the posting key after the timeout without a sweep', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })
    expect(getPosting('alice', 1000)).toBe('5KfakePostingKey')
    vi.advanceTimersByTime(1001)
    expect(getPosting('alice', 1000)).toBeUndefined()
    expect(isUnlocked('alice', 1000)).toBe(false)
  })

  it('extends the session when activity is recorded', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })
    vi.advanceTimersByTime(900)
    touchActivity('alice')
    vi.advanceTimersByTime(900)
    expect(isUnlocked('alice', 1000)).toBe(true)
  })

  it('locks every expired account and leaves active sessions alone', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })
    vi.advanceTimersByTime(500)
    save('bob', 'password456', { posting: '5KfakePostingKeyBob' })
    vi.advanceTimersByTime(601)

    expect(lockExpired(1000)).toEqual(['alice'])
    expect(isUnlocked('alice', 1000)).toBe(false)
    expect(isUnlocked('bob', 1000)).toBe(true)
  })

  it('does not expire when the timeout is disabled', () => {
    save('alice', 'password123', { posting: '5KfakePostingKey' })
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(lockExpired(0)).toEqual([])
    expect(isUnlocked('alice', 0)).toBe(true)
  })
})
