import { describe, expect, it } from 'vitest'
import {
  AUTO_ISSUE_INTERVAL_MS,
  hasQueuedVaultBulletin,
  readAutoIssueBatch,
  readAutoIssuePreference,
  shouldAutoIssue,
  writeAutoIssueBatch,
  writeAutoIssuePreference
} from '../../src/services/vaultAutoIssue'

function storage () {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value))
  }
}

const READY = {
  enabled: true,
  visible: true,
  hasVault: true,
  isOwner: true,
  hasPlan: true,
  busy: false,
  pendingCount: 1,
  queuedBulletin: false,
  lastAttemptAt: 0,
  now: 1_000_000
}

describe('Vault auto-issue preference', () => {
  it('defaults on and persists per account', () => {
    const store = storage()
    expect(readAutoIssuePreference('alice', store)).toBe(true)
    writeAutoIssuePreference('alice', false, store)
    expect(readAutoIssuePreference('alice', store)).toBe(false)
    expect(readAutoIssuePreference('bob', store)).toBe(true)
    expect(readAutoIssuePreference('', store)).toBe(true)
  })

  it('defaults the batch window to 30 seconds and persists valid choices', () => {
    const store = storage()
    expect(readAutoIssueBatch('alice', store)).toBe(30)
    writeAutoIssueBatch('alice', 120, store)
    expect(readAutoIssueBatch('alice', store)).toBe(120)
    writeAutoIssueBatch('alice', 999, store)
    expect(readAutoIssueBatch('alice', store)).toBe(120)
    expect(readAutoIssueBatch('bob', store)).toBe(30)
  })
})

describe('shouldAutoIssue', () => {
  it('allows a visible unlocked owner with pending readers', () => {
    expect(shouldAutoIssue(READY)).toBe(true)
  })

  it('refuses when hidden, locked, busy, read-only or nothing is pending', () => {
    expect(shouldAutoIssue({ ...READY, enabled: false })).toBe(false)
    expect(shouldAutoIssue({ ...READY, visible: false })).toBe(false)
    expect(shouldAutoIssue({ ...READY, hasVault: false })).toBe(false)
    expect(shouldAutoIssue({ ...READY, isOwner: false })).toBe(false)
    expect(shouldAutoIssue({ ...READY, hasPlan: false })).toBe(false)
    expect(shouldAutoIssue({ ...READY, busy: true })).toBe(false)
    expect(shouldAutoIssue({ ...READY, pendingCount: 0 })).toBe(false)
    expect(shouldAutoIssue({ ...READY, queuedBulletin: true })).toBe(false)
    expect(shouldAutoIssue({ ...READY, lastAttemptAt: READY.now - 1000 })).toBe(false)
    expect(shouldAutoIssue({ ...READY, lastAttemptAt: READY.now - AUTO_ISSUE_INTERVAL_MS })).toBe(true)
  })
})

describe('hasQueuedVaultBulletin', () => {
  const queue = [
    ['alice', 'posting', ['comment', { permlink: 'vault-2026-11-2' }]],
    ['alice', 'posting', ['comment', { permlink: 'normal-post' }]]
  ]

  it('detects an unsent Vault bulletin in the queue', () => {
    expect(hasQueuedVaultBulletin(queue, [{ status: 'pending' }, { status: 'pending' }], 'alice')).toBe(true)
    expect(hasQueuedVaultBulletin(queue, [{ status: 'broadcasting' }, { status: 'pending' }], 'alice')).toBe(true)
  })

  it('ignores sent bulletins, other accounts and normal posts', () => {
    expect(hasQueuedVaultBulletin(queue, [{ status: 'sent' }, { status: 'pending' }], 'alice')).toBe(false)
    expect(hasQueuedVaultBulletin(queue, [{ status: 'pending' }, { status: 'pending' }], 'bob')).toBe(false)
    expect(hasQueuedVaultBulletin(queue, undefined, 'alice')).toBe(false)
  })
})
