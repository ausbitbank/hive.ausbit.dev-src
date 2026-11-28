// Optional post-creation delegation for a new Hive account.
//
// A brand-new account has no Resource Credits and no Hive Power, so its first
// transaction is often impossible until someone helps. These helpers build the
// two operations a sponsor can queue *after* the account-creation operation:
// the posting-authority `rc` custom_json (`delegate_rc`) and the
// active-authority `delegate_vesting_shares`.
//
// The account-creation transaction is not merged with these operations on
// purpose. The queue sends items in order and each authority is reviewed
// individually, so a failed creation leaves an obvious failed delegation rather
// than a partially-applied bundle. Nothing is broadcast automatically.

import { isValidHiveAccountName } from './blogHost'
import { parseAmount } from './witnesses'

/** UI default: 5 billion RC is enough for a new account to transact. */
export const DEFAULT_RC_DELEGATION = 5_000_000_000
/** UI default when the sponsor opts into a small HP delegation. */
export const DEFAULT_HP_DELEGATION = 5
/** Guardrail against a typo or a crafted link sending an absurd delegation. */
export const MAX_RC_DELEGATION = 1_000_000_000_000
export const MAX_HP_DELEGATION = 10_000_000

export function normalizeRcAmount (value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_RC_DELEGATION) return null
  return Math.floor(amount)
}

export function normalizeHpAmount (value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_HP_DELEGATION) return null
  return amount
}

/** Convert Hive Power to the VESTS string `delegate_vesting_shares` expects. */
export function hpToVests (hp, globalProps) {
  const shares = parseAmount(globalProps?.total_vesting_shares)
  const fund = parseAmount(globalProps?.total_vesting_fund_hive)
  const amount = normalizeHpAmount(hp)
  if (!shares || !fund || amount === null || amount <= 0) return ''
  const vests = (amount * shares) / fund
  if (!Number.isFinite(vests) || vests <= 0) return ''
  return vests.toFixed(6) + ' VESTS'
}

/**
 * Build the ordered active-key operations for a sponsor.
 *
 * Returns `[]` when both amounts are zero. Throws a readable error for an
 * invalid account, a negative/absurd amount, or an HP request when global
 * properties are unavailable (the conversion cannot be guessed).
 */
export function buildDelegationOperations ({
  sponsor,
  account,
  rcAmount = 0,
  hpAmount = 0,
  globalProps = null
} = {}) {
  const from = String(sponsor || '').trim().replace(/^@/, '').toLowerCase()
  const to = String(account || '').trim().replace(/^@/, '').toLowerCase()
  if (!isValidHiveAccountName(from)) throw new Error('The sponsoring account name is invalid.')
  if (!isValidHiveAccountName(to)) throw new Error('The new account name is invalid.')
  if (from === to) throw new Error('Choose a different account to delegate to.')

  const rc = normalizeRcAmount(rcAmount)
  if (rc === null) throw new Error('The Resource Credit delegation is not a valid amount.')
  const hp = normalizeHpAmount(hpAmount)
  if (hp === null) throw new Error('The Hive Power delegation is not a valid amount.')

  const operations = []
  if (rc > 0) {
    // RC delegation is the Hive `rc` custom_json, not a native operation. The
    // protocol requires posting authority, so this is a posting-key action.
    operations.push(['custom_json', {
      required_auths: [],
      required_posting_auths: [from],
      id: 'rc',
      json: JSON.stringify(['delegate_rc', {
        from,
        delegatees: [to],
        max_rc: rc,
        extensions: []
      }])
    }])
  }
  if (hp > 0) {
    const vestingShares = hpToVests(hp, globalProps)
    if (!vestingShares) {
      throw new Error('Hive Power conversion is unavailable. Reload the chain properties and try again.')
    }
    operations.push(['delegate_vesting_shares', {
      delegator: from,
      delegatee: to,
      vesting_shares: vestingShares
    }])
  }
  return operations
}
