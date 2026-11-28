import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollWhileVisible } from '../../src/services/polling'

describe('pollWhileVisible', () => {
  let visibility

  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs immediately and on an interval while visible', () => {
    const callback = vi.fn()
    const poller = pollWhileVisible(callback, 1000)
    poller.start()

    expect(callback).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(callback).toHaveBeenCalledTimes(3)
    poller.stop()
  })

  it('does not poll while hidden and refreshes on return', () => {
    visibility = 'hidden'
    const callback = vi.fn()
    const poller = pollWhileVisible(callback, 1000)
    poller.start()

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(callback).not.toHaveBeenCalled()

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(callback).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('does not overlap a slow async callback', async () => {
    let resolve
    const callback = vi.fn(() => new Promise(done => { resolve = done }))
    const poller = pollWhileVisible(callback, 1000, { immediate: false })
    poller.start()

    vi.advanceTimersByTime(3000)
    expect(callback).toHaveBeenCalledTimes(1)

    resolve()
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('stops the interval and listener', () => {
    const callback = vi.fn()
    const poller = pollWhileVisible(callback, 1000, { immediate: false })
    poller.start()
    expect(poller.isRunning).toBe(true)

    poller.stop()
    expect(poller.isRunning).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(callback).not.toHaveBeenCalled()
  })
})
