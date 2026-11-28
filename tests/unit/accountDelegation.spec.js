import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RC_DELEGATION,
  MAX_RC_DELEGATION,
  buildDelegationOperations,
  hpToVests,
  normalizeHpAmount,
  normalizeRcAmount
} from '../../src/services/accountDelegation'
import { queueAuthorityError, requiredAuthority } from '../../src/services/queueAuthority'
import { operationLabel, operationSummary } from '../../src/services/queue'

const globalProps = {
  total_vesting_fund_hive: '200000000.000 HIVE',
  total_vesting_shares: '400000000000.000000 VESTS'
}

describe('account delegation', () => {
  it('builds RC and HP delegations after creation', () => {
    const operations = buildDelegationOperations({
      sponsor: '@Alice',
      account: 'Newcomer',
      rcAmount: DEFAULT_RC_DELEGATION,
      hpAmount: 5,
      globalProps
    })
    expect(operations).toEqual([
      ['custom_json', {
        required_auths: [],
        required_posting_auths: ['alice'],
        id: 'rc',
        json: JSON.stringify(['delegate_rc', {
          from: 'alice',
          delegatees: ['newcomer'],
          max_rc: 5_000_000_000,
          extensions: []
        }])
      }],
      ['delegate_vesting_shares', {
        delegator: 'alice',
        delegatee: 'newcomer',
        vesting_shares: '10000.000000 VESTS'
      }]
    ])
  })

  it('supports either operation alone or none', () => {
    const [rcOnly] = buildDelegationOperations({ sponsor: 'alice', account: 'bob', rcAmount: 1 })
    expect(rcOnly[0]).toBe('custom_json')
    expect(JSON.parse(rcOnly[1].json)).toEqual(['delegate_rc', {
      from: 'alice',
      delegatees: ['bob'],
      max_rc: 1,
      extensions: []
    }])
    expect(buildDelegationOperations({ sponsor: 'alice', account: 'bob', hpAmount: 1, globalProps }))
      .toEqual([['delegate_vesting_shares', {
        delegator: 'alice',
        delegatee: 'bob',
        vesting_shares: '2000.000000 VESTS'
      }]])
    expect(buildDelegationOperations({ sponsor: 'alice', account: 'bob' })).toEqual([])
  })

  it('rejects invalid names, self-delegation and unsafe amounts', () => {
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'bad name', rcAmount: 1 }))
      .toThrow(/new account name/)
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'alice', rcAmount: 1 }))
      .toThrow(/different account/)
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'bob', rcAmount: -1 }))
      .toThrow(/Resource Credit/)
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'bob', rcAmount: MAX_RC_DELEGATION + 1 }))
      .toThrow(/Resource Credit/)
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'bob', hpAmount: Number.NaN }))
      .toThrow(/Hive Power/)
  })

  it('fails closed when the HP conversion is unavailable', () => {
    expect(() => buildDelegationOperations({ sponsor: 'alice', account: 'bob', hpAmount: 1 }))
      .toThrow(/conversion is unavailable/)
  })

  it('normalises amounts and converts HP to VESTS', () => {
    expect(normalizeRcAmount('5')).toBe(5)
    expect(normalizeRcAmount(5.9)).toBe(5)
    expect(normalizeRcAmount(-1)).toBeNull()
    expect(normalizeRcAmount('nope')).toBeNull()
    expect(normalizeHpAmount(2.25)).toBe(2.25)
    expect(normalizeHpAmount(-1)).toBeNull()
    expect(hpToVests(5, globalProps)).toBe('10000.000000 VESTS')
    expect(hpToVests(0, globalProps)).toBe('')
    expect(hpToVests(1, null)).toBe('')
  })

  it('treats the RC custom_json as posting and HP delegation as active', () => {
    expect(requiredAuthority(['delegate_vesting_shares', {}])).toBe('active')
    expect(requiredAuthority(['custom_json', {
      required_auths: [],
      required_posting_auths: ['alice'],
      id: 'rc'
    }])).toBe('posting')
    expect(queueAuthorityError(['alice', 'active', ['delegate_vesting_shares', {}]], 'alice')).toBe('')
    expect(queueAuthorityError(['alice', 'active', ['custom_json', {
      required_auths: [],
      required_posting_auths: ['alice'],
      id: 'rc'
    }]], 'alice')).toContain('needs the posting key')
  })

  it('labels and summarises the RC custom_json in the queue', () => {
    const [rc] = buildDelegationOperations({ sponsor: 'alice', account: 'bob', rcAmount: 2_000_000_000 })
    const action = ['alice', 'posting', rc]
    expect(requiredAuthority(rc)).toBe('posting')
    expect(operationLabel(action)).toBe('Delegate RC')
    expect(operationSummary(action)).toBe('Delegate 2,000,000,000 RC to @bob')
  })
})
