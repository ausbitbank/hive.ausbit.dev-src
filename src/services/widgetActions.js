// Pure action builders for dashboard widgets.
//
// A widget never signs and never touches key material. It builds one of these
// descriptors, shows the authority and the exact operation in a confirmation
// dialog, and only then pushes the operation onto the normal signing queue.
//
// Everything here is deterministic so the operation shape can be unit tested
// without a node or a wallet. The builders mirror the wallet page exactly:
// claiming HBD interest is still the same transfer/cancel pair the wallet uses.

import { KEY_REQUIREMENTS } from './queue'
import { parseAmount } from './witnesses'

const ACCOUNT_NAME = /^[a-z0-9][a-z0-9.-]{1,15}$/

function accountName (value) {
  const name = String(value || '').trim().replace(/^@/, '').toLowerCase()
  return ACCOUNT_NAME.test(name) ? name : ''
}

function authority (key) {
  const requirement = KEY_REQUIREMENTS[key] || KEY_REQUIREMENTS.posting
  return {
    key,
    label: requirement.label,
    shortLabel: requirement.shortLabel,
    color: requirement.color,
    icon: requirement.icon,
    detail: requirement.detail
  }
}

function action ({
  id,
  label,
  icon,
  key,
  operations,
  summary,
  details = []
}) {
  if (!Array.isArray(operations) || operations.length === 0) return null
  return {
    id,
    label,
    icon,
    authority: authority(key),
    operations,
    summary,
    details: details.filter(Boolean)
  }
}

/**
 * Claim pending author/curation rewards with posting authority.
 * Returns null when there is nothing to claim so the UI cannot queue a no-op.
 */
export function claimRewardsAction (account, record) {
  const name = accountName(account)
  if (!name || !record) return null
  const hive = parseAmount(record.reward_hive_balance)
  const hbd = parseAmount(record.reward_hbd_balance)
  const vests = String(record.reward_vesting_balance || '0.000000 VESTS')
  if (hive <= 0 && hbd <= 0 && parseFloat(vests) <= 0) return null

  return action({
    id: 'claimRewards',
    label: 'Claim rewards',
    icon: 'redeem',
    key: 'posting',
    operations: [['claim_reward_balance', {
      account: name,
      reward_hive: record.reward_hive_balance || '0.000 HIVE',
      reward_hbd: record.reward_hbd_balance || '0.000 HBD',
      reward_vests: vests
    }]],
    summary: 'Claim pending author and curation rewards to @' + name + '.',
    details: [
      hive > 0 ? hive.toFixed(3) + ' HIVE' : null,
      hbd > 0 ? hbd.toFixed(3) + ' HBD' : null,
      parseFloat(vests) > 0 ? vests + ' (Hive Power)' : null
    ]
  })
}

/**
 * Claim HBD savings interest with active authority.
 *
 * Hive pays savings interest when the savings balance is touched, so the
 * wallet claims it with a 0.001 HBD transfer to self followed by a cancel. The
 * pair must stay together; the queue signs both.
 */
export function claimInterestAction (account) {
  const name = accountName(account)
  if (!name) return null
  const requestId = 42069420
  return action({
    id: 'claimInterest',
    label: 'Claim interest',
    icon: 'trending_up',
    key: 'active',
    operations: [
      ['transfer_from_savings', {
        from: name,
        to: name,
        request_id: requestId,
        amount: '0.001 HBD',
        memo: 'Claiming HBD interest'
      }],
      ['cancel_transfer_from_savings', { from: name, request_id: requestId }]
    ],
    summary: 'Claim accrued HBD savings interest into HBD savings.',
    details: ['Queues two operations: a 0.001 HBD savings request and its cancellation.']
  })
}

/** Cancel the active power-down with active authority. */
export function cancelPowerdownAction (account) {
  const name = accountName(account)
  if (!name) return null
  return action({
    id: 'cancelPowerdown',
    label: 'Cancel power-down',
    icon: 'cancel',
    key: 'active',
    operations: [['withdraw_vesting', { account: name, vesting_shares: '0.000000 VESTS' }]],
    summary: 'Stop the weekly power-down from @' + name + '.',
    details: ['Remaining Hive Power stays staked; nothing is moved to liquid HIVE.']
  })
}

function actionId (value) {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isInteger(id) && id >= 0 ? id : null
}

/** Cancel one pending savings withdrawal with active authority. */
export function cancelSavingsWithdrawalAction (account, requestId) {
  const name = accountName(account)
  const id = actionId(requestId)
  if (!name || id === null) return null
  return action({
    id: 'cancelSavings-' + id,
    label: 'Cancel',
    icon: 'cancel',
    key: 'active',
    operations: [['cancel_transfer_from_savings', { from: name, request_id: id }]],
    summary: 'Cancel savings withdrawal request #' + id + '.',
    details: ['The amount stays in HBD/HIVE savings and stops its countdown.']
  })
}

/** Cancel one open market order with active authority. */
export function cancelOrderAction (account, orderId) {
  const name = accountName(account)
  const id = actionId(orderId)
  if (!name || id === null) return null
  return action({
    id: 'cancelOrder-' + id,
    label: 'Cancel',
    icon: 'cancel',
    key: 'active',
    operations: [['limit_order_cancel', { owner: name, orderid: id }]],
    summary: 'Cancel open market order #' + id + '.',
    details: ['Any unfilled balance returns to your liquid HIVE/HBD.']
  })
}

/** Human-readable operation name for the confirmation dialog. */
export function operationLabel (operation) {
  const name = Array.isArray(operation) ? String(operation[0] || '') : ''
  return name ? name.replace(/_/g, ' ') : 'operation'
}

export default {
  claimRewardsAction,
  claimInterestAction,
  cancelPowerdownAction,
  cancelSavingsWithdrawalAction,
  cancelOrderAction,
  operationLabel
}
