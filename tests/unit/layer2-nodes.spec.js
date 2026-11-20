import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HIVE_ENGINE_NODES } from '../../src/services/hiveNodes'
import { probeHiveEngineNode, selectHiveEngineNode } from '../../src/services/hiveEngine'
import {
  fetchMagiAccountDetails,
  fetchMagiContract,
  fetchMagiContractState,
  fetchMagiTokenPrices,
  fetchMagiTokens,
  fetchMagiWitnesses,
  magiEndpointOrder,
  probeMagiNode,
  simulateMagiContractCall
} from '../../src/services/magi'

function jsonResponse (json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json
  }
}

describe('Hive-Engine node probes', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('reads status fields from the node root', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      lastBlockNumber: 64736746,
      lastBlockRefHiveBlockNumber: 111815100,
      lastParsedHiveBlockNumber: 111815102,
      SSCnodeVersion: 'ivm-1.1.4',
      chainId: 'mainnet-hive',
      lightNode: false,
      disabledMethods: { blockchain: ['getBlockRangeInfo'] },
      lastVerifiedBlockNumber: 64736740
    }))

    const result = await probeHiveEngineNode('https://he.example/')

    expect(result).toMatchObject({
      url: 'https://he.example',
      ok: true,
      head: 64736746,
      hiveHead: 111815100,
      version: 'ivm-1.1.4',
      chainId: 'mainnet-hive',
      lightNode: false,
      lastVerifiedBlock: 64736740
    })
    expect(fetchMock.mock.calls[0][0]).toBe('https://he.example/')
  })

  it('reports HTTP and payload failures without throwing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503))
    await expect(probeHiveEngineNode('https://he.example')).resolves.toMatchObject({
      ok: false,
      error: 'HTTP 503'
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({ SSCnodeVersion: 'ivm-1.1.4' }))
    await expect(probeHiveEngineNode('https://he.example')).resolves.toMatchObject({
      ok: false,
      answered: true,
      error: 'Invalid status response'
    })
  })

  it('keeps a healthy configured node and falls back when it is down', async () => {
    fetchMock.mockImplementation(url => {
      if (url.startsWith('https://configured.example')) return Promise.resolve(jsonResponse({ lastBlockNumber: 10 }))
      return Promise.resolve(jsonResponse({}, 500))
    })

    await expect(selectHiveEngineNode('https://configured.example')).resolves.toBe('https://configured.example')

    fetchMock.mockImplementation(url => {
      if (url === HIVE_ENGINE_NODES[2] + '/') return Promise.resolve(jsonResponse({ lastBlockNumber: 20 }))
      return Promise.resolve(jsonResponse({}, 500))
    })

    await expect(selectHiveEngineNode('https://configured.example')).resolves.toBe(HIVE_ENGINE_NODES[2])
  })
})

