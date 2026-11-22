import { describe, expect, it } from 'vitest'
import { magiNetworkSummary } from '../../src/services/magiNetworkSummary'

const NODE = {
  url: 'https://magi.example/graphql',
  ok: true,
  head: 12345,
  version: 'v0.10.0',
  latency: 84
}

function witness (account, extra = {}) {
  return {
    account,
    versionId: 'vsc-node-abc',
    enabled: true,
    delegationMode: 'single',
    ...extra
  }
}

const CONTRACTS = {
  endpoint: 'https://magi.example/graphql',
  contracts: [
    { id: 'vsc1abcdefghijklmnop', name: 'Tip jar', owner: 'alice', creation_height: 12000 },
    { id: 'vsc1qrstuvwxyzabcdef', name: '', owner: 'bob', activation_height: 11000 },
    { id: 'vsc1zzzz', name: 'Shop', owner: 'carol', creation_height: 10000 }
  ]
}

const TOKENS = {
  pricesBySymbol: {
    dec: { priceHbd: 0.42, poolDepthHbd: 1000 },
    leo: { priceHbd: 0.12, poolDepthHbd: 5000 },
    swap: { priceHbd: 3.1, poolDepthHbd: 250 }
  },
  hbdPerHive: 3.2
}

describe('Magi network summary', () => {
  it('shapes a healthy probe with witnesses, contracts and token prices', () => {
    const summary = magiNetworkSummary({
      node: NODE,
      witnesses: [witness('node-a'), witness('node-b', { enabled: false }), witness('node-c')],
      contracts: CONTRACTS,
      tokens: TOKENS
    })

    expect(summary.available).toBe(true)
    expect(summary.node).toEqual({
      url: NODE.url,
      ok: true,
      head: 12345,
      version: 'v0.10.0',
      latency: 84,
      suspended: false,
      label: 'Online'
    })
    expect(summary.witnesses.count).toBe(3)
    expect(summary.witnesses.enabled).toBe(2)
    expect(summary.witnesses.top).toHaveLength(3)
    expect(summary.witnesses.top[0]).toEqual({
      account: 'node-a',
      versionId: 'vsc-node-abc',
      enabled: true,
      delegationMode: 'single'
    })
    expect(summary.contracts).toEqual([
      {
        id: 'vsc1abcdefghijklmnop',
        owner: 'alice',
        timestamp: '',
        height: 12000,
        label: 'Tip jar'
      },
      {
        id: 'vsc1qrstuvwxyzabcdef',
        owner: 'bob',
        timestamp: '',
        height: 11000,
        label: 'vsc1qrstuv…abcdef'
      },
      {
        id: 'vsc1zzzz',
        owner: 'carol',
        timestamp: '',
        height: 10000,
        label: 'Shop'
      }
    ])
    // The deepest pool is listed first.
    expect(summary.tokens.map(token => token.symbol)).toEqual(['leo', 'dec', 'swap'])
    expect(summary.tokens[0].priceHbd).toBe(0.12)
    expect(summary.hbdPerHive).toBe(3.2)
    expect(summary.status).toBe('healthy')
    expect(summary.statusLabel).toBe('Healthy')
  })

  it('reports an unreachable probe as critical without other data', () => {
    const summary = magiNetworkSummary({
      node: { url: NODE.url, ok: false, latency: 4000, error: 'Timed out' }
    })

    expect(summary.available).toBe(false)
    expect(summary.node).toMatchObject({
      ok: false,
      head: null,
      latency: 4000,
      label: 'Timed out'
    })
    expect(summary.status).toBe('critical')
    expect(summary.statusLabel).toBe('Unreachable')
  })

  it('returns safe empty values when nothing has loaded yet', () => {
    const summary = magiNetworkSummary()

    expect(summary.available).toBe(false)
    expect(summary.node).toBeNull()
    expect(summary.witnesses).toEqual({ count: 0, enabled: 0, top: [] })
    expect(summary.contracts).toEqual([])
    expect(summary.tokens).toEqual([])
    expect(summary.hbdPerHive).toBeNull()
    expect(summary.status).toBe('unknown')
    expect(summary.statusLabel).toBe('Unknown')
  })

  it('caps witnesses, contracts and tokens at the requested limit', () => {
    const summary = magiNetworkSummary({
      node: NODE,
      witnesses: [witness('a'), witness('b'), witness('c')],
      contracts: CONTRACTS,
      tokens: TOKENS,
      limit: 2
    })

    expect(summary.witnesses.count).toBe(3)
    expect(summary.witnesses.top.map(row => row.account)).toEqual(['a', 'b'])
    expect(summary.contracts.map(row => row.label)).toEqual(['Tip jar', 'vsc1qrstuv…abcdef'])
    expect(summary.tokens.map(token => token.symbol)).toEqual(['leo', 'dec'])
  })

  it('degrades an otherwise healthy node when no witnesses were returned', () => {
    const summary = magiNetworkSummary({ node: NODE, witnesses: [] })

    expect(summary.status).toBe('warning')
    expect(summary.statusLabel).toBe('Degraded')
  })

  it('flags a suspended node as critical', () => {
    const summary = magiNetworkSummary({
      node: { ...NODE, processingSuspended: true },
      witnesses: [witness('a')]
    })

    expect(summary.node.suspended).toBe(true)
    expect(summary.status).toBe('critical')
    expect(summary.statusLabel).toBe('Needs attention')
  })

  it('tolerates bare arrays, missing fields and broken token maps', () => {
    const summary = magiNetworkSummary({
      node: { url: NODE.url, ok: true },
      witnesses: [{ account: 'silent' }],
      contracts: [{}, { id: 'vsc1short', name: null }],
      tokens: {
        pricesBySymbol: {
          good: { priceHbd: 1.5 },
          bad: { priceHbd: 'nope' },
          zero: { priceHbd: 0 }
        }
      }
    })

    expect(summary.node.head).toBeNull()
    expect(summary.node.version).toBe('')
    expect(summary.witnesses.top).toEqual([
      { account: 'silent', versionId: '', enabled: false, delegationMode: '' }
    ])
    expect(summary.contracts).toEqual([
      { id: '', owner: '', timestamp: '', height: null, label: 'Unnamed contract' },
      { id: 'vsc1short', owner: '', timestamp: '', height: null, label: 'vsc1short' }
    ])
    expect(summary.tokens).toEqual([{ symbol: 'good', priceHbd: 1.5 }])
    expect(summary.hbdPerHive).toBeNull()
    expect(summary.status).toBe('healthy')
  })
})
