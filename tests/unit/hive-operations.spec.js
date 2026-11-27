import { describe, expect, it } from 'vitest'
import { makeBitMaskFilter, operations, resolveOperationFilter } from '../../src/services/hiveOperations'

describe('hive operations', () => {
  it('keeps the consensus operation ids used by the queue and history filters', () => {
    expect(operations.vote).toBe(0)
    expect(operations.comment).toBe(1)
    expect(operations.transfer).toBe(2)
    expect(operations.comment_options).toBe(19)
    expect(operations.recurrent_transfer).toBe(49)
    expect(operations.account_update2).toBe(43)
    expect(operations.update_proposal_votes).toBe(45)
    expect(operations.declined_voting_rights).toBe(92)
  })

  it('builds the same account-history filters the old serializer did', () => {
    expect(makeBitMaskFilter([operations.vote])).toEqual(['1', null])
    expect(makeBitMaskFilter([operations.vote, operations.comment])).toEqual(['3', null])
    expect(makeBitMaskFilter([
      operations.transfer,
      operations.transfer_to_vesting,
      operations.withdraw_vesting,
      operations.interest,
      operations.liquidity_reward,
      operations.transfer_to_savings,
      operations.transfer_from_savings,
      operations.fill_transfer_from_savings,
      operations.cancel_transfer_from_savings,
      operations.fill_convert_request,
      operations.fill_order,
      operations.claim_reward_balance,
      operations.convert,
      operations.collateralized_convert,
      operations.fill_vesting_withdraw
    ])).toEqual(['848084684649791772', null])
    expect(makeBitMaskFilter([
      operations.transfer,
      operations.withdraw_vesting,
      operations.interest,
      operations.fill_convert_request,
      operations.fill_order,
      operations.limit_order_create,
      operations.proposal_pay,
      operations.convert
    ])).toEqual(['181269885001662772', '4'])
  })

  it('ignores malformed ids instead of throwing a BigInt error', () => {
    expect(makeBitMaskFilter([undefined, null, NaN, 'nope', -1, 1.5])).toEqual([null, null])
    expect(makeBitMaskFilter([operations.vote, undefined, operations.comment])).toEqual(['3', null])
    expect(makeBitMaskFilter(null)).toEqual([null, null])
  })
})

describe('resolveOperationFilter', () => {
  it('maps names to unique ids and drops blanks or unknowns', () => {
    expect(resolveOperationFilter('vote,transfer')).toEqual([0, 2])
    expect(resolveOperationFilter(' vote , VOTE , transfer, ')).toEqual([0, 2])
    expect(resolveOperationFilter(['comment'])).toEqual([1])
    expect(resolveOperationFilter('votes,transfer')).toEqual([2])
    expect(resolveOperationFilter('votes,')).toBeNull()
    expect(resolveOperationFilter('')).toBeNull()
    expect(resolveOperationFilter(null)).toBeNull()
  })
})
