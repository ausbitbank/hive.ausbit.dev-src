// Hive Open Market data layer: parsing, pagination, discovery and JSON-LD.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatProductAmount,
  listProducts,
  normalizeProduct,
  productJsonLd,
  productTotalLabel,
  purchaseMemo
} from '../../src/services/hiveMarket'

vi.mock('../../src/services/chainData', () => ({
  fetchAccountPosts: vi.fn(),
  fetchPostContent: vi.fn(),
  fetchRankedPosts: vi.fn()
}))

import { fetchAccountPosts, fetchPostContent, fetchRankedPosts } from '../../src/services/chainData'

function productPost ({
  author = 'alice',
  permlink = 'managed-hosting',
  title = 'Managed Hive hosting',
  body = 'Hosting.',
  created = '2026-11-18T10:00:00',
  meta = {}
} = {}) {
  return {
    author,
    permlink,
    title,
    body,
    created,
    json_metadata: JSON.stringify({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 25,
      subscription: 0,
      status: 1,
      tags: ['hosting', 'linux'],
      image: ['https://images.hive.blog/hosting.png'],
      ...meta
    })
  }
}

function nonProduct (author = 'alice', permlink = 'a-post') {
  return {
    author,
    permlink,
    title: 'A post',
    body: 'Not a product.',
    json_metadata: JSON.stringify({ tags: ['blog'] })
  }
}

