import { beforeEach, describe, expect, it, vi } from 'vitest'

const chain = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  fetchGlobalProps: vi.fn()
}))
const prices = vi.hoisted(() => ({ getHivePrices: vi.fn() }))

vi.mock('../../src/services/chainData', () => chain)
vi.mock('../../src/services/prices', () => prices)

const { loadAccountWidgetData, resolveWidgetAccount } = await import('../../src/composables/useAccountWidget')

beforeEach(() => {
  vi.clearAllMocks()
  chain.fetchAccount.mockResolvedValue({ name: 'alice' })
  chain.fetchGlobalProps.mockResolvedValue({ head_block_number: 1 })
  prices.getHivePrices.mockResolvedValue({ hive: { usd: 0.3 } })
})

describe('loadAccountWidgetData', () => {
  it('normalises the account and shares cached reads by default', async () => {
    const vm = { $hiveStore: { user: { username: '' } } }
    const result = await loadAccountWidgetData(vm, { getSettings: () => ({ account: '@Alice' }) })

    expect(resolveWidgetAccount({ account: '@Alice' }, '')).toBe('alice')
    expect(result.accountName).toBe('alice')
    expect(chain.fetchAccount).toHaveBeenCalledWith('alice', { force: false })
    expect(chain.fetchGlobalProps).toHaveBeenCalledWith({ force: false })
    expect(prices.getHivePrices).toHaveBeenCalledWith({})
  })

  it('forces every read for an explicit refresh', async () => {
    const vm = { $hiveStore: { user: { username: 'alice' } } }
    await loadAccountWidgetData(vm, { force: true })

    expect(chain.fetchAccount).toHaveBeenCalledWith('alice', { force: true })
    expect(chain.fetchGlobalProps).toHaveBeenCalledWith({ force: true })
    expect(prices.getHivePrices).toHaveBeenCalledWith({ maxAge: 0 })
  })
})
