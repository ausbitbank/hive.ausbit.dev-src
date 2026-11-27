import { describe, expect, it } from 'vitest'
import { parseProductMetadata } from '../../src/services/blogShop'
import { buildCheckoutOperations, validateCheckout } from '../../src/services/shopCart'
import {
  isMembershipProduct,
  membershipFromProduct,
  membershipSubscribeUrl
} from '../../src/services/shopMembership'

function productPost (metadata = {}) {
  return {
    author: 'alice',
    permlink: 'membership',
    title: 'The Orchid Letter',
    body: 'Weekly notes and the full archive.',
    created: '2026-11-27T10:00:00',
    json_metadata: JSON.stringify({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 5,
      subscription: 1,
      subscription_recurrence: 730,
      status: 1,
      tags: ['membership', 'vault'],
      ...metadata
    })
  }
}

function product (metadata = {}, post = {}) {
  return parseProductMetadata({ ...productPost(metadata), ...post })
}

describe('shop membership detection', () => {
  it('detects a Banksia Vault product extension', () => {
    const membership = product({
      banksia_vault_product: {
        v: 1,
        plan: 'member',
        container: 'banksia-vault',
        archive: 'all',
        executions: 12,
        benefits: ['Weekly notes']
      }
    })
    expect(isMembershipProduct(membership)).toBe(true)
    expect(membershipFromProduct(membership)).toMatchObject({
      author: 'alice',
      permlink: 'membership',
      plan: 'member',
      recurrenceHours: 730,
      benefits: ['Weekly notes']
    })
  })

  it('accepts an ordinary HOM subscription tagged membership/vault', () => {
    expect(isMembershipProduct(product({ tags: ['membership'] }))).toBe(true)
    expect(isMembershipProduct(product({ tags: ['vault'] }))).toBe(true)
  })

  it('leaves ordinary products and one-time products alone', () => {
    expect(isMembershipProduct(product({ tags: ['hosting'], subscription: 0, subscription_recurrence: undefined }))).toBe(false)
    expect(isMembershipProduct(null)).toBe(false)
  })

  it('builds the apex Subscribe URL from chain data', () => {
    const membership = product()
    expect(membershipSubscribeUrl(membership)).toBe('/subscribe?blog=alice&product=alice%2Fmembership')
    expect(membershipSubscribeUrl(membership, { absolute: true }))
      .toBe('https://banksia.io/subscribe?blog=alice&product=alice%2Fmembership')
  })
})

describe('shop cart rejects memberships', () => {
  const membership = product()
  const item = { author: 'alice', permlink: 'membership', quantity: 1 }

  it('explains that checkout cannot attach a reader key', () => {
    const result = validateCheckout([membership], [item], 'buyer')
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('Banksia Vault membership')
    expect(result.lines).toEqual([])
  })

  it('never builds a generic membership operation', () => {
    expect(buildCheckoutOperations([membership], [item], 'buyer')).toEqual([])
  })
})
