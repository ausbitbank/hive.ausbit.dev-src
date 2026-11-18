// Central mapping from a signed operation to the read caches it invalidates.
//
// Every write still goes through the queue. Once the queue reports a successful
// broadcast this module clears the affected chain-data entries so the next page
// read does not show the pre-transaction state.

import {
  invalidateAccountCache,
  invalidateCommunityCache,
  invalidateFollowCountCache,
  invalidateGlobalPropsCache,
  invalidateMedianCache,
  invalidateOpenOrderCache,
  invalidatePostCache,
  invalidateTickerCache,
  invalidateWitnessCache
} from './chainData'
import { removeSnapshot, removeSnapshotsByPrefix } from './snapshots'

const EXPECTED_ACCOUNT_FIELDS = [
  'from',
  'to',
  'owner',
  'account',
  'voter',
  'author',
  'delegator',
  'delegatee',
  'proxy',
  'witness',
  'publisher',
  'buyer',
  'seller',
  'receiver',
  'new_account_name',
  'creator',
  'from_account',
  'to_account'
]

const BALANCE_OPERATIONS = new Set([
  'transfer',
  'recurrent_transfer',
  'transfer_to_vesting',
  'withdraw_vesting',
  'delegate_vesting_shares',
  'set_withdraw_vesting_route',
  'transfer_to_savings',
  'transfer_from_savings',
  'cancel_transfer_from_savings',
  'claim_reward_balance',
  'convert',
  'collateralized_convert',
  'limit_order_create',
  'limit_order_cancel',
  'create_claimed_account',
  'account_create',
  'account_create_with_delegation'
])

const POST_OPERATIONS = new Set([
  'vote',
  'comment',
  'comment_options',
  'delete_comment'
])

const WITNESS_OPERATIONS = new Set([
  'account_witness_vote',
  'account_witness_proxy',
  'witness_update',
  'witness_set_properties'
])

const ACCOUNT_OPERATIONS = new Set([
  'account_update',
  'account_update2'
])

function operationParts (operation) {
  if (Array.isArray(operation)) {
    // Accept a queue item (`[user, authority, [name, data]]`) as well as a
    // bare operation (`[name, data]`).
    if (
      operation.length === 3 &&
      typeof operation[0] === 'string' &&
      (operation[1] === 'posting' || operation[1] === 'active') &&
      Array.isArray(operation[2])
    ) {
      return [operation[2][0], operation[2][1] || {}]
    }
    if (Array.isArray(operation[0])) return [operation[0][0], operation[0][1] || {}]
    return [operation[0], operation[1] || {}]
  }
  const nested = operation?.op
  if (Array.isArray(nested)) return [nested[0], nested[1] || {}]
  return [operation?.name || '', operation?.data || {}]
}

function accountNames (data, signer) {
  const names = new Set()
  if (signer) names.add(String(signer))
  for (const field of EXPECTED_ACCOUNT_FIELDS) {
    if (data && typeof data[field] === 'string' && data[field]) names.add(data[field])
  }
  return names
}

function invalidateAccounts (names) {
  let removed = 0
  for (const name of names) removed += invalidateAccountCache(name)
  return removed
}

function customJsonCommunity (data) {
  if (data?.id !== 'community' || typeof data.json !== 'string') return null
  try {
    const parsed = JSON.parse(data.json)
    return Array.isArray(parsed) ? parsed[1]?.community || null : null
  } catch {
    return null
  }
}

/**
 * Invalidate cached reads affected by a signed operation.
 * Returns a small summary so telemetry/debug panels can show what was cleared.
 */
export function invalidateOperationCaches (operation, { signer = '' } = {}) {
  const [name, data] = operationParts(operation)
  const accounts = accountNames(data, signer)
  let accountsRemoved = 0
  let postsRemoved = 0
  let witnessRemoved = 0
  let ordersRemoved = 0
  let communitiesRemoved = 0
  let followCountsRemoved = 0
  let globalPropsRemoved = 0
  let snapshotsRemoved = 0

  if (POST_OPERATIONS.has(name)) {
    postsRemoved += invalidatePostCache()
    snapshotsRemoved += removeSnapshotsByPrefix('home:posts:')
  }

  if (name === 'custom_json') {
    // Follows, reblogs and community subscriptions all surface in post lists.
    postsRemoved += invalidatePostCache()
    followCountsRemoved += invalidateFollowCountCache()
    snapshotsRemoved += removeSnapshotsByPrefix('home:posts:')
    const community = customJsonCommunity(data)
    if (community) communitiesRemoved += invalidateCommunityCache(community)
  }

  if (WITNESS_OPERATIONS.has(name)) {
    witnessRemoved += invalidateWitnessCache()
    globalPropsRemoved += invalidateGlobalPropsCache()
    if (removeSnapshot('home:witnesses')) snapshotsRemoved += 1
    if (removeSnapshot('health:summary')) snapshotsRemoved += 1
  }

  if (ACCOUNT_OPERATIONS.has(name)) {
    postsRemoved += invalidatePostCache()
    snapshotsRemoved += removeSnapshotsByPrefix('home:posts:')
  }

  if (BALANCE_OPERATIONS.has(name)) {
    globalPropsRemoved += invalidateGlobalPropsCache()
    globalPropsRemoved += invalidateTickerCache()
    globalPropsRemoved += invalidateMedianCache()
    if (removeSnapshot('health:summary')) snapshotsRemoved += 1
    const orderOwners = new Set([data?.owner, data?.account, data?.from, signer].filter(Boolean))
    for (const owner of orderOwners) ordersRemoved += invalidateOpenOrderCache(owner)
  }

  accountsRemoved += invalidateAccounts(accounts)

  return {
    operation: name,
    accounts: [...accounts],
    accountsRemoved,
    postsRemoved,
    witnessRemoved,
    ordersRemoved,
    communitiesRemoved,
    followCountsRemoved,
    globalPropsRemoved,
    snapshotsRemoved
  }
}
