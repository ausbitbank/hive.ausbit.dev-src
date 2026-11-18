import { afterEach, describe, expect, it } from 'vitest'
import { connectivity, isOnline, setOnlineStatus } from '../../src/services/connectivity'

describe('connectivity state', () => {
  afterEach(() => {
    setOnlineStatus(true)
  })

  it('tracks explicit online and offline transitions', () => {
    setOnlineStatus(false)
    expect(connectivity.online).toBe(false)
    expect(isOnline()).toBe(false)

    setOnlineStatus(true)
    expect(connectivity.online).toBe(true)
    expect(isOnline()).toBe(true)
  })

  it('ignores duplicate transitions without changing the timestamp', () => {
    setOnlineStatus(true)
    const changedAt = connectivity.changedAt
    setOnlineStatus(true)
    expect(connectivity.changedAt).toBe(changedAt)
  })
})
