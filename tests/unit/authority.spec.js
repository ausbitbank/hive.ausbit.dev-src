import { describe, expect, it } from 'vitest'
import {
  accountAuthorityKeyUpdate,
  accountAuthorityUpdate,
  authorityDiff,
  authorityRisk,
  normalizeAuthority,
  queuedAuthorityChanges
} from '../../src/services/authority'

const NOW = Date.parse('2026-11-18T12:00:00Z')

function auth (key, weight = 1, threshold = 1, accounts = []) {
  return {
    weight_threshold: threshold,
    key_auths: key ? [[key, weight]] : [],
    account_auths: accounts
  }
}

function account (overrides = {}) {
  return {
    name: 'alice',
    owner: auth('STMowner'),
    active: auth('STMactive'),
    posting: auth('STMposting'),
    memo_key: 'STMmemo',
    proxy: '',
    last_owner_update: '2026-01-01T00:00:00',
    governance_vote_expiration_ts: '2027-05-01T00:00:00',
    ...overrides
  }
}

describe('normalizeAuthority', () => {
  it('normalises keys, accounts, threshold and totals', () => {
    const result = normalizeAuthority({
      weight_threshold: 2,
      key_auths: [['STMone', 1], ['STMtwo', 2]],
      account_auths: [['bob', 1]]
    })
    expect(result.keyCount).toBe(2)
    expect(result.accountCount).toBe(1)
    expect(result.weight_threshold).toBe(2)
    expect(result.totalWeight).toBe(4)
    expect(result.topKeyWeight).toBe(2)
  })
})

describe('authorityRisk', () => {
  it('reports a low-risk baseline for separated keys', () => {
    const result = authorityRisk(account(), { now: NOW })
    expect(result.level).toBe('low')
    expect(result.findings.map(row => row.id)).toEqual(['single-active-key'])
    expect(result.permissions.owner.keyCount).toBe(1)
  })

  it('does not claim one key controls active when an account authority shares the threshold', () => {
    const active = {
      weight_threshold: 3,
      key_auths: [['STMactive', 1]],
      account_auths: [['bob', 2]]
    }
    const result = authorityRisk(account({ active }), { now: NOW })
    expect(result.findings.some(row => row.id === 'single-active-key')).toBe(false)
  })

  it('does not mark never-voted governance as expired', () => {
    const result = authorityRisk(account({ governance_vote_expiration_ts: '1969-12-31T23:59:59' }), { now: NOW })
    expect(result.findings.some(row => row.id === 'governance-expired')).toBe(false)
    expect(result.findings.some(row => row.id === 'governance-expiring')).toBe(false)
  })

  it('flags owner and active key reuse as critical', () => {    const result = authorityRisk(account({ active: auth('STMowner') }), { now: NOW })
    expect(result.level).toBe('high')
    expect(result.findings.some(row => row.id === 'owner-active-reuse' && row.severity === 'critical')).toBe(true)
  })

  it('flags shared account authority and voting proxies', () => {
    const result = authorityRisk(account({
      active: auth('STMactive', 1, 2, [['bob', 1]]),
      posting: auth('STMposting', 1, 1, [['app', 1]]),
      proxy: 'trustedproxy'
    }), { now: NOW })

    expect(result.findings.some(row => row.id === 'active-account-auth' && row.severity === 'warning')).toBe(true)
    expect(result.findings.some(row => row.id === 'posting-account-auth' && row.severity === 'info')).toBe(true)
    expect(result.findings.some(row => row.id === 'voting-proxy')).toBe(true)
  })

  it('flags expiring and expired governance votes', () => {
    const expiring = authorityRisk(account({ governance_vote_expiration_ts: '2026-12-01T00:00:00' }), { now: NOW })
    expect(expiring.findings.some(row => row.id === 'governance-expiring')).toBe(true)

    const expired = authorityRisk(account({ governance_vote_expiration_ts: '2026-11-01T00:00:00' }), { now: NOW })
    expect(expired.findings.some(row => row.id === 'governance-expired')).toBe(true)
  })

  it('returns an unknown model without an account', () => {
    expect(authorityRisk(null, { now: NOW })).toMatchObject({ level: 'unknown', score: 0, findings: [] })
  })
})

describe('authorityDiff', () => {
  it('lists added keys, accounts and threshold changes', () => {
    const before = {
      owner: auth('STMowner'),
      active: auth('STMactive'),
      posting: auth('STMposting')
    }
    const after = {
      owner: auth('STMowner'),
      active: auth('STMactive', 1, 2, [['bob', 1]]),
      posting: auth('STMnew', 1, 2, [['app', 1]])
    }
    const diff = authorityDiff(before, after)

    expect(diff.hasChanges).toBe(true)
    expect(diff.permissions.posting.keys.added).toEqual([{ key: 'STMnew', weight: 1 }])
    expect(diff.permissions.posting.keys.removed).toEqual([{ key: 'STMposting', weight: 1 }])
    expect(diff.permissions.posting.threshold).toMatchObject({ before: 1, after: 2, changed: true })
    expect(diff.permissions.active.accounts.added).toEqual([{ account: 'bob', weight: 1 }])
  })

  it('returns an unchanged diff for identical authorities', () => {
    const state = {
      owner: auth('STMowner'),
      active: auth('STMactive'),
      posting: auth('STMposting')
    }
    expect(authorityDiff(state, state)).toMatchObject({ changed: 0, hasChanges: false })
  })
})

