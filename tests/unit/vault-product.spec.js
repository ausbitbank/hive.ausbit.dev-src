import { describe, expect, it } from 'vitest'
import {
  VAULT_PRODUCT_CONTENT_TYPE,
  buildVaultContainerOperation,
  buildVaultProductBody,
  buildVaultProductMetadata,
  buildVaultProductOperation,
  deriveVaultPlan,
  isVaultContainer,
  isVaultProduct,
  parseVaultProduct,
  vaultProductPath
} from '../../src/services/vaultProduct'
import { defaultVaultSettings } from '../../src/services/vaultSettings'

const SETTINGS = {
  ...defaultVaultSettings('alice'),
  enabled: true,
  product: 'alice/membership'
}

function postFrom (metadata, overrides = {}) {
  return {
    author: 'alice',
    permlink: 'membership',
    title: 'Membership',
    json_metadata: JSON.stringify(metadata),
    ...overrides
  }
}

describe('buildVaultProductMetadata', () => {
  it('builds standard HOM fields with the Banksia extension', () => {
    const metadata = buildVaultProductMetadata(SETTINGS)
    expect(metadata).toEqual({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 5,
      subscription: 1,
      subscription_recurrence: 730,
      status: 1,
      tags: ['membership', 'vault'],
      banksia_vault_product: {
        v: 1,
        plan: 'member',
        container: 'banksia-vault',
        archive: 'all'
      }
    })
    expect(metadata.id).toBeUndefined()
    expect(metadata.image).toBeUndefined()
    expect(VAULT_PRODUCT_CONTENT_TYPE).toBe('product')
  })

  it('returns null without a valid price', () => {
    expect(buildVaultProductMetadata({ ...SETTINGS, price: 'free' })).toBeNull()
  })
})

describe('buildVaultProductBody', () => {
  it('explains price, renewal, cancellation and direct payment', () => {
    const body = buildVaultProductBody(SETTINGS, { account: 'alice' })
    expect(body).toContain('5.000 HBD per month')
    expect(body).toContain('12 monthly payments')
    expect(body).toContain('cancel any time')
    expect(body).toContain('no escrow')
    expect(body).toContain('alice/membership')
    expect(body.length).toBeLessThan(4000)
  })
})

describe('product and container operations', () => {
  it('builds a top-level comment with HOM metadata', () => {
    const operation = buildVaultProductOperation({ account: 'alice', settings: SETTINGS })
    expect(operation[0]).toBe('comment')
    const data = operation[1]
    expect(data.parent_author).toBe('')
    expect(data.parent_permlink).toBe('membership')
    expect(data.permlink).toBe('membership')
    expect(data.title).toBe('Membership — @alice')
    const metadata = JSON.parse(data.json_metadata)
    expect(metadata.content_type).toBe('product')
    expect(metadata.app).toBe('banksia.io')
    expect(metadata.format).toBe('markdown')
    expect(metadata.tags).toEqual(['membership', 'vault'])
    expect(metadata.image).toBeUndefined()
  })

  it('rejects an invalid account or product', () => {
    expect(buildVaultProductOperation({ account: 'Not An Account', settings: SETTINGS })).toBeNull()
    expect(buildVaultProductOperation({ account: 'alice', settings: { ...SETTINGS, price: '' } })).toBeNull()
  })

  it('builds the hidden grant container', () => {
    const operation = buildVaultContainerOperation({ account: 'alice' })
    const data = operation[1]
    expect(operation[0]).toBe('comment')
    expect(data.parent_permlink).toBe('membership')
    expect(data.permlink).toBe('banksia-vault')
    expect(data.body).toBe('Membership grant container. Do not reply here.')
    const metadata = JSON.parse(data.json_metadata)
    expect(metadata.banksia_vault_container).toBe(true)
    expect(metadata.tags).toEqual(['membership'])
  })
})

