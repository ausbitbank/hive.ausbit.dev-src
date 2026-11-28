import { beforeEach, describe, expect, it, vi } from 'vitest'

const chain = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  fetchAccounts: vi.fn(),
  fetchCommunity: vi.fn(),
  fetchFollowCount: vi.fn(),
  fetchGlobalProps: vi.fn()
}))
const api = vi.hoisted(() => ({ callAsync: vi.fn() }))

vi.mock('../../src/services/chainData', () => chain)
vi.mock('../../src/services/hive', () => ({ hive: { api } }))

const {
  getAccount,
  getAccounts,
  getCommunityInfo,
  getCommunitySubscriptions,
  getFollowCount,
  getGlobalProps
} = await import('../../src/stores/hive/actions')

function context (username = 'alice') {
  return {
    user: { username },
    updateAccountData: vi.fn(),
    updateGlobalProps: vi.fn(),
    updateCommunityInfo: vi.fn(),
    updateCommunitySubscriptions: vi.fn(),
    updateFollowCount: vi.fn()
  }
}

beforeEach(() => {
  for (const fn of Object.values(chain)) fn.mockReset()
  api.callAsync.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('hive store account actions', () => {
  it('loads one account and ignores an empty name', async () => {
    const ctx = context()
    chain.fetchAccount.mockResolvedValue({ name: 'alice' })
    await getAccount.call(ctx, 'alice', { force: true })
    expect(chain.fetchAccount).toHaveBeenCalledWith('alice', { force: true })
    expect(ctx.updateAccountData).toHaveBeenCalledWith({ name: 'alice' })

    await getAccount.call(ctx, '')
    expect(chain.fetchAccount).toHaveBeenCalledTimes(1)
  })

  it('swallows a failed account read', async () => {
    const ctx = context()
    chain.fetchAccount.mockRejectedValue(new Error('down'))
    await expect(getAccount.call(ctx, 'alice')).resolves.toBeUndefined()
    expect(ctx.updateAccountData).not.toHaveBeenCalled()
  })

  it('loads a batch and skips an empty batch', async () => {
    const ctx = context()
    chain.fetchAccounts.mockResolvedValue([{ name: 'alice' }, { name: 'bob' }])
    await getAccounts.call(ctx, ['alice', 'bob'])
    expect(ctx.updateAccountData).toHaveBeenCalledTimes(2)

    await getAccounts.call(ctx, [])
    expect(chain.fetchAccounts).toHaveBeenCalledTimes(1)
  })

  it('loads global properties', async () => {
    const ctx = context()
    chain.fetchGlobalProps.mockResolvedValue({ head_block_number: 1 })
    await getGlobalProps.call(ctx, { force: true })
    expect(ctx.updateGlobalProps).toHaveBeenCalledWith({ head_block_number: 1 })
  })
})

describe('hive store community and follow actions', () => {
  it('uses the signed-in user as the community observer', async () => {
    const ctx = context('viewer')
    chain.fetchCommunity.mockResolvedValue({ name: 'hive-1' })
    await getCommunityInfo.call(ctx, 'hive-1', { force: true })
    expect(chain.fetchCommunity).toHaveBeenCalledWith('hive-1', 'viewer', { force: true })
    expect(ctx.updateCommunityInfo).toHaveBeenCalledWith({ name: 'hive-1' })
  })

  it('ignores a community response without a name', async () => {
    const ctx = context()
    chain.fetchCommunity.mockResolvedValue({})
    await getCommunityInfo.call(ctx, 'hive-1')
    expect(ctx.updateCommunityInfo).not.toHaveBeenCalled()
  })

  it('loads community subscriptions through bridge', async () => {
    const ctx = context()
    api.callAsync.mockResolvedValue([['hive-1', ['subscribe']]])
    await getCommunitySubscriptions.call(ctx, 'alice')
    expect(api.callAsync).toHaveBeenCalledWith('bridge.list_all_subscriptions', { account: 'alice' })
    expect(ctx.updateCommunitySubscriptions).toHaveBeenCalledWith([['hive-1', ['subscribe']]])
  })

  it('loads follow counts', async () => {
    const ctx = context()
    chain.fetchFollowCount.mockResolvedValue({ following: 2 })
    await getFollowCount.call(ctx, 'alice', { force: true })
    expect(ctx.updateFollowCount).toHaveBeenCalledWith({ following: 2 })
  })
})
