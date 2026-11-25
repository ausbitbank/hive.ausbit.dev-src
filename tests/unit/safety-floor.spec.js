import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bridgeRequest: vi.fn(),
  loadCached: vi.fn((_key, fetcher) => fetcher())
}))

vi.mock('../../src/services/api', () => ({
  bridgeRequest: mocks.bridgeRequest
}))

vi.mock('../../src/services/cache', () => ({
  loadCached: mocks.loadCached
}))

const {
  SAFETY_FLOOR_CACHE_KEY,
  SAFETY_FLOOR_SOURCE,
  SAFETY_FLOOR_STORAGE_KEY,
  SAFETY_FLOOR_STORAGE_MAX_AGE_MS,
  ensureSafetyFloor,
  normalizeSafetyFloorResponse,
  readSafetyFloorCache,
  resetSafetyFloorState,
  safetyFloorState
} = await import('../../src/services/safetyFloor')

beforeEach(() => {
  mocks.bridgeRequest.mockReset()
  mocks.loadCached.mockReset()
  mocks.loadCached.mockImplementation((_key, fetcher) => fetcher())
  resetSafetyFloorState()
})

describe('safety floor data', () => {
  it('normalizes and dedupes the public phishing list', () => {
    const snapshot = normalizeSafetyFloorResponse([
      { name: 'Alice' },
      { name: 'alice' },
      { name: 'bad.actor' },
      { name: '' },
      '<script>'
    ])
    expect(snapshot.names).toEqual(['alice', 'bad.actor'])
    expect(snapshot.total).toBe(5)
    expect(snapshot.truncated).toBe(false)
  })

  it('rehydrates a recent public-list cache for repeat visits', () => {
    localStorage.setItem(SAFETY_FLOOR_STORAGE_KEY, JSON.stringify({
      sourceId: SAFETY_FLOOR_SOURCE.id,
      savedAt: Date.now() - 60_000,
      names: ['Alice', 'phish'],
      total: 2,
      truncated: false
    }))

    const cached = readSafetyFloorCache()
    expect(cached.names).toEqual(['alice', 'phish'])
    expect(cached.total).toBe(2)
    expect(cached.truncated).toBe(false)
  })

  it('ignores a stale, foreign or malformed cache', () => {
    const base = {
      sourceId: SAFETY_FLOOR_SOURCE.id,
      savedAt: Date.now(),
      names: ['phish'],
      total: 1,
      truncated: false
    }
    localStorage.setItem(SAFETY_FLOOR_STORAGE_KEY, JSON.stringify({
      ...base,
      savedAt: Date.now() - SAFETY_FLOOR_STORAGE_MAX_AGE_MS - 1
    }))
    expect(readSafetyFloorCache()).toBeNull()

    localStorage.setItem(SAFETY_FLOOR_STORAGE_KEY, JSON.stringify({ ...base, sourceId: 'other' }))
    expect(readSafetyFloorCache()).toBeNull()

    localStorage.setItem(SAFETY_FLOOR_STORAGE_KEY, '{not json')
    expect(readSafetyFloorCache()).toBeNull()

    localStorage.setItem(SAFETY_FLOOR_STORAGE_KEY, JSON.stringify({ ...base, names: ['<script>'] }))
    expect(readSafetyFloorCache()).toBeNull()
  })

  it('loads the list into the shared state', async () => {
    mocks.bridgeRequest.mockResolvedValue([{ name: 'Alice' }, { name: 'phish' }])

    const state = await ensureSafetyFloor()
    expect(mocks.bridgeRequest).toHaveBeenCalledWith('get_follow_list', {
      observer: 'hive.blog',
      follow_type: 'muted'
    })
    expect(mocks.loadCached).toHaveBeenCalledWith(
      SAFETY_FLOOR_CACHE_KEY,
      expect.any(Function),
      expect.objectContaining({ force: false })
    )
    expect(state).toBe(safetyFloorState)
    expect(state.status).toBe('ready')
    expect(state.names).toEqual(['alice', 'phish'])
    expect(state.total).toBe(2)
    expect(state.source).toBe(SAFETY_FLOOR_SOURCE)
    expect(readSafetyFloorCache().names).toEqual(['alice', 'phish'])
  })

  it('fails open with an error state instead of rejecting', async () => {
    mocks.bridgeRequest.mockRejectedValue(new Error('node down'))

    const state = await ensureSafetyFloor()
    expect(state.status).toBe('error')
    expect(state.error).toBe('node down')
    expect(state.names).toEqual([])
  })

  it('rejects a malformed response and reports it', async () => {
    mocks.bridgeRequest.mockResolvedValue({ result: 'stub' })

    const state = await ensureSafetyFloor()
    expect(state.status).toBe('error')
    expect(state.error).toBe('Unexpected safety floor response')
  })

  it('marks a list above the cap as a partial index', () => {
    const rows = Array.from({ length: 10002 }, (_, index) => ({ name: 'user' + index }))
    const snapshot = normalizeSafetyFloorResponse(rows)
    expect(snapshot.names).toHaveLength(10000)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.total).toBe(10002)
  })
})
