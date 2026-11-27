import { describe, expect, it } from 'vitest'
import {
  buildSellerTrust,
  hiveReputation,
  productLastUpdate,
  sellerAgeDays,
  sellerAgeLabel
} from '../../src/services/shopSeller'

const NOW = Date.parse('2026-11-28T00:00:00Z')

function account (overrides = {}) {
  return {
    name: 'alice',
    created: '2025-01-01T00:00:00',
    reputation: '1234567890',
    post_count: 42,
    ...overrides
  }
}

function product (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'membership',
    created: '2026-11-18T10:00:00',
    post: {
      author: 'alice',
      permlink: 'membership',
      created: '2026-11-18T10:00:00',
      last_update: '2026-11-19T10:00:00'
    },
    ...overrides
  }
}

describe('seller reputation and age', () => {
  it('formats Hive raw reputation honestly', () => {
    expect(hiveReputation('1234567890')).toBe(25.8)
    expect(hiveReputation(0)).toBe(25)
    expect(hiveReputation(-1234567890)).toBe(24.2)
    expect(hiveReputation(undefined)).toBeNull()
    expect(hiveReputation('not a number')).toBeNull()
  })

  it('computes and labels account age', () => {
    expect(sellerAgeDays('2025-01-01T00:00:00', NOW)).toBe(696)
    expect(sellerAgeDays('', NOW)).toBeNull()
    expect(sellerAgeDays('2027-01-01T00:00:00', NOW)).toBeNull()
    expect(sellerAgeLabel(0)).toBe('joined today')
    expect(sellerAgeLabel(1)).toBe('1 day')
    expect(sellerAgeLabel(45)).toBe('2 months')
    expect(sellerAgeLabel(696)).toBe('1.9 years')
  })
})

describe('seller trust model', () => {
  it('builds public signals and detects an edit', () => {
    const trust = buildSellerTrust(account(), { product: product(), now: NOW })
    expect(trust).toMatchObject({
      name: 'alice',
      joined: '2025-01-01T00:00:00',
      reputation: 25.8,
      reputationLabel: '25.8',
      postCount: 42,
      edited: true
    })
    expect(trust.joinedLabel).not.toBe('')
    expect(trust.ageLabel).toBe('1.9 years')
    expect(trust.lastUpdateLabel).not.toBe('')
  })

  it('does not call a never-edited product edited', () => {
    const trust = buildSellerTrust(account(), {
      product: product({ post: { ...product().post, last_update: '2026-11-18T10:00:00' } }),
      now: NOW
    })
    expect(trust.edited).toBe(false)
    expect(trust.lastUpdate).toBe('')
  })

  it('returns null without an account and tolerates missing fields', () => {
    expect(buildSellerTrust(null)).toBeNull()
    const trust = buildSellerTrust({ name: 'alice' }, { product: product(), now: NOW })
    expect(trust.reputationLabel).toBe('')
    expect(trust.postCount).toBeNull()
    expect(trust.joinedLabel).toBe('')
  })

  it('reads last_update before legacy updated fields', () => {
    expect(productLastUpdate({ post: { last_update: 'a', updated: 'b' } })).toBe('a')
    expect(productLastUpdate({ post: { updated: 'b' } })).toBe('b')
    expect(productLastUpdate(null)).toBe('')
  })
})
