import { describe, expect, it, vi } from 'vitest'
import timersMixin from '../../src/mixins/timers'

// normalizeTimers is a pure method; calling it with a fake `this` avoids the
// component lifecycle (and therefore avoids creating any real timers).
function normalize (config) {
  return timersMixin.methods.normalizeTimers.call({}, config)
}

describe('timers mixin', () => {
  it('created() initialises internal timer bookkeeping only', () => {
    const vm = {}

    timersMixin.created.call(vm)

    expect(vm._timerHandles).toEqual({})
    expect(vm._timerOptions).toEqual({})
  })

  it('normalizes an object config and injects the timer name', () => {
    const config = {
      refresh: { time: 60000, autostart: true, repeat: true, immediate: true }
    }

    const normalized = normalize(config)

    expect(normalized).toEqual({
      refresh: {
        name: 'refresh',
        time: 60000,
        autostart: true,
        repeat: true,
        immediate: true
      }
    })
    // The caller's config object should not be modified.
    expect(config.refresh).not.toHaveProperty('name')
  })

  it('normalizes an array config without changing callbacks', () => {
    const callback = () => {}
    const config = [
      { name: 'refresh', time: 3000, repeat: true, callback },
      { name: 'poll', time: 5000, repeat: false }
    ]

    const normalized = normalize(config)

    expect(Object.keys(normalized)).toEqual(['refresh', 'poll'])
    expect(normalized.refresh).toEqual({
      name: 'refresh',
      time: 3000,
      repeat: true,
      callback
    })
    expect(normalized.refresh.callback).toBe(callback)
    expect(normalized.poll).toEqual({
      name: 'poll',
      time: 5000,
      repeat: false
    })
  })

  it('returns an empty object for missing config', () => {
    expect(normalize(undefined)).toEqual({})
    expect(normalize(null)).toEqual({})
    expect(normalize({})).toEqual({})
    expect(normalize([])).toEqual({})
  })

  it('resolves a callback from options before the component method', () => {
    const optionCallback = () => 'option'
    const methodCallback = () => 'method'
    const vm = { refresh: methodCallback }

    const fromOptions = timersMixin.methods.resolveTimerCallback.call(vm, 'refresh', {
      callback: optionCallback
    })
    const fromMethod = timersMixin.methods.resolveTimerCallback.call(vm, 'refresh', {})
    const missing = timersMixin.methods.resolveTimerCallback.call(vm, 'missing', {})

    expect(fromOptions).toBe(optionCallback)
    expect(fromMethod).toBe(methodCallback)
    expect(missing).toBeNull()
  })

  it('pauses running timers and resumes them', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const vm = {
      _timerHandles: {},
      _timerOptions: { refresh: { name: 'refresh', time: 1000, repeat: true, immediate: false } },
      _pausedTimerNames: [],
      timers: { refresh: { isRunning: false } },
      refresh
    }
    Object.assign(vm, timersMixin.methods)

    vm.startTimer('refresh')
    vi.advanceTimersByTime(1000)
    expect(refresh).toHaveBeenCalledTimes(1)

    vm.pauseTimers()
    expect(vm.timers.refresh.isRunning).toBe(false)
    vi.advanceTimersByTime(2000)
    expect(refresh).toHaveBeenCalledTimes(1)

    vm.resumeTimers()
    expect(vm.timers.refresh.isRunning).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(refresh).toHaveBeenCalledTimes(2)

    vm.stopTimer('refresh')
    vi.useRealTimers()
  })

  it('fires one-shot timers once and never restarts them on resume', () => {
    vi.useFakeTimers()
    const once = vi.fn()
    const vm = {
      _timerHandles: {},
      _timerOptions: { once: { name: 'once', time: 500, repeat: false, immediate: false } },
      _pausedTimerNames: [],
      timers: { once: { isRunning: false } },
      once
    }
    Object.assign(vm, timersMixin.methods)

    vm.startTimer('once')
    vi.advanceTimersByTime(500)
    expect(once).toHaveBeenCalledTimes(1)
    expect(vm.timers.once.isRunning).toBe(false)

    vm.pauseTimers()
    vm.resumeTimers()
    vi.advanceTimersByTime(2000)
    expect(once).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
