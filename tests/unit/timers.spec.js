import { describe, expect, it } from 'vitest'
import timersMixin from '../../src/mixins/timers'

// normalizeTimers is a pure method; calling it with a fake `this` avoids the
// component lifecycle (and therefore avoids creating any real timers).
function normalize (config) {
  return timersMixin.methods.normalizeTimers.call({}, config)
}

describe('timers mixin', () => {
  it('exposes the expected mixin options shape', () => {
    expect(typeof timersMixin.data).toBe('function')
    expect(timersMixin.data()).toEqual({ timers: {} })

    expect(typeof timersMixin.created).toBe('function')
    expect(typeof timersMixin.mounted).toBe('function')
    expect(typeof timersMixin.beforeUnmount).toBe('function')

    expect(timersMixin.methods).toEqual(expect.objectContaining({
      normalizeTimers: expect.any(Function),
      resolveTimerCallback: expect.any(Function),
      startTimer: expect.any(Function),
      stopTimer: expect.any(Function)
    }))
  })

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
})
