import { describe, expect, it } from 'vitest'
import {
  formatProductAmount,
  isPurchasable,
  isSupportedProduct,
  parseProductMetadata,
  productJsonLd,
  productTotalLabel,
  purchaseMemo
} from '../../src/services/blogShop'

function productPost (metadata = {}) {
  return {
    author: 'Alice',
    permlink: 'managed-hosting',
    title: 'Managed Hive hosting',
    body: 'Hosting.',
    created: '2026-11-18T10:00:00',
    json_metadata: JSON.stringify({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 25,
      subscription: 0,
      status: 1,
      tags: ['hosting', 'linux'],
      image: ['https://images.hive.blog/hosting.png'],
      ...metadata
    })
  }
}

describe('Hive Open Market products', () => {
  it('parses a one-time HBD product', () => {
    const product = parseProductMetadata(productPost())
    expect(product).toMatchObject({
      author: 'alice',
      permlink: 'managed-hosting',
      title: 'Managed Hive hosting',
      currency: 'HIVE:HBD',
      ticker: 'HBD',
      price: 25,
      priceLabel: '25.000 HBD',
      subscription: false,
      status: 1,
      statusLabel: 'Available',
      tags: ['hosting', 'linux']
    })
    expect(isSupportedProduct(product)).toBe(true)
    expect(isPurchasable(product)).toBe(true)
  })

  it('parses a subscription product', () => {
    const product = parseProductMetadata(productPost({ subscription: 1, subscription_recurrence: 730 }))
    expect(product.subscription).toBe(true)
    expect(product.recurrenceHours).toBe(730)
    expect(parseProductMetadata(productPost({ subscription: 1, subscription_recurrence: 0 })).subscription).toBe(false)
  })

  it('handles inactive and out-of-stock products', () => {
    expect(parseProductMetadata(productPost({ status: 2 }))).toMatchObject({ status: 2, statusLabel: 'Inactive' })
    expect(isPurchasable(parseProductMetadata(productPost({ status: 3 })))).toBe(false)
  })

  it('rejects non-products and unsupported currencies', () => {
    expect(parseProductMetadata({ author: 'alice', permlink: 'x', json_metadata: '{}' })).toBeNull()
    expect(parseProductMetadata(productPost({ content_type: 'post' }))).toBeNull()
    expect(parseProductMetadata(productPost({ currency: 'BTC:BTC' }))).toBeNull()
    expect(parseProductMetadata(productPost({ price: 0 }))).toBeNull()
  })

  it('formats totals and the purchase memo', () => {
    const product = parseProductMetadata(productPost())
    expect(formatProductAmount(25, 'HBD')).toBe('25.000 HBD')
    expect(productTotalLabel(product, 2)).toBe('50.000 HBD')
    expect(purchaseMemo('Alice', 'managed-hosting', 2))
      .toBe('{"product":"alice/managed-hosting","quantity":2}')
  })

  it('keeps the body and image gallery in the product contract', () => {
    const product = parseProductMetadata(productPost({
      image: ['https://images.hive.blog/hosting.png', 'https://images.hive.blog/rack.png', 'http://insecure.example/x.png']
    }))
    expect(product.body).toBe('Hosting.')
    expect(product.images).toEqual([
      'https://images.hive.blog/hosting.png',
      'https://images.hive.blog/rack.png'
    ])
    expect(product.image).toBe('https://images.hive.blog/hosting.png')
  })

  it('emits Product/Offer JSON-LD without faking an ISO currency', () => {
    const product = parseProductMetadata(productPost({ price: 0.001, status: 3 }))
    const jsonLd = productJsonLd(product, 'https://alice.banksia.io/shop/managed-hosting')
    expect(jsonLd).toMatchObject({
      '@type': 'Product',
      name: 'Managed Hive hosting',
      sku: 'alice/managed-hosting',
      url: 'https://alice.banksia.io/shop/managed-hosting',
      offers: {
        '@type': 'Offer',
        price: '0.001',
        priceCurrency: 'HBD',
        availability: 'https://schema.org/OutOfStock',
        seller: { '@type': 'Person', name: '@alice', url: 'https://banksia.io/@alice' }
      }
    })
  })
})
