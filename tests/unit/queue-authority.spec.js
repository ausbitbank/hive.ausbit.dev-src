import { describe, expect, it } from 'vitest'
import { queueAuthorityError, requiredAuthority } from '../../src/services/queueAuthority'

describe('requiredAuthority', () => {
  it('maps posting operations', () => {
    expect(requiredAuthority(['vote', {}])).toBe('posting')
    expect(requiredAuthority(['comment', {}])).toBe('posting')
    expect(requiredAuthority(['delete_comment', {}])).toBe('posting')
    expect(requiredAuthority(['comment_options', {}])).toBe('posting')
  })

  it('maps active operations', () => {
    for (const name of ['transfer', 'recurrent_transfer', 'delegate_vesting_shares', 'update_proposal_votes', 'withdraw_vesting', 'account_witness_vote']) {
      expect(requiredAuthority([name, {}]), name).toBe('active')
    }
  })

  it('reads custom_json required auths', () => {
    expect(requiredAuthority(['custom_json', { required_auths: [], required_posting_auths: ['alice'] }])).toBe('posting')
    expect(requiredAuthority(['custom_json', { required_auths: ['alice'], required_posting_auths: [] }])).toBe('active')
    expect(requiredAuthority(['custom_json', {}])).toBe('posting')
  })

  it('only allows account_update2 posting metadata with posting', () => {
    expect(requiredAuthority(['account_update2', { posting_json_metadata: '{}' }])).toBe('posting')
    expect(requiredAuthority(['account_update2', { json_metadata: '' }])).toBe('posting')
    expect(requiredAuthority(['account_update2', { json_metadata: '{}' }])).toBe('active')
    expect(requiredAuthority(['account_update2', { memo_key: 'STM...' }])).toBe('active')
    expect(requiredAuthority(['account_update2', { posting: {} }])).toBe('active')
    expect(requiredAuthority(['account_update2', { active: {} }])).toBe('active')
  })

  it('returns null for malformed or unknown operations', () => {
    expect(requiredAuthority(null)).toBeNull()
    expect(requiredAuthority([])).toBeNull()
    expect(requiredAuthority(['unknown_op', {}])).toBeNull()
  })
})

describe('queueAuthorityError', () => {
  it('accepts a matching owner, authority and operation', () => {
    expect(queueAuthorityError(['alice', 'posting', ['vote', {}]], 'alice')).toBe('')
    expect(queueAuthorityError(['alice', 'active', ['transfer', {}]], '@Alice')).toBe('')
  })

  it('rejects a mismatched declared authority', () => {
    expect(queueAuthorityError(['alice', 'posting', ['transfer', {}]], 'alice')).toContain('needs the active key')
    expect(queueAuthorityError(['alice', 'active', ['vote', {}]], 'alice')).toContain('needs the posting key')
  })

  it('rejects an item owned by another account', () => {
    expect(queueAuthorityError(['bob', 'posting', ['vote', {}]], 'alice')).toContain('belongs to @bob')
    expect(queueAuthorityError(['bob', 'posting', ['vote', {}]], '')).toBe('')
  })

  it('rejects malformed items and unknown operations', () => {
    expect(queueAuthorityError(null, 'alice')).toBe('Malformed queue item.')
    expect(queueAuthorityError(['alice', 'posting'], 'alice')).toBe('Malformed queue item.')
    expect(queueAuthorityError(['alice', 'owner', ['vote', {}]], 'alice')).toContain('unknown authority')
    expect(queueAuthorityError(['alice', 'posting', ['made_up', {}]], 'alice')).toContain('no known signing authority')
  })
})
