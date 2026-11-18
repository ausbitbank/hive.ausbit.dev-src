import { beforeEach, describe, expect, it } from 'vitest'
import {
  getTelemetrySnapshot,
  recordApiAttempt,
  recordApiFailover,
  recordApiRequest,
  recordCacheEvent,
  recordUiError,
  resetTelemetry,
  subscribeTelemetry
} from '../../src/services/telemetry'

describe('structured API telemetry', () => {
  beforeEach(() => {
    resetTelemetry()
  })

  it('reports request success rate, latency and retry/failover counts', () => {
    recordApiAttempt({ method: 'condenser_api.get_accounts', node: 'https://a', ok: false, durationMs: 40, timedOut: true })
    recordApiAttempt({ method: 'condenser_api.get_accounts', node: 'https://b', ok: true, durationMs: 20 })
    recordApiFailover({ method: 'condenser_api.get_accounts', from: 'https://a', to: 'https://b' })
    recordApiRequest({
      method: 'condenser_api.get_accounts',
      node: 'https://b',
      ok: true,
      durationMs: 61,
      attempts: 2,
      retries: 1,
      failovers: 1
    })
    recordApiRequest({ method: 'bridge.get_ranked_posts', node: 'https://b', ok: false, durationMs: 80, attempts: 1, error: 'boom' })

    const snapshot = getTelemetrySnapshot()
    expect(snapshot.requests).toMatchObject({
      total: 2,
      successes: 1,
      failures: 1,
      aborted: 0,
      successRate: 50
    })
    expect(snapshot.attempts).toMatchObject({
      total: 2,
      retries: 1,
      failovers: 1,
      timeouts: 1
    })
    expect(snapshot.latency.samples).toBe(2)
    expect(snapshot.latency.average).toBe(30)
    expect(snapshot.nodes.find(node => node.key === 'https://a')).toMatchObject({
      failures: 1,
      timeouts: 1
    })
    expect(snapshot.nodes.find(node => node.key === 'https://b')).toMatchObject({
      successes: 1,
      successRate: 100
    })
    expect(snapshot.recent.some(event => event.type === 'failover')).toBe(true)
  })

  it('tracks cache hits, stale hits and misses', () => {
    recordCacheEvent({ key: 'account:alice', hit: true })
    recordCacheEvent({ key: 'account:bob', hit: true, stale: true })
    recordCacheEvent({ key: 'account:carol', hit: false })

    expect(getTelemetrySnapshot().cache).toEqual({
      hits: 2,
      misses: 1,
      staleHits: 1,
      hitRate: 66.67
    })
  })

  it('notifies subscribers and keeps UI errors out of request counters', () => {
    const events = []
    const unsubscribe = subscribeTelemetry(event => events.push(event))
    recordUiError({ info: 'render', message: 'explode' })
    unsubscribe()
    recordUiError({ info: 'render', message: 'ignored' })

    const snapshot = getTelemetrySnapshot()
    expect(events).toHaveLength(1)
    expect(snapshot.requests.total).toBe(0)
    expect(snapshot.recent.some(event => event.type === 'ui-error')).toBe(true)
  })

  it('counts an aborted request separately from a failure', () => {
    recordApiRequest({ method: 'condenser_api.get_ticker', node: 'https://a', ok: false, aborted: true })
    const snapshot = getTelemetrySnapshot()
    expect(snapshot.requests).toMatchObject({ total: 1, successes: 0, failures: 0, aborted: 1 })
    expect(snapshot.requests.successRate).toBeNull()
  })
})
