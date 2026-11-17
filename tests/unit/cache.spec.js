import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTtlCache, invalidateCache, loadCached } from '../../src/services/cache'

describe('TTL cache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns fresh entries and evicts the oldest past maxEntries', () => {
    let now = 1000
    const cache = createTtlCache({ maxEntries: 2, now: () => now })

    cache.set('a', 1, { ttl: 100 })
    now = 1050
    cache.set('b', 2, { ttl: 100 })
    expect(cache.get('a')).toMatchObject({ value: 1, age: 50 })

    now = 1100
    cache.set('c', 3, { ttl: 100 })
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b').value).toBe(2)
    expect(cache.get('c').value).toBe(3)
  })

  it('serves fresh values without calling the fetcher', async () => {
    const cache = createTtlCache()
    cache.set('key', 'cached', { ttl: 10000 })
    const fetcher = vi.fn(async () => 'fresh')

    expect(await loadCached('key', fetcher, { cache, ttl: 10000 })).toBe('cached')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns stale data and revalidates in the background', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'))
    const cache = createTtlCache()
    cache.set('key', 'old', { ttl: 100 })
    vi.setSystemTime(new Date('2026-11-18T12:00:01Z'))
    const fetcher = vi.fn(async () => 'new')
    const onStale = vi.fn()

    const value = await loadCached('key', fetcher, { cache, ttl: 100, onStale })
    expect(value).toBe('old')
    expect(onStale).toHaveBeenCalled()

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cache.get('key').value).toBe('new')
  })

  it('forces a network read when requested', async () => {
    const cache = createTtlCache()
    cache.set('key', 'cached', { ttl: 10000 })
    const fetcher = vi.fn(async () => 'fresh')

    expect(await loadCached('key', fetcher, { cache, ttl: 10000, force: true })).toBe('fresh')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('de-duplicates concurrent revalidations', async () => {
    const cache = createTtlCache()
    const fetcher = vi.fn(async () => {
      await Promise.resolve()
      return 'value'
    })

    const [a, b] = await Promise.all([
      loadCached('same', fetcher, { cache }),
      loadCached('same', fetcher, { cache })
    ])

    expect(a).toBe('value')
    expect(b).toBe('value')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('invalidates by key prefix', () => {
    const cache = createTtlCache()
    cache.set('account:alice', 1)
    cache.set('account:bob', 2)
    cache.set('witnesses:200', 3)

    expect(invalidateCache('account:', cache)).toBe(2)
    expect(cache.get('account:alice')).toBeNull()
    expect(cache.get('witnesses:200').value).toBe(3)
  })
})
