// Account authority risk and readable permission diffs.
//
// The checks are intentionally conservative: they describe observable key
// configuration and never claim a key is compromised. Each finding is paired
// with a concrete next step so the card is actionable rather than alarming.

import { governanceVoteExpiry } from './governance'
import moment from '../utils/time'

const DAY_MS = 24 * 60 * 60 * 1000
const PERMISSIONS = ['owner', 'active', 'posting']
const SEVERITY_WEIGHT = { critical: 45, warning: 18, info: 5 }
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

function pairs (value) {
  return (Array.isArray(value) ? value : [])
    .filter(pair => Array.isArray(pair) && pair.length >= 2)
    .map(pair => [String(pair[0]), Number(pair[1]) || 0])
}

function timeValue (value) {
  if (!value) return null
  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

export function normalizeAuthority (authority) {
  const keys = pairs(authority?.key_auths).map(([key, weight]) => ({ key, weight }))
  const accounts = pairs(authority?.account_auths).map(([account, weight]) => ({ account, weight }))
  return {
    keys,
    accounts,
    weight_threshold: Number(authority?.weight_threshold) || 0,
    totalWeight: [...keys, ...accounts].reduce((sum, entry) => sum + entry.weight, 0),
    keyCount: keys.length,
    accountCount: accounts.length,
    topKeyWeight: keys.reduce((max, entry) => Math.max(max, entry.weight), 0)
  }
}

export function authoritySummary (account) {
  const summary = {}
  for (const permission of PERMISSIONS) {
    summary[permission] = normalizeAuthority(account?.[permission])
  }
  return summary
}

function keyUsage (account) {
  const usage = new Map()
  for (const permission of PERMISSIONS) {
    for (const entry of normalizeAuthority(account?.[permission]).keys) {
      if (!usage.has(entry.key)) usage.set(entry.key, [])
      usage.get(entry.key).push(permission)
    }
  }
  return usage
}

function finding (id, severity, label, detail, icon) {
  return { id, severity, label, detail, icon }
}

/**
 * Build the authority risk model for one account.
 *
 * `witness` is optional and only used to mention a disabled witness signing
 * key; it does not change the account's own authority score.
 */
export function authorityRisk (account, options = {}) {
  const now = options.now ? Number(options.now) : Date.now()
  const findings = []
  if (!account) {
    return {
      level: 'unknown',
      score: 0,
      findings: [],
      permissions: {},
      keyUsage: [],
      ownerAgeDays: null,
      queuedChanges: []
    }
  }

  const permissions = authoritySummary(account)
  const usage = keyUsage(account)

  if (permissions.owner.keyCount === 0 && permissions.owner.accountCount === 0) {
    findings.push(finding('owner-missing', 'critical', 'No owner authority',
      'The owner permission has no keys or accounts, so recovery and authority changes may be impossible.', 'gpp_bad'))
  }
  if (permissions.active.keyCount === 0 && permissions.active.accountCount === 0) {
    findings.push(finding('active-missing', 'critical', 'No active authority',
      'The active permission has no keys or accounts, so transfers and other active actions cannot be signed.', 'gpp_bad'))
  }
  if (permissions.posting.keyCount === 0 && permissions.posting.accountCount === 0) {
    findings.push(finding('posting-missing', 'warning', 'No posting authority',
      'The posting permission has no keys or accounts, so the account cannot publish or vote.', 'gpp_maybe'))
  }

  const ownerKeys = new Set(permissions.owner.keys.map(entry => entry.key))
  const activeKeys = new Set(permissions.active.keys.map(entry => entry.key))
  const postingKeys = new Set(permissions.posting.keys.map(entry => entry.key))
  const sharedOwnerActive = [...ownerKeys].filter(key => activeKeys.has(key))
  const sharedActivePosting = [...activeKeys].filter(key => postingKeys.has(key))

  if (sharedOwnerActive.length > 0) {
    findings.push(finding('owner-active-reuse', 'critical', 'Owner and active keys are the same',
      'A key with owner authority can also perform active actions. Compromise of one key exposes every permission; use a separate offline owner key.', 'vpn_key'))
  }
  if (sharedActivePosting.length > 0) {
    findings.push(finding('active-posting-reuse', 'warning', 'Active and posting keys are the same',
      'Apps that request a posting key would receive an active-capable key. Use a dedicated posting key for daily use.', 'vpn_key'))
  }

  const reusedKeys = [...usage.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, permissions: list }))
    .filter(row => !(row.permissions.includes('owner') && row.permissions.includes('active')))
    .filter(row => !(row.permissions.includes('active') && row.permissions.includes('posting')))

  if (reusedKeys.length > 0) {
    findings.push(finding('key-reuse', 'warning', 'A key is reused across permissions',
      reusedKeys.length + ' key' + (reusedKeys.length === 1 ? ' appears' : 's appear') + ' in more than one permission. Separate keys limit the impact of a leak.', 'content_copy'))
  }

  for (const permission of PERMISSIONS) {
    const auth = permissions[permission]
    const otherAccounts = auth.accounts.filter(entry => entry.account !== account.name)
    if (otherAccounts.length === 0) continue
    const severity = permission === 'posting' ? 'info' : 'warning'
    const label = permission === 'posting'
      ? 'Apps can post for this account'
      : '@' + permission + ' permission is shared with other accounts'
    const detail = otherAccounts.map(entry => '@' + entry.account + ' (' + entry.weight + ')').join(', ') +
      '. Shared authority moves the trust boundary beyond a single key; review it periodically.'
    findings.push(finding(permission + '-account-auth', severity, label, detail, 'group'))
  }

  if (permissions.active.keyCount === 1 && permissions.active.totalWeight >= permissions.active.weight_threshold && permissions.active.weight_threshold > 0) {
    findings.push(finding('single-active-key', 'info', 'One key controls the active permission',
      'This is common, but it means a single leaked active key can move funds. Consider whether a second key or account authority is appropriate.', 'key'))
  }

  const proxy = String(account.proxy || '').trim()
  if (proxy) {
    findings.push(finding('voting-proxy', 'info', 'Voting proxy is set',
      '@' + proxy + ' controls this account\'s witness and proposal votes. Clear the proxy if you want direct control.', 'how_to_vote'))
  }

  const expiry = governanceVoteExpiry(account, now)
  if (expiry.expiresAt !== null) {
    if (expiry.daysLeft <= 0) {
      findings.push(finding('governance-expired', 'warning', 'Governance votes have expired',
        'Witness and proposal votes are inactive until the account refreshes its governance vote.', 'event_busy'))
    } else if (expiry.expiring) {
      findings.push(finding('governance-expiring', 'warning', 'Governance votes expire soon',
        'Votes expire in about ' + Math.max(1, Math.round(expiry.daysLeft)) + ' days. Refresh them from the witnesses page to keep them active.', 'schedule'))
    }
  }

  const lastOwnerUpdate = timeValue(account.last_owner_update)
  const ownerAgeDays = lastOwnerUpdate === null ? null : Math.max(0, (now - lastOwnerUpdate) / DAY_MS)
  if (ownerAgeDays !== null && ownerAgeDays > 365) {
    findings.push(finding('owner-key-age', 'info', 'Owner authority has not changed recently',
      'The owner authority was last updated about ' + Math.round(ownerAgeDays / 365 * 10) / 10 + ' years ago. Confirm the owner key is still available offline.', 'history'))
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const score = Math.min(100, findings.reduce((sum, row) => sum + (SEVERITY_WEIGHT[row.severity] || 0), 0))
  const level = score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low'

  return {
    level,
    score,
    findings,
    permissions,
    keyUsage: [...usage.entries()].map(([key, list]) => ({ key, permissions: list })),
    ownerAgeDays,
    lastOwnerUpdate,
    governanceVoteExpiry: expiry,
    queuedChanges: queuedAuthorityChanges(options.queue, account)
  }
}

