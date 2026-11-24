import { describe, expect, it } from 'vitest'
import { flagsFromRelationship, followJson, followOperation, followWhat } from '../../src/services/followOps'

describe('follow operations', () => {
  it('maps all five bridge relationship flags', () => {
    expect(flagsFromRelationship({
      follows: true,
      ignores: true,
      blacklists: true,
      follows_muted: true,
      follows_blacklists: true
    })).toEqual({
      blog: true,
      ignore: true,
      blacklist: true,
      follow_muted: true,
      follow_blacklist: true
    })
  })

  it('adds and removes one flag without clearing the others', () => {
    const relationship = { follows: true, blacklists: true }
    expect(followWhat(relationship, { ignore: true })).toEqual(['blog', 'ignore', 'blacklist'])
    expect(followWhat({ ...relationship, ignores: true }, { ignore: false })).toEqual(['blog', 'blacklist'])
    expect(followWhat({ follows: true, ignores: true }, { blog: false })).toEqual(['ignore'])
  })

  it('composes a posting-authority follow custom_json', () => {
    const json = JSON.parse(followJson('alice', 'bob', { follows: true }, { ignore: true }))
    expect(json).toEqual(['follow', { follower: 'alice', following: 'bob', what: ['blog', 'ignore'] }])
  })

  it('builds a queue-ready posting operation', () => {
    const [account, keyType, [id, data]] = followOperation('alice', 'bob', {}, { ignore: true })
    expect(account).toBe('alice')
    expect(keyType).toBe('posting')
    expect(id).toBe('custom_json')
    expect(data.required_posting_auths).toEqual(['alice'])
    expect(data.id).toBe('follow')
    expect(JSON.parse(data.json)[1].what).toEqual(['ignore'])
  })
})
