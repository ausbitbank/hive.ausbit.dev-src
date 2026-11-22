import { describe, expect, it } from 'vitest'
import { nodeHealthSummary } from '../../src/services/nodeHealthSummary'

function node (url, extra = {}) {
  return {
    url,
    active: false,
    coolingDown: false,
    cooldownUntil: 0,
    consecutiveFailures: 0,
    failures: 0,
    successes: 0,
    lastLatency: null,
    ...extra
  }
}

describe('node health summary', () => {
  it('picks the active node and counts healthy and failing entries', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://api-a.example', { active: true, successes: 12, failures: 1, lastLatency: 42 }),
        node('https://api-b.example', { successes: 4, lastLatency: 80 }),
        node('https://api-c.example', { coolingDown: true, failures: 2, consecutiveFailures: 2 })
      ],
      globalProps: { head_block_number: 95000000 }
    })

    expect(summary.activeNode.url).toBe('https://api-a.example')
    expect(summary.nodes).toBe(3)
    expect(summary.healthy).toBe(2)
    expect(summary.failing).toBe(1)
    expect(summary.lastLatency).toBe(42)
    expect(summary.failures).toBe(3)
    expect(summary.coolingDown).toBe(1)
    expect(summary.headBlock).toBe(95000000)
    expect(summary.status).toBe('warning')
    expect(summary.statusLabel).toBe('Degraded')
  })

  it('falls back to the first node when no entry is marked active', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://first.example', { successes: 3, lastLatency: 20 }),
        node('https://second.example', { successes: 3, lastLatency: 30 })
      ],
      globalProps: { head_block_number: 10 }
    })

    expect(summary.activeNode.url).toBe('https://first.example')
  })

  it('does not count unused configured nodes as failing', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://api-a.example', { active: true, successes: 5, lastLatency: 25 }),
        node('https://api-b.example')
      ],
      globalProps: { head_block_number: 500 }
    })

    expect(summary.nodes).toBe(2)
    expect(summary.healthy).toBe(1)
    expect(summary.failing).toBe(0)
    expect(summary.status).toBe('healthy')
  })

  it('treats a cooling-down active node as critical', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://api-a.example', { active: true, coolingDown: true, successes: 3, lastLatency: 30 }),
        node('https://api-b.example', { successes: 4, lastLatency: 45 })
      ],
      globalProps: { head_block_number: 10 }
    })

    expect(summary.healthy).toBe(1)
    expect(summary.coolingDown).toBe(1)
    expect(summary.status).toBe('critical')
    expect(summary.statusLabel).toBe('Needs attention')
  })

  it('is critical when no node has a success', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://api-a.example', { active: true, coolingDown: true, failures: 3 }),
        node('https://api-b.example', { failures: 2 })
      ],
      globalProps: { head_block_number: 10 }
    })

    expect(summary.healthy).toBe(0)
    expect(summary.failing).toBe(2)
    expect(summary.status).toBe('critical')
  })

  it('reports healthy when every node has succeeded and the head is present', () => {
    const summary = nodeHealthSummary({
      health: [
        node('https://api-a.example', { active: true, successes: 5, lastLatency: 25 }),
        node('https://api-b.example', { successes: 2, lastLatency: 55 })
      ],
      globalProps: { head_block_number: 123456 }
    })

    expect(summary.healthy).toBe(2)
    expect(summary.failing).toBe(0)
    expect(summary.status).toBe('healthy')
    expect(summary.statusLabel).toBe('Healthy')
  })

  it('degrades when the head block is missing', () => {
    const summary = nodeHealthSummary({
      health: [node('https://api-a.example', { active: true, successes: 1, lastLatency: 10 })],
      globalProps: null
    })

    expect(summary.headBlock).toBe(0)
    expect(summary.status).toBe('warning')
    expect(summary.statusLabel).toBe('Degraded')
  })

  it('is unknown with no health data at all', () => {
    const summary = nodeHealthSummary()

    expect(summary.activeNode).toBeNull()
    expect(summary.nodes).toBe(0)
    expect(summary.healthy).toBe(0)
    expect(summary.failing).toBe(0)
    expect(summary.lastLatency).toBeNull()
    expect(summary.failures).toBe(0)
    expect(summary.coolingDown).toBe(0)
    expect(summary.headBlock).toBe(0)
    expect(summary.status).toBe('unknown')
    expect(summary.statusLabel).toBe('Unknown')
    expect(summary.engine).toBeNull()
    expect(summary.magi).toBeNull()
  })

  it('is unknown before a fresh session has made any request', () => {
    const summary = nodeHealthSummary({
      health: [node('https://api-a.example', { active: true })]
    })

    expect(summary.status).toBe('unknown')
  })

  it('passes Hive-Engine and Magi probes through as status rows', () => {
    const summary = nodeHealthSummary({
      health: [node('https://api-a.example', { active: true, successes: 1 })],
      globalProps: { head_block_number: 10 },
      engine: { url: 'https://herpc.dtools.dev', ok: true, latency: 118.6 },
      magi: { url: 'https://vsc.example/api/v1/graphql', ok: false, error: 'Timed out', latency: 4001 }
    })

    expect(summary.engine).toEqual({
      configured: true,
      ok: true,
      label: 'Online',
      latencyMs: 119
    })
    expect(summary.magi).toEqual({
      configured: true,
      ok: false,
      label: 'Timed out',
      latencyMs: 4001
    })
  })

  it('marks an explicitly unconfigured L2 probe', () => {
    const summary = nodeHealthSummary({ engine: { configured: false } })

    expect(summary.engine).toEqual({
      configured: false,
      ok: false,
      label: 'Not configured',
      latencyMs: null
    })
  })
})
