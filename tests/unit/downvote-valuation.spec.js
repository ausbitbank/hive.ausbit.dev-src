import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAccounts: vi.fn(),
  fetchMedianHistoryPrice: vi.fn(),
  fetchRewardFund: vi.fn()
}))

vi.mock('../../src/services/chainData', () => ({
  fetchAccounts: mocks.fetchAccounts,
  fetchMedianHistoryPrice: mocks.fetchMedianHistoryPrice,
  fetchRewardFund: mocks.fetchRewardFund
}))

const { DOWNVOTE_VALUE_VOTER_CAP, fetchDownvoteValuation } = await import('../../src/services/downvoteValuation')

beforeEach(() => {
  mocks.fetchAccounts.mockReset()
  mocks.fetchMedianHistoryPrice.mockReset()
  mocks.fetchRewardFund.mockReset()
  mocks.fetchAccounts.mockResolvedValue([
    { name: 'Bob', vesting_shares: '1.000000 VESTS' },
    { name: 'carol', vesting_shares: '2.000000 VESTS' }
  ])
  mocks.fetchRewardFund.mockResolvedValue({ recent_claims: '1', reward_balance: '1.000 HIVE' })
  mocks.fetchMedianHistoryPrice.mockResolvedValue({ base: '1.000 HBD', quote: '1.000 HIVE' })
})

describe('downvote valuation inputs', () => {
  it('normalizes, dedupes and lowercases voter names', async () => {
    const result = await fetchDownvoteValuation(['Bob', 'bob', '', ' carol '])
    expect(mocks.fetchAccounts).toHaveBeenCalledWith(['bob', 'carol'], { force: false })
    expect(Object.keys(result.accounts).sort()).toEqual(['bob', 'carol'])
    expect(result.rewardFund).toEqual({ recent_claims: '1', reward_balance: '1.000 HIVE' })
    expect(result.medianHistory).toBeTruthy()
    expect(result.unavailableVoters).toBe(0)
  })

  it('caps the voter list and reports missing accounts', async () => {
    const voters = Array.from({ length: DOWNVOTE_VALUE_VOTER_CAP + 10 }, (_, index) => 'voter' + index)
    mocks.fetchAccounts.mockResolvedValue([{ name: 'voter0' }])
    const result = await fetchDownvoteValuation(voters)
    expect(mocks.fetchAccounts.mock.calls[0][0]).toHaveLength(DOWNVOTE_VALUE_VOTER_CAP)
    expect(result.unavailableVoters).toBe(DOWNVOTE_VALUE_VOTER_CAP - 1)
  })

  it('leaves failed reads null instead of throwing', async () => {
    mocks.fetchAccounts.mockRejectedValue(new Error('accounts down'))
    mocks.fetchRewardFund.mockRejectedValue(new Error('fund down'))
    mocks.fetchMedianHistoryPrice.mockRejectedValue(new Error('price down'))
    const result = await fetchDownvoteValuation(['bob'])
    expect(result.accounts).toEqual({})
    expect(result.rewardFund).toBeNull()
    expect(result.medianHistory).toBeNull()
    expect(result.rewardFundUnavailable).toBe(true)
    expect(result.priceUnavailable).toBe(true)
  })

  it('does not call the account reader for an empty voter list', async () => {
    const result = await fetchDownvoteValuation([])
    expect(mocks.fetchAccounts).not.toHaveBeenCalled()
    expect(result.accounts).toEqual({})
    expect(result.rewardFundUnavailable).toBe(false)
  })
})