function padToPage (rows) {
  const page = rows.slice()
  while (page.length < 20) {
    page.push(nonProduct('filler', 'post-' + page.length))
  }
  return page
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  fetchAccountPosts.mockResolvedValue([])
  fetchRankedPosts.mockResolvedValue([])
  fetchPostContent.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeProduct', () => {
  it('parses a one-time HBD product', () => {
    expect(normalizeProduct(productPost())).toMatchObject({
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
  })

  it('parses subscriptions and keeps recurrence hours', () => {
    const product = normalizeProduct(productPost({
      meta: { subscription: 1, subscription_recurrence: 730 }
    }))
    expect(product.subscription).toBe(true)
    expect(product.recurrenceHours).toBe(730)
    expect(normalizeProduct(productPost({
      meta: { subscription: 1, subscription_recurrence: 0 }
    })).subscription).toBe(false)
    // The protocol minimum recurrence is 24 hours.
    expect(normalizeProduct(productPost({
      meta: { subscription: 1, subscription_recurrence: 12 }
    })).subscription).toBe(false)
    // The indexer casts JSON booleans, so accept `true` as well as 1.
    expect(normalizeProduct(productPost({
      meta: { subscription: true, subscription_recurrence: 24 }
    })).subscription).toBe(true)
  })

  it('rejects a status the protocol does not define', () => {
    expect(normalizeProduct(productPost({ meta: { status: 9 } }))).toBeNull()
  })

  it('keeps inactive and out-of-stock states', () => {
    expect(normalizeProduct(productPost({ meta: { status: 2 } })))
      .toMatchObject({ status: 2, statusLabel: 'Inactive' })
    expect(normalizeProduct(productPost({ meta: { status: 3 } })))
      .toMatchObject({ status: 3, statusLabel: 'Out of stock' })
  })

  it('rejects non-products, bad currencies and zero prices', () => {
    expect(normalizeProduct(nonProduct())).toBeNull()
    expect(normalizeProduct(productPost({ meta: { content_type: 'post' } }))).toBeNull()
    expect(normalizeProduct(productPost({ meta: { currency: 'BTC:BTC' } }))).toBeNull()
    expect(normalizeProduct(productPost({ meta: { price: 0 } }))).toBeNull()
    expect(normalizeProduct(productPost({ meta: { price: -1 } }))).toBeNull()
    expect(normalizeProduct(null)).toBeNull()
  })

  it('always formats money with three decimals', () => {
    expect(formatProductAmount(0.001, 'HBD')).toBe('0.001 HBD')
    expect(formatProductAmount(25, 'HBD')).toBe('25.000 HBD')
    const product = normalizeProduct(productPost({ meta: { price: 0.001 } }))
    expect(product.priceLabel).toBe('0.001 HBD')
    expect(productTotalLabel(product, 2)).toBe('0.002 HBD')
    expect(purchaseMemo('Alice', 'managed-hosting', 2))
      .toBe('{"product":"alice/managed-hosting","quantity":2}')
  })
})

describe('listProducts', () => {
  it('dedupes rows and pages with an opaque cursor', async () => {
    const alpha = productPost({ author: 'Alice', permlink: 'alpha' })
    const alphaAgain = productPost({ author: 'alice', permlink: 'ALPHA' })
    const beta = productPost({ author: 'bob', permlink: 'beta' })
    const gamma = productPost({ author: 'carol', permlink: 'gamma' })

    fetchAccountPosts.mockImplementation(async params => {
      if (params.start_permlink === 'beta') return [gamma]
      return padToPage([alpha, alphaAgain, beta])
    })

    const first = await listProducts({ author: 'alice', limit: 2 })
    expect(first.items.map(product => product.permlink)).toEqual(['alpha', 'beta'])
    expect(first.nextCursor).toEqual(expect.any(String))
    expect(first.nextCursor).not.toBe('')

    const second = await listProducts({ author: 'alice', limit: 2, cursor: first.nextCursor })
    expect(second.items.map(product => product.permlink)).toEqual(['gamma'])
    expect(second.nextCursor).toBeNull()

    expect(fetchAccountPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      sort: 'posts',
      account: 'alice',
      start_author: 'bob',
      start_permlink: 'beta'
    }))
  })

  it('filters inactive products unless includeInactive is set', async () => {
    fetchAccountPosts.mockResolvedValue([
      productPost({ permlink: 'active' }),
      productPost({ permlink: 'paused', meta: { status: 2 } }),
      productPost({ permlink: 'sold-out', meta: { status: 3 } })
    ])

    const active = await listProducts({ author: 'alice', limit: 10 })
    expect(active.items.map(product => product.permlink)).toEqual(['active'])

    const all = await listProducts({ author: 'alice', limit: 10, includeInactive: true })
    expect(all.items.map(product => product.permlink)).toEqual(['active', 'paused', 'sold-out'])
  })

  it('prepends curated featured posts without duplicates', async () => {
    fetchAccountPosts.mockResolvedValue([
      productPost({ author: 'alice', permlink: 'alpha' }),
      productPost({ author: 'alice', permlink: 'beta' })
    ])
    fetchPostContent.mockImplementation(async (author, permlink) => {
      if (permlink === 'featured') return productPost({ author: 'zed', permlink: 'featured' })
      if (permlink === 'alpha') return productPost({ author: 'alice', permlink: 'alpha' })
      return null
    })

    const result = await listProducts({
      author: 'alice',
      limit: 5,
      featured: ['zed/featured', 'alice/alpha', 'missing/post', 'not-a-ref']
    })

    expect(result.items.map(product => product.author + '/' + product.permlink)).toEqual([
      'zed/featured',
      'alice/alpha',
      'alice/beta'
    ])
    expect(fetchPostContent).toHaveBeenCalledWith('zed', 'featured')
    expect(fetchPostContent).toHaveBeenCalledWith('missing', 'post')
    expect(fetchPostContent).not.toHaveBeenCalledWith('not-a-ref', undefined)
  })

  it('does not re-resolve featured posts on later pages', async () => {
    fetchPostContent.mockResolvedValue(productPost({ author: 'zed', permlink: 'featured' }))
    fetchAccountPosts.mockImplementation(async params => (
      params.start_permlink === 'alpha'
        ? [productPost({ permlink: 'beta' })]
        : padToPage([productPost({ permlink: 'alpha' })])
    ))

    const first = await listProducts({
      author: 'alice',
      limit: 2,
      featured: ['zed/featured']
    })
    expect(first.items.map(product => product.permlink)).toEqual(['featured', 'alpha'])
    expect(first.nextCursor).toEqual(expect.any(String))
    fetchPostContent.mockClear()

    const second = await listProducts({
      author: 'alice',
      limit: 2,
      cursor: first.nextCursor,
      featured: ['zed/featured']
    })
    expect(second.items.map(product => product.permlink)).toEqual(['beta'])
    expect(fetchPostContent).not.toHaveBeenCalled()
  })

  it('reads tag listings from the ranked chain feed', async () => {
    fetchRankedPosts.mockResolvedValue([productPost({ author: 'dave', permlink: 'tagged' })])

    const result = await listProducts({ tag: 'hive-open-market', limit: 5 })

    expect(result.items.map(product => product.permlink)).toEqual(['tagged'])
    expect(fetchRankedPosts).toHaveBeenCalledWith(expect.objectContaining({
      sort: 'created',
      tag: 'hive-open-market'
    }))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('falls back to the global chain feed when the market API is down', async () => {
    fetchRankedPosts.mockResolvedValue([productPost({ author: 'erin', permlink: 'global' })])

    const result = await listProducts({})

    expect(result.items.map(product => product.permlink)).toEqual(['global'])
    expect(fetchRankedPosts).toHaveBeenCalledWith(expect.objectContaining({ sort: 'created' }))
  })

  it('uses API candidates for discovery but takes money from chain', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{
        author: 'carol',
        permlink: 'discovered',
        price: 999999,
        currency: 'HIVE:HBD'
      }]
    })
    fetchPostContent.mockResolvedValue(productPost({
      author: 'carol',
      permlink: 'discovered',
      meta: { price: 0.001 }
    }))

    const result = await listProducts({ limit: 1 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      author: 'carol',
      permlink: 'discovered',
      price: 0.001,
      priceLabel: '0.001 HBD'
    })
    expect(fetchPostContent).toHaveBeenCalledWith('carol', 'discovered')
    expect(String(fetch.mock.calls[0][0])).toContain('https://market-api.hivehub.dev/products')
  })

  it('skips broken posts rather than throwing', async () => {
    fetchAccountPosts.mockResolvedValue([
      null,
      { author: 'alice' },
      nonProduct(),
      productPost({ permlink: 'ok' })
    ])

    const result = await listProducts({ author: 'alice' })
    expect(result.items.map(product => product.permlink)).toEqual(['ok'])
  })
})

describe('productJsonLd', () => {
  it('emits Product/Offer JSON-LD with HBD ticker and stock state', () => {
    const product = normalizeProduct(productPost({ meta: { price: 0.001, status: 3 } }))
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

  it('maps every status to schema.org availability', () => {
    const url = 'https://alice.banksia.io/shop/x'
    expect(productJsonLd(normalizeProduct(productPost()), url).offers.availability)
      .toBe('https://schema.org/InStock')
    expect(productJsonLd(normalizeProduct(productPost({ meta: { status: 2 } })), url)
      .offers.availability).toBe('https://schema.org/Discontinued')
    expect(productJsonLd(normalizeProduct(productPost({ meta: { currency: 'HIVE:HIVE' } })), url)
      .offers.priceCurrency).toBe('HIVE')
    expect(productJsonLd(null, url)).toBeNull()
  })
})
