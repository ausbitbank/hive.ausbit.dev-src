// Who must sign a queued Hive operation?
//
// The queue tuple carries its own `posting`/`active` label. That label is
// convenient for the UI but it is not evidence: a builder bug or a restored
// queue item could ask for the wrong key. This module maps the operations the
// app actually queues to the chain's authority rule so the queue can fail
// closed instead of prompting for the wrong key.

const POSTING_OPERATIONS = new Set([
  'vote',
  'comment',
  'delete_comment',
  'comment_options'
])

const ACTIVE_OPERATIONS = new Set([
  'account_create',
  'account_create_with_delegation',
  'account_update',
  'account_witness_proxy',
  'account_witness_vote',
  'cancel_transfer_from_savings',
  'change_recovery_account',
  'claim_account',
  'claim_reward_balance',
  'collateralized_convert',
  'convert',
  'create_claimed_account',
  'create_proposal',
  'decline_voting_rights',
  'delegate_vesting_shares',
  'escrow_approve',
  'escrow_dispute',
  'escrow_release',
  'escrow_transfer',
  'limit_order_cancel',
  'limit_order_create',
  'limit_order_create2',
  'recover_account',
  'recurrent_transfer',
  'remove_proposal',
  'request_account_recovery',
  'set_withdraw_vesting_route',
  'transfer',
  'transfer_from_savings',
  'transfer_to_savings',
  'transfer_to_vesting',
  'update_proposal',
  'update_proposal_votes',
  'withdraw_vesting',
  'witness_set_properties',
  'witness_update'
])

function operationOf (action) {
  if (Array.isArray(action) && action.length === 3 && Array.isArray(action[2])) return action[2]
  if (Array.isArray(action) && action.length === 2 && typeof action[0] === 'string') return action
  return null
}

/**
 * The chain's required role for an operation array, or `null` when this app
 * does not know the operation. Unknown operations are rejected by the caller.
 */
export function requiredAuthority (operation) {
  const op = operationOf(operation)
  if (!op) return null
  const [name, body] = op
  if (typeof name !== 'string' || !name) return null

  if (name === 'custom_json') {
    const active = Array.isArray(body?.required_auths) && body.required_auths.length > 0
    return active ? 'active' : 'posting'
  }

  if (name === 'account_update2') {
    // Only posting_json_metadata (and the empty legacy json_metadata repair)
    // may be signed with the posting key. Any authority or key field escalates.
    const active = Boolean(body && (body.owner || body.active || body.posting || body.memo_key || body.json_metadata))
    return active ? 'active' : 'posting'
  }

  if (POSTING_OPERATIONS.has(name)) return 'posting'
  if (ACTIVE_OPERATIONS.has(name)) return 'active'
  return null
}

/**
 * Return an error string when an action's declared authority, operation and
 * owner cannot be reconciled with the signed-in account. `''` means valid.
 */
export function queueAuthorityError (action, user = '') {
  if (!Array.isArray(action) || action.length !== 3) return 'Malformed queue item.'
  const [owner, keyType, operation] = action
  if (!owner || typeof owner !== 'string') return 'Queue item has no owner.'
  if (keyType !== 'posting' && keyType !== 'active') return 'Queue item has an unknown authority.'
  const required = requiredAuthority(operation)
  if (!required) return 'This operation has no known signing authority.'
  if (required !== keyType) {
    return 'This operation needs the ' + required + ' key, not the ' + keyType + ' key.'
  }
  const signedIn = String(user || '').trim().replace(/^@/, '').toLowerCase()
  const ownerName = String(owner).trim().replace(/^@/, '').toLowerCase()
  if (signedIn && ownerName !== signedIn) {
    return 'This queue item belongs to @' + owner + ', not the signed-in account.'
  }
  return ''
}
