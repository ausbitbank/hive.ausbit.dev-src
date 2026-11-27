// Hive operation ids and the account-history bitmask helper.
//
// These are consensus constants: the chain assigns ids in this order and only
// appends new ones. Kept local so account/wallet/history routes do not need to
// import the full hive-tx helpers namespace just to build a filter.

export const operations = {
  vote: 0,
  comment: 1,
  transfer: 2,
  transfer_to_vesting: 3,
  withdraw_vesting: 4,
  limit_order_create: 5,
  limit_order_cancel: 6,
  feed_publish: 7,
  convert: 8,
  account_create: 9,
  account_update: 10,
  witness_update: 11,
  account_witness_vote: 12,
  account_witness_proxy: 13,
  pow: 14,
  custom: 15,
  report_over_production: 16,
  delete_comment: 17,
  custom_json: 18,
  comment_options: 19,
  set_withdraw_vesting_route: 20,
  limit_order_create2: 21,
  claim_account: 22,
  create_claimed_account: 23,
  request_account_recovery: 24,
  recover_account: 25,
  change_recovery_account: 26,
  escrow_transfer: 27,
  escrow_dispute: 28,
  escrow_release: 29,
  pow2: 30,
  escrow_approve: 31,
  transfer_to_savings: 32,
  transfer_from_savings: 33,
  cancel_transfer_from_savings: 34,
  custom_binary: 35,
  decline_voting_rights: 36,
  reset_account: 37,
  set_reset_account: 38,
  claim_reward_balance: 39,
  delegate_vesting_shares: 40,
  account_create_with_delegation: 41,
  witness_set_properties: 42,
  account_update2: 43,
  create_proposal: 44,
  update_proposal_votes: 45,
  remove_proposal: 46,
  update_proposal: 47,
  collateralized_convert: 48,
  recurrent_transfer: 49,
  fill_convert_request: 50,
  author_reward: 51,
  curation_reward: 52,
  comment_reward: 53,
  liquidity_reward: 54,
  interest: 55,
  fill_vesting_withdraw: 56,
  fill_order: 57,
  shutdown_witness: 58,
  fill_transfer_from_savings: 59,
  hardfork: 60,
  comment_payout_update: 61,
  return_vesting_delegation: 62,
  comment_benefactor_reward: 63,
  producer_reward: 64,
  clear_null_account_balance: 65,
  proposal_pay: 66,
  sps_fund: 67,
  hardfork_hive: 68,
  hardfork_hive_restore: 69,
  delayed_voting: 70,
  consolidate_treasury_balance: 71,
  effective_comment_vote: 72,
  ineffective_delete_comment: 73,
  sps_convert: 74,
  expired_account_notification: 75,
  changed_recovery_account: 76,
  transfer_to_vesting_completed: 77,
  pow_reward: 78,
  vesting_shares_split: 79,
  account_created: 80,
  fill_collateralized_convert_request: 81,
  system_warning: 82,
  fill_recurrent_transfer: 83,
  failed_recurrent_transfer: 84,
  limit_order_cancelled: 85,
  producer_missed: 86,
  proposal_fee: 87,
  collateralized_convert_immediate_conversion: 88,
  escrow_approved: 89,
  escrow_rejected: 90,
  proxy_cleared: 91,
  declined_voting_rights: 92
}

/** Build the `operation_filter_low`/`operation_filter_high` arguments for `get_account_history`. */
export function makeBitMaskFilter (allowedOperations) {
  return (Array.isArray(allowedOperations) ? allowedOperations : [])
    .filter(value => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean')
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value >= 0)
    .reduce(([low, high], allowedOperation) => {
      if (allowedOperation < 64) {
        return [low | (1n << BigInt(allowedOperation)), high]
      }
      return [low, high | (1n << BigInt(allowedOperation - 64))]
    }, [0n, 0n])
    .map(value => value === 0n ? null : value.toString())
}

/**
 * Resolve comma-separated operation names from a URL filter into unique ids.
 * Unknown and blank names are dropped; an empty result means "no filter".
 */
export function resolveOperationFilter (names) {
  const list = Array.isArray(names) ? names : String(names || '').split(',')
  const ids = [...new Set(list
    .map(name => operations[String(name || '').trim().toLowerCase()])
    .filter(value => Number.isInteger(value)))]
  return ids.length ? ids : null
}
