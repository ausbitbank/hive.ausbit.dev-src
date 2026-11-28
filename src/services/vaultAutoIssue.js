// Client-side auto-issuer for Vault grants.
//
// A relay would issue grants while the creator is offline. The self-sovereign
// beta has no relay, so the next best thing is the creator's own dashboard:
// while that tab is open, visible and the vault is unlocked, poll the public
// payment history and queue a bulletin as soon as a subscriber needs a grant.
//
// This module is deliberately pure. The dashboard owns the timer and signing;
// these helpers only decide whether a tick should run and persist the opt-in.

export const AUTO_ISSUE_INTERVAL_MS = 30 * 1000
export const AUTO_ISSUE_BATCH_OPTIONS = [30, 60, 120]
const STORAGE_PREFIX = 'banksia_vault_auto_issue:'
const BATCH_PREFIX = 'banksia_vault_auto_issue_batch:'

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function defaultStorage () {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Opt-in defaults to true: the creator already unlocked the vault to be here. */
export function readAutoIssuePreference (account, storage = defaultStorage()) {
  const name = normalizeAccount(account)
  if (!name || !storage) return true
  try {
    const value = storage.getItem(STORAGE_PREFIX + name)
    return value === null ? true : value !== 'false'
  } catch {
    return true
  }
}

export function writeAutoIssuePreference (account, enabled, storage = defaultStorage()) {
  const name = normalizeAccount(account)
  if (!name || !storage) return
  try {
    storage.setItem(STORAGE_PREFIX + name, enabled ? 'true' : 'false')
  } catch {
    // Local storage can be unavailable in private mode; the in-memory toggle
    // still works for this session.
  }
}

/** Batch window in seconds; defaults to the original 30 seconds. */
export function readAutoIssueBatch (account, storage = defaultStorage()) {
  const name = normalizeAccount(account)
  if (!name || !storage) return 30
  try {
    const value = Number(storage.getItem(BATCH_PREFIX + name))
    return AUTO_ISSUE_BATCH_OPTIONS.includes(value) ? value : 30
  } catch {
    return 30
  }
}

export function writeAutoIssueBatch (account, seconds, storage = defaultStorage()) {
  const name = normalizeAccount(account)
  const value = Number(seconds)
  if (!name || !storage || !AUTO_ISSUE_BATCH_OPTIONS.includes(value)) return
  try {
    storage.setItem(BATCH_PREFIX + name, String(value))
  } catch {
    // The in-memory value still applies for this session.
  }
}

/**
 * Whether this polling tick may issue.
 *
 * `queuedBulletin` is true when an unsent `vault-*` comment is already in the
 * signing queue, which prevents duplicate prompts while the creator approves.
 */
export function shouldAutoIssue ({
  enabled = false,
  visible = true,
  hasVault = false,
  isOwner = false,
  hasPlan = false,
  busy = false,
  pendingCount = 0,
  queuedBulletin = false,
  lastAttemptAt = 0,
  now = Date.now(),
  intervalMs = AUTO_ISSUE_INTERVAL_MS
} = {}) {
  if (!enabled || !visible || !hasVault || !isOwner || !hasPlan || busy) return false
  if (!Number.isFinite(pendingCount) || pendingCount <= 0) return false
  if (queuedBulletin) return false
  const last = Number(lastAttemptAt) || 0
  if (last && now - last < intervalMs) return false
  return true
}

/** True when the queue has an unsent Vault bulletin for this account. */
export function hasQueuedVaultBulletin (queue, meta, account) {
  const name = normalizeAccount(account)
  if (!name || !Array.isArray(queue)) return false
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index]
    if (!Array.isArray(item) || String(item[0] || '').toLowerCase() !== name) continue
    const operation = item[2]
    if (!Array.isArray(operation) || operation[0] !== 'comment') continue
    const permlink = String(operation[1] && operation[1].permlink || '')
    if (!permlink.startsWith('vault-')) continue
    const status = Array.isArray(meta) ? meta[index]?.status : ''
    if (status === 'pending' || status === 'broadcasting') return true
  }
  return false
}
