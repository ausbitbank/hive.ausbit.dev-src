import { describe, expect, it } from 'vitest'
import {
  MAX_SAMPLES,
  latencySummary,
  loadNodeHistory,
  loadNodePrefs,
  pruneHistory,
  recordSamples,
  saveNodeHistory,
  saveNodePrefs
} from '../../src/services/nodeHistory'

function memoryStorage () {
  const data = new Map()
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  }
}

describe('latency history', () => {
  it('records samples per node and caps the history length', () => {
    let history = {}
    for (let index = 0; index < MAX_SAMPLES + 5; index += 1) {
      history = recordSamples(history, [{
        url: 'https://node',
        ok: true,
        latency: 100 + index,
        head: 1000 + index
      }], 1000 + index)
    }

    expect(history['https://node']).toHaveLength(MAX_SAMPLES)
    expect(history['https://node'][0].latency).toBe(105)
    expect(history['https://node'].at(-1).latency).toBe(128)
  })

  it('stores failed checks without a latency sample', () => {
    const history = recordSamples({}, [{
      url: 'https://down',
      ok: false,
      latency: Infinity
    }], 500)

    expect(history['https://down'][0]).toEqual({ t: 500, ok: false, latency: null, head: null })
  })

  it('summarises average, range and trend for a node', () => {
    const history = {
      'https://node': [
        { t: 1, ok: true, latency: 100 },
        { t: 2, ok: false, latency: null },
        { t: 3, ok: true, latency: 200 },
        { t: 4, ok: true, latency: 150 }
      ]
    }

    const summary = latencySummary(history, 'https://node')
    expect(summary.values).toEqual([100, 200, 150])
    expect(summary.average).toBe(150)
    expect(summary.min).toBe(100)
    expect(summary.max).toBe(200)
    expect(summary.trend).toBe(50)
    expect(summary.latest).toEqual({ t: 4, ok: true, latency: 150 })
  })

  it('prunes stale samples', () => {
    const now = 10_000_000
    const pruned = pruneHistory({
      'https://old': [{ t: now - 10 * 24 * 60 * 60 * 1000, ok: true, latency: 100 }],
      'https://fresh': [{ t: now - 1000, ok: true, latency: 120 }]
    }, now)

    expect(pruned).toEqual({
      'https://fresh': [{ t: now - 1000, ok: true, latency: 120 }]
    })
  })
})

describe('node preferences', () => {
  it('defaults to failover on and auto-select off', () => {
    const storage = memoryStorage()
    expect(loadNodePrefs(storage)).toEqual({ autoFailover: true, autoSelectFastest: false })
  })

  it('persists and restores node preferences', () => {
    const storage = memoryStorage()
    saveNodePrefs({ autoFailover: false, autoSelectFastest: true }, storage)

    expect(loadNodePrefs(storage)).toEqual({ autoFailover: false, autoSelectFastest: true })
  })

  it('persists and restores latency history', () => {
    const storage = memoryStorage()
    const history = { 'https://node': [{ t: Date.now(), ok: true, latency: 90 }] }
    saveNodeHistory(history, storage)

    expect(loadNodeHistory(storage)).toEqual(history)
  })

  it('survives corrupt storage', () => {
    const storage = memoryStorage()
    storage.setItem('nodeLatencyHistory', '{not json')
    storage.setItem('nodeMonitorPrefs', '{not json')

    expect(loadNodeHistory(storage)).toEqual({})
    expect(loadNodePrefs(storage)).toEqual({ autoFailover: true, autoSelectFastest: false })
  })
})
