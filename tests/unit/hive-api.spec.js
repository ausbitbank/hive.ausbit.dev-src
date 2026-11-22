import { beforeEach, describe, expect, it, vi } from 'vitest'

const { configureApi, rpcRequest, setHiveTxNode } = vi.hoisted(() => ({
  configureApi: vi.fn(),
  rpcRequest: vi.fn(),
  setHiveTxNode: vi.fn()
}))

vi.mock('../../src/services/api', () => ({
  configureApi,
  rpcRequest
}))

vi.mock('../../src/services/hiveTx', () => ({
  setHiveTxNode
}))

vi.mock('../../src/services/hiveNodes', () => ({
  DEFAULT_HIVE_NODE: 'https://default.example',
  HIVE_API_NODES: ['https://default.example', 'https://fallback.example']
}))

import { hive, setHiveNode } from '../../src/services/hive'

describe('hive.api read facade', () => {
  beforeEach(() => {
    configureApi.mockReset()
    rpcRequest.mockReset()
    rpcRequest.mockResolvedValue([])
    setHiveTxNode.mockReset()
  })

  it('maps named reads to the shapes hive-js returned', async () => {
    await hive.api.getBlockAsync(42)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_block', [42])

    await hive.api.getOpsInBlockAsync(42, true)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_ops_in_block', [42, true])

    await hive.api.getAccountHistory('alice', -1, 20)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_account_history', ['alice', -1, 20])

    await hive.api.getTickerAsync()
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_ticker', [])

    await hive.api.getOrderBookAsync(200)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_order_book', [200])

    await hive.api.getRecentTradesAsync(100)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_recent_trades', [100])

    await hive.api.getWithdrawRoutesAsync('alice', 1)
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_withdraw_routes', ['alice', 1])
  })

  it('wraps account names and supports the legacy call form', async () => {
    await hive.api.getAccountsAsync('alice')
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_accounts', [['alice']])

    await hive.api.callAsync('call', ['condenser_api', 'get_account_history', ['alice', -1, 10]])
    expect(rpcRequest).toHaveBeenLastCalledWith('condenser_api.get_account_history', ['alice', -1, 10])

    await hive.api.callAsync('bridge.get_profile', { account: 'alice' })
    expect(rpcRequest).toHaveBeenLastCalledWith('bridge.get_profile', { account: 'alice' })
  })

  it('keeps the read client and signing stack on the selected node', () => {
    setHiveNode('https://node.example')
    expect(configureApi).toHaveBeenCalledWith({ node: 'https://node.example' })
    expect(setHiveTxNode).toHaveBeenCalledWith('https://node.example')

    hive.api.setOptions({ url: 'https://other.example' })
    expect(configureApi).toHaveBeenLastCalledWith({ node: 'https://other.example' })
    expect(setHiveTxNode).toHaveBeenLastCalledWith('https://other.example')
  })
})