describe('Magi node probes', () => {
  let fetchMock
  let originalFetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('orders the configured endpoint first without duplicates', () => {
    expect(magiEndpointOrder('https://custom.example')).toEqual([
      'https://custom.example',
      'https://vsc.techcoderx.com/api/v1/graphql',
      'https://api.vsc.eco/api/v1/graphql',
      'https://vsc.atexoras.com:2087/api/v1/graphql'
    ])
    expect(magiEndpointOrder('https://vsc.techcoderx.com/api/v1/graphql')[0]).toBe('https://vsc.techcoderx.com/api/v1/graphql')
  })

  it('reads localNodeInfo through the node probe', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        localNodeInfo: {
          version_id: 'go-v0.1.0',
          running_version: '0.16.0',
          git_commit: 'abcdef1234567890',
          last_processed_block: 111815500,
          epoch: 2282,
          consensus_version_display: '0.14.0',
          processing_suspended: false,
          active_consensus_line: '0.14',
          active_consensus_executor: 'passthrough-unregistered'
        }
      }
    }))

    const result = await probeMagiNode('https://magi.example/graphql')

    expect(result).toMatchObject({
      url: 'https://magi.example/graphql',
      ok: true,
      head: 111815500,
      version: '0.16.0',
      epoch: 2282,
      consensusVersion: '0.14.0',
      processingSuspended: false
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.query).toContain('localNodeInfo')
  })

  it('reports invalid responses and timeouts', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { localNodeInfo: null } }))
    await expect(probeMagiNode('https://magi.example/graphql')).resolves.toMatchObject({
      ok: false,
      answered: true,
      error: 'Invalid localNodeInfo'
    })

    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))
    const promise = probeMagiNode('https://slow.example/graphql', 50)
    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toMatchObject({ ok: false, error: 'Timed out' })
    vi.useRealTimers()
  })

  it('maps contract, pending and output aliases correctly', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        contract: [{ id: 'vsc1contract', name: 'Test contract' }],
        pending: [{ id: 'vsc1contract', tx_id: 'pending-tx' }],
        outputs: [{ id: 'output-1', results: [{ ret: 'ok', ok: true }] }]
      }
    }))

    const result = await fetchMagiContract('vsc1contract', { force: true })

    expect(result.contract).toMatchObject({ id: 'vsc1contract', name: 'Test contract' })
    expect(result.pending).toHaveLength(1)
    expect(result.outputs).toHaveLength(1)
  })

  it('maps getStateByKeys and witness rows', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { state: { config: 'value' } } }))
    await expect(fetchMagiContractState('vsc1contract', ['config'], { force: true })).resolves.toMatchObject({
      keys: ['config'],
      state: { config: 'value' }
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({
      data: {
        witnessNodes: [{
          account: 'techcoderx.vsc',
          height: 111815500,
          version_id: 'go-v0.1.0',
          git_commit: 'abcdef1234567890',
          net_id: 'vsc-mainnet',
          peer_id: '12D3KooWpeer',
          protocol_version: 16,
          enabled: true,
          delegation_mode: 'deactivated',
          ts: '2026-11-20T00:00:00Z',
          tx_id: 'tx'
        }]
      }
    }))
    const witnesses = await fetchMagiWitnesses(111815500, { force: true })
    expect(witnesses).toHaveLength(1)
    expect(witnesses[0]).toMatchObject({ account: 'techcoderx.vsc', enabled: true, delegationMode: 'deactivated' })
  })

  it('maps RC, nonce, node mode and consensus stake', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        getAccountRC: { account: 'hive:alice', amount: 10025, max_rcs: 20000, block_height: 123 },
        getAccountNonce: { account: 'hive:alice', nonce: 7 },
        getNodeDelegationMode: 'share',
        witnessStake: 2000000
      }
    }))

    await expect(fetchMagiAccountDetails('alice', { force: true })).resolves.toMatchObject({
      account: 'hive:alice',
      rc: { amount: 10025, max: 20000 },
      nonce: 7,
      delegationMode: 'share',
      witnessStake: 2000
    })
  })

  it('reads standard Magi token balances from the indexer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        magi_token_balances: [
          { contract_id: 'vsc1token', balance: 242857 }
        ],
        magi_token_overview: [
          { contract_id: 'vsc1token', symbol: 'STARPRO', decimals: 5 }
        ]
      }
    }))

    await expect(fetchMagiTokens('alice', { force: true })).resolves.toMatchObject({
      tokens: [{
        contractId: 'vsc1token',
        symbol: 'STARPRO',
        decimals: 5,
        raw: '242857',
        amountLabel: '2.42857'
      }]
    })
    expect(fetchMock.mock.calls[0][0]).toContain('indexer.magi.milohpr.com')
  })

  it('reads Magi DEX pool prices from the indexer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        dex_pool_registry: [
          { pool_contract: 'pool', asset0: 'hbd', asset1: 'starpro' }
        ],
        dex_pool_liquidity: [
          { pool_contract: 'pool', reserve0: 17000, reserve1: 242857 }
        ],
        magi_token_overview: [
          { contract_id: 'vsc1starpro', symbol: 'STARPRO', decimals: 5 }
        ]
      }
    }))

    const result = await fetchMagiTokenPrices({ force: true })
    expect(result.pricesBySymbol.starpro.priceHbd).toBeCloseTo(7, 4)
    expect(fetchMock.mock.calls[0][0]).toContain('indexer.magi.milohpr.com')
  })

  it('builds a posting-authority simulation request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      data: {
        simulateContractCalls: [{
          success: true,
          err: null,
          err_msg: null,
          ret: 'hello',
          rc_used: 100,
          gas_used: 434
        }]
      }
    }))

    const result = await simulateMagiContractCall({
      contractId: 'vsc1contract',
      action: 'ping',
      payload: '{}',
      account: 'alice',
      keyType: 'posting'
    }, { force: true })

    expect(result.result).toMatchObject({ success: true, ret: 'hello' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const input = body.variables.input
    expect(input.required_posting_auths).toEqual(['hive:alice'])
    expect(input.calls[0]).toMatchObject({
      contract_id: 'vsc1contract',
      action: 'ping',
      payload: '{}'
    })
  })
})