describe('accountAuthorityUpdate', () => {
  it('builds an active-authority account_update that preserves keys and metadata', () => {
    const current = account({ memo_key: 'STMmemo', json_metadata: '{"profile":{}}' })
    const operation = accountAuthorityUpdate(current, 'active', { add: true, target: '@Bob', weight: 2 })

    expect(operation[0]).toBe('account_update')
    expect(operation[1]).toMatchObject({
      account: 'alice',
      memo_key: 'STMmemo',
      json_metadata: '{"profile":{}}'
    })
    expect(operation[1].active).toEqual({
      weight_threshold: 1,
      key_auths: [['STMactive', 1]],
      account_auths: [['bob', 2]]
    })
    expect(operation[1].owner).toBeUndefined()
    expect(operation[1].posting).toBeUndefined()
  })

  it('removes one account authority without dropping the others', () => {
    const current = account({
      posting: auth('STMposting', 1, 1, [['bob', 1], ['carol', 2]])
    })
    const operation = accountAuthorityUpdate(current, 'posting', { add: false, target: 'bob' })
    expect(operation[1].posting.account_auths).toEqual([['carol', 2]])
    expect(operation[1].posting.key_auths).toEqual([['STMposting', 1]])
  })

  it('rejects owner changes, self grants and invalid weights', () => {
    const current = account()
    expect(() => accountAuthorityUpdate(current, 'owner', { target: 'bob', weight: 1 }))
      .toThrow(/Only active and posting/)
    expect(() => accountAuthorityUpdate(current, 'active', { target: 'alice', weight: 1 }))
      .toThrow(/itself/)
    expect(() => accountAuthorityUpdate(current, 'active', { target: 'bob', weight: 0 }))
      .toThrow(/weight/)
    expect(() => accountAuthorityUpdate(current, 'active', { target: 'bob', weight: 1.5 }))
      .toThrow(/weight/)
  })
})

describe('accountAuthorityKeyUpdate', () => {
  const KEY = 'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4'

  it('adds a key while preserving accounts, threshold and metadata', () => {
    const current = account({ memo_key: 'STMmemo', json_metadata: '{"profile":{}}' })
    const operation = accountAuthorityKeyUpdate(current, 'posting', { add: true, key: KEY, weight: 2 })
    expect(operation[0]).toBe('account_update')
    expect(operation[1].posting.key_auths).toEqual([
      [KEY, 2],
      ['STMposting', 1]
    ])
    expect(operation[1].posting.account_auths).toEqual([])
    expect(operation[1].memo_key).toBe('STMmemo')
    expect(operation[1].json_metadata).toBe('{"profile":{}}')
    expect(operation[1].owner).toBeUndefined()
  })

  it('removes only the requested key', () => {
    const current = account({ active: auth(KEY, 2, 1, [['bob', 1]]) })
    const operation = accountAuthorityKeyUpdate(current, 'active', { add: false, key: KEY })
    expect(operation[1].active.key_auths).toEqual([])
    expect(operation[1].active.account_auths).toEqual([['bob', 1]])
  })

  it('rejects owner edits, malformed keys and bad weights', () => {
    const current = account()
    expect(() => accountAuthorityKeyUpdate(current, 'owner', { key: KEY }))
      .toThrow(/Only active and posting/)
    expect(() => accountAuthorityKeyUpdate(current, 'active', { key: 'STMbad' }))
      .toThrow(/public key/)
    expect(() => accountAuthorityKeyUpdate(current, 'active', { key: KEY, weight: 0 }))
      .toThrow(/weight/)
  })
})

describe('queuedAuthorityChanges', () => {
  it('previews account_update permission changes from the queue', () => {
    const current = account()
    const queue = [
      ['alice', 'active', ['account_update', {
        posting: auth('STMnew', 1, 2, [['app', 1]])
      }]],
      ['alice', 'posting', ['vote', {}]],
      ['bob', 'active', ['account_update', { posting: auth('STMbob') }]]
    ]
    const changes = queuedAuthorityChanges(queue, current)

    expect(changes).toHaveLength(1)
    expect(changes[0].operation).toBe('account_update')
    expect(changes[0].diff.hasChanges).toBe(true)
    expect(changes[0].diff.permissions.posting.keys.added[0].key).toBe('STMnew')
    expect(changes[0].diff.permissions.owner.changed).toBe(0)
  })

  it('skips metadata-only updates and already-sent authority changes', () => {
    const queue = [
      ['alice', 'posting', ['account_update2', { posting_json_metadata: '{}', json_metadata: '' }]],
      ['alice', 'active', ['account_update', { posting: auth('STMnew') }]]
    ]
    const meta = [{ status: 'pending' }, { status: 'sent' }]
    expect(queuedAuthorityChanges(queue, account(), meta)).toEqual([])
  })

  it('tolerates a missing queue', () => {
    expect(queuedAuthorityChanges(null, account())).toEqual([])
  })
})