function diffList (before = [], after = [], keyName) {
  const beforeMap = new Map(before.map(entry => [entry[keyName], entry.weight]))
  const afterMap = new Map(after.map(entry => [entry[keyName], entry.weight]))
  const added = [...afterMap.keys()].filter(key => !beforeMap.has(key)).map(key => ({ [keyName]: key, weight: afterMap.get(key) }))
  const removed = [...beforeMap.keys()].filter(key => !afterMap.has(key)).map(key => ({ [keyName]: key, weight: beforeMap.get(key) }))
  const changed = [...afterMap.keys()]
    .filter(key => beforeMap.has(key) && beforeMap.get(key) !== afterMap.get(key))
    .map(key => ({ [keyName]: key, before: beforeMap.get(key), after: afterMap.get(key) }))
  return { added, removed, changed }
}

function diffPermission (before, after) {
  const left = normalizeAuthority(before)
  const right = normalizeAuthority(after)
  const keys = diffList(left.keys, right.keys, 'key')
  const accounts = diffList(left.accounts, right.accounts, 'account')
  const threshold = { before: left.weight_threshold, after: right.weight_threshold, changed: left.weight_threshold !== right.weight_threshold }
  const changed = keys.added.length + keys.removed.length + keys.changed.length +
    accounts.added.length + accounts.removed.length + accounts.changed.length +
    (threshold.changed ? 1 : 0)
  return { keys, accounts, threshold, changed }
}

/**
 * Readable diff between two authority states. The account page uses this for
 * queued account updates so a permission change is visible before broadcast.
 */
export function authorityDiff (before, after) {
  const permissions = {}
  let changed = 0
  for (const permission of PERMISSIONS) {
    permissions[permission] = diffPermission(before?.[permission], after?.[permission])
    changed += permissions[permission].changed
  }
  return { permissions, changed, hasChanges: changed > 0 }
}

/**
 * Inspect the signing queue for account updates that would change permissions.
 * `account_update` omits unchanged authorities (null), so the current account is
 * used as the fallback for each missing permission.
 */
export function queuedAuthorityChanges (queue, account) {
  const name = String(typeof account === 'string' ? account : account?.name || '').toLowerCase()
  if (!name || !Array.isArray(queue)) return []

  const current = typeof account === 'string' ? null : account
  const changes = []
  queue.forEach((item, index) => {
    if (!Array.isArray(item) || String(item[0]).toLowerCase() !== name) return
    const operation = Array.isArray(item[2]) ? item[2] : []
    if (!['account_update', 'account_update2'].includes(operation[0])) return
    const data = operation[1] || {}
    changes.push({
      index,
      operation: operation[0],
      diff: current
        ? authorityDiff(current, {
            owner: data.owner || current.owner,
            active: data.active || current.active,
            posting: data.posting || current.posting
          })
        : null,
      data
    })
  })
  return changes
}

export { PERMISSIONS }
