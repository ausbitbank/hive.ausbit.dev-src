import { describe, expect, it } from 'vitest'
import {
  STALE_BUNDLE_RELOAD_COOLDOWN_MS,
  isStaleBundleError,
  readLastReload,
  rememberReload,
  shouldAutoReload
} from '../../src/services/staleBundle'

describe('stale bundle detection', () => {
  it('recognises the messages browsers and Vite use for a missing chunk', () => {
    expect(isStaleBundleError(new TypeError('Failed to fetch dynamically imported module: https://hive.ausbit.dev/assets/Index-old.js'))).toBe(true)
    expect(isStaleBundleError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isStaleBundleError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isStaleBundleError(Object.assign(new Error('Loading chunk 42 failed'), { name: 'ChunkLoadError' }))).toBe(true)
    expect(isStaleBundleError('Unable to preload CSS for /assets/Index-old.css')).toBe(true)
  })

  it('ignores ordinary application errors', () => {
    expect(isStaleBundleError(null)).toBe(false)
    expect(isStaleBundleError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleBundleError({ name: 'TypeError', message: 'NetworkError when attempting to fetch resource.' })).toBe(false)
  })
})

describe('stale bundle reload guard', () => {
  it('allows the first automatic reload', () => {
    expect(shouldAutoReload(1_000_000, 0)).toBe(true)
    expect(shouldAutoReload(1_000_000, Number.NaN)).toBe(true)
  })

  it('does not reload again inside the cooldown window', () => {
    expect(shouldAutoReload(1_000_000, 1_000_000 - 1_000)).toBe(false)
    expect(shouldAutoReload(1_000_000, 1_000_000 - STALE_BUNDLE_RELOAD_COOLDOWN_MS - 1)).toBe(true)
  })

  it('tolerates storage being unavailable', () => {
    const broken = {
      getItem () { throw new Error('blocked') },
      setItem () { throw new Error('blocked') }
    }
    expect(readLastReload(broken)).toBe(0)
    expect(() => rememberReload(broken)).not.toThrow()
  })

  it('round-trips the last reload timestamp', () => {
    const data = new Map()
    const storage = {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value)
    }
    rememberReload(storage, 42)
    expect(readLastReload(storage)).toBe(42)
  })
})