describe('parseVaultProduct', () => {
  it('parses our own product from a post', () => {
    const post = postFrom(buildVaultProductMetadata(SETTINGS))
    const product = parseVaultProduct(post)
    expect(product).toMatchObject({
      author: 'alice',
      permlink: 'membership',
      title: 'Membership',
      price: 5,
      priceLabel: '5.000 HBD',
      currency: 'HIVE:HBD',
      amount: '5.000 HBD',
      subscription: true,
      recurrenceHours: 730,
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all',
      status: 1
    })
    expect(product.tags).toEqual(['membership', 'vault'])
    expect(isVaultProduct(post)).toBe(true)
  })

  it('accepts json_metadata as an object as well as a string', () => {
    const post = postFrom({}, { json_metadata: buildVaultProductMetadata(SETTINGS) })
    expect(parseVaultProduct(post).price).toBe(5)
  })

  it('accepts a generic HOM subscription tagged membership or vault', () => {
    const post = postFrom({
      content_type: 'product',
      currency: 'HIVE:HBD',
      price: 3,
      subscription: 1,
      subscription_recurrence: 720,
      tags: ['writing', 'vault']
    })
    const product = parseVaultProduct(post)
    expect(product).toMatchObject({
      price: 3,
      priceLabel: '3.000 HBD',
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all'
    })
  })

  it('rejects generic HOM subscriptions without a membership tag', () => {
    const post = postFrom({
      content_type: 'product',
      currency: 'HIVE:HBD',
      price: 3,
      subscription: 1,
      subscription_recurrence: 720,
      tags: ['writing']
    })
    expect(parseVaultProduct(post)).toBeNull()
  })

  it('rejects non-products, wrong currencies, prices and statuses', () => {
    expect(parseVaultProduct(postFrom({ content_type: 'article' }))).toBeNull()
    expect(parseVaultProduct(postFrom({ ...buildVaultProductMetadata(SETTINGS), currency: 'HIVE:HIVE' }))).toBeNull()
    expect(parseVaultProduct(postFrom({ ...buildVaultProductMetadata(SETTINGS), price: 0 }))).toBeNull()
    expect(parseVaultProduct(postFrom({ ...buildVaultProductMetadata(SETTINGS), status: 9 }))).toBeNull()
    expect(parseVaultProduct(postFrom({ ...buildVaultProductMetadata(SETTINGS), subscription: 0 }))).toBeNull()
    expect(parseVaultProduct(postFrom({ ...buildVaultProductMetadata(SETTINGS), subscription_recurrence: 12 }))).toBeNull()
    expect(parseVaultProduct(null)).toBeNull()
  })

  it('rejects an unknown extension version', () => {
    const metadata = buildVaultProductMetadata(SETTINGS)
    metadata.banksia_vault_product.v = 2
    expect(parseVaultProduct(postFrom(metadata))).toBeNull()
  })
})

describe('deriveVaultPlan', () => {
  it('uses the product post amount and never the blog price', () => {
    const post = postFrom(buildVaultProductMetadata(SETTINGS))
    const plan = deriveVaultPlan(post, {
      fallback: {
        price: '99.000 HBD',
        amount: '99.000 HBD',
        executions: 24,
        plan: 'member',
        container: 'banksia-vault',
        archive: 'all'
      }
    })
    expect(plan).toEqual({
      author: 'alice',
      permlink: 'membership',
      price: 5,
      priceLabel: '5.000 HBD',
      currency: 'HBD',
      amount: '5.000 HBD',
      recurrence: 730,
      executions: 24,
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all',
      title: 'Membership'
    })
  })

  it('returns null for a non-product post', () => {
    expect(deriveVaultPlan(postFrom({ content_type: 'article' }))).toBeNull()
  })
})

describe('identifiers and paths', () => {
  it('detects the container flag', () => {
    const container = postFrom({
      app: 'banksia.io',
      banksia_vault_container: true
    }, { permlink: 'banksia-vault' })
    expect(isVaultContainer(container)).toBe(true)
    expect(isVaultContainer(postFrom({}))).toBe(false)
  })

  it('builds the canonical shop path', () => {
    expect(vaultProductPath('Alice', 'membership')).toBe('/shop/@alice/membership')
    expect(vaultProductPath('not an account', 'membership')).toBe('')
    expect(vaultProductPath('alice', 'Bad Permlink')).toBe('')
  })
})
