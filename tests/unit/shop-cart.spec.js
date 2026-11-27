import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseProductMetadata } from '../../src/services/blogShop'
import {
  buildCheckoutOperations,
  buildPaymentOperation,
  checkoutUrl,
  parseCheckoutItems,
  recordPurchases,
  serializeCheckoutItems,
  totalsByTicker,
  validateCheckout
} from '../../src/services/shopCart'
import {
  CART_STORAGE_KEY,
  readCartItems,
  persistCartItems,
  useCartStore
} from '../../src/stores/cart'

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
      ...metadata
    })
  }
}

function product (metadata = {}, post = {}) {
  return parseProductMetadata({ ...productPost(metadata), ...post })
}

function fakeStorage (initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values)
  }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('checkout item references', () => {
  it('round-trips encoded items through serialize and parse', () => {
    const items = [
      { author: 'alice', permlink: 'hosting', quantity: 2 },
      { author: 'bob', permlink: 'art', quantity: 1 }
    ]
    const serialized = serializeCheckoutItems(items)
    expect(serialized).toBe('alice%2Fhosting:2,bob%2Fart:1')
    expect(parseCheckoutItems(serialized)).toEqual(items)
    expect(checkoutUrl(items)).toBe('/checkout?items=alice%2Fhosting:2,bob%2Fart:1')
    expect(checkoutUrl([])).toBe('/checkout')
  })

  it('accepts decoded, repeated and object forms', () => {
    expect(parseCheckoutItems('alice/hosting:1,bob/art:2')).toEqual([
      { author: 'alice', permlink: 'hosting', quantity: 1 },
      { author: 'bob', permlink: 'art', quantity: 2 }
    ])
    expect(parseCheckoutItems(['alice/hosting:1', 'bob/art:2'])).toHaveLength(2)
    expect(parseCheckoutItems([{ author: 'Alice', permlink: 'hosting', quantity: '3' }])).toEqual([
      { author: 'alice', permlink: 'hosting', quantity: 3 }
    ])
    expect(parseCheckoutItems({ items: 'alice/hosting:1' })).toHaveLength(1)
  })

  it('rejects bad accounts and permlinks and dedupes by key', () => {
    const parsed = parseCheckoutItems([
      'ab/hosting:1',
      '-alice/hosting:1',
      'alice/hosting with space:1',
      'alice:1',
      'alice/hosting:1',
      'alice/hosting:5',
      'bob/art:2'
    ])
    expect(parsed).toEqual([
      { author: 'alice', permlink: 'hosting', quantity: 1 },
      { author: 'bob', permlink: 'art', quantity: 2 }
    ])
  })

  it('caps at 20 items and clamps quantities to 1..99', () => {
    const references = Array.from({ length: 25 }, (_, index) => 'alice/item-' + index + ':1')
    expect(parseCheckoutItems(references.join(','))).toHaveLength(20)

    const parsed = parseCheckoutItems('alice/a:0,alice/b:500,alice/c:2.9,alice/d:1')
    expect(parsed.map(item => item.quantity)).toEqual([1, 99, 2, 1])
  })
})

describe('payment operations', () => {
  it('builds a normal transfer with the exact 3-decimal total and HOM memo', () => {
    const hosting = product()
    expect(buildPaymentOperation(hosting, 2, 'buyer')).toEqual(['transfer', {
      to: 'alice',
      from: 'buyer',
      amount: '50.000 HBD',
      memo: '{"product":"alice/managed-hosting","quantity":2}'
    }])
  })

  it('rounds sub-unit totals to three decimals', () => {
    const cheap = product({ price: 0.1, permlink: 'cheap' })
    expect(buildPaymentOperation(cheap, 3, 'buyer')[1].amount).toBe('0.300 HBD')
  })

  it('forces subscriptions to recurrent_transfer with quantity 1 and a chosen count', () => {
    const hosting = product({ subscription: 1, subscription_recurrence: 730 })
    expect(buildPaymentOperation(hosting, 5, 'buyer', { executions: 3 })).toEqual([
      'recurrent_transfer',
      {
        to: 'alice',
        from: 'buyer',
        amount: '25.000 HBD',
        memo: '{"product":"alice/managed-hosting","quantity":1}',
        recurrence: 730,
        executions: 3,
        extensions: []
      }
    ])
  })

  it('defaults and clamps subscription executions to 1..12', () => {
    const hosting = product({ subscription: 1, subscription_recurrence: 730 })
    expect(buildPaymentOperation(hosting, 1, 'buyer')[1].executions).toBe(12)
    expect(buildPaymentOperation(hosting, 1, 'buyer', { executions: 0 })[1].executions).toBe(1)
    expect(buildPaymentOperation(hosting, 1, 'buyer', { executions: 99 })[1].executions).toBe(12)
  })

  it('returns null without a product', () => {
    expect(buildPaymentOperation(null, 1, 'buyer')).toBeNull()
  })
})

describe('checkout validation', () => {
  const hosting = product()
  const art = product({ currency: 'HIVE:HIVE', price: 3.5 }, { author: 'Bob', permlink: 'art' })
  const inactive = product({ status: 2 }, { author: 'Carol', permlink: 'old' })
  const unsupported = {
    ...hosting,
    author: 'dave',
    permlink: 'token',
    currency: 'HIVE:USD',
    ticker: 'USD',
    priceLabel: '5.000 USD'
  }

  it('validates a mixed HBD and HIVE cart without combining currencies', () => {
    const items = [
      { author: 'alice', permlink: 'managed-hosting', quantity: 2 },
      { author: 'bob', permlink: 'art', quantity: 1 }
    ]
    const result = validateCheckout([hosting, art], items, 'buyer')
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.lines.map(line => line.totalLabel)).toEqual(['50.000 HBD', '3.500 HIVE'])
    expect(result.lines.map(line => line.memo)).toEqual([
      '{"product":"alice/managed-hosting","quantity":2}',
      '{"product":"bob/art","quantity":1}'
    ])
    expect(totalsByTicker(result.lines)).toEqual([
      { ticker: 'HBD', label: '50.000 HBD' },
      { ticker: 'HIVE', label: '3.500 HIVE' }
    ])
  })

  it('explains missing, inactive, unsupported and invalid-quantity lines', () => {
    const items = [
      { author: 'alice', permlink: 'managed-hosting', quantity: 1 },
      { author: 'carol', permlink: 'old', quantity: 1 },
      { author: 'dave', permlink: 'token', quantity: 1 },
      { author: 'nobody', permlink: 'missing', quantity: 1 },
      { author: 'alice', permlink: 'managed-hosting', quantity: 0 }
    ]
    const result = validateCheckout([hosting, inactive, unsupported], items, 'buyer')
    expect(result.ok).toBe(false)
    expect(result.lines).toHaveLength(1)
    expect(result.errors.join(' ')).toContain('@carol/old is inactive')
    expect(result.errors.join(' ')).toContain('uses a currency Banksia does not support')
    expect(result.errors.join(' ')).toContain('@nobody/missing could not be loaded')
    expect(result.errors.join(' ')).toContain('Quantity for @alice/managed-hosting')
  })

  it('requires a signed-in account and a non-empty cart', () => {
    const empty = validateCheckout([], [], '')
    expect(empty.ok).toBe(false)
    expect(empty.errors).toEqual([
      'Sign in with your Hive account to continue to checkout.',
      'Your cart is empty.'
    ])
  })

  it('builds one operation per purchasable line and skips the rest', () => {
    const items = [
      { author: 'alice', permlink: 'managed-hosting', quantity: 2 },
      { author: 'carol', permlink: 'old', quantity: 1 },
      { author: 'bob', permlink: 'art', quantity: 4 }
    ]
    const lines = buildCheckoutOperations([hosting, art, inactive], items, 'buyer')
    expect(lines).toHaveLength(2)
    expect(lines.map(line => line.operation[0])).toEqual(['transfer', 'transfer'])
    expect(lines.map(line => line.totalLabel)).toEqual(['50.000 HBD', '14.000 HIVE'])
    expect(lines[1].item.quantity).toBe(4)
  })
})

describe('purchase recording', () => {
  it('records product keys and keeps earlier purchases', () => {
    const storage = fakeStorage({
      'banksia:shop-purchases': JSON.stringify({ 'old/post': '2026-01-01T00:00:00.000Z' })
    })
    const keys = recordPurchases([product(), product({}, { author: 'Bob', permlink: 'art' })], storage)
    expect(keys).toEqual(['alice/managed-hosting', 'bob/art'])
    const stored = JSON.parse(storage.getItem('banksia:shop-purchases'))
    expect(stored['old/post']).toBe('2026-01-01T00:00:00.000Z')
    expect(stored['alice/managed-hosting']).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(stored['bob/art']).toBeTruthy()
  })

  it('tolerates malformed and legacy storage', () => {
    const malformed = fakeStorage({ 'banksia:shop-purchases': '{not json' })
    expect(recordPurchases([product()], malformed)).toEqual(['alice/managed-hosting'])
    expect(JSON.parse(malformed.getItem('banksia:shop-purchases'))).toHaveProperty('alice/managed-hosting')

    const legacy = fakeStorage({ 'banksia:shop-purchases': JSON.stringify(['old/post']) })
    recordPurchases([product()], legacy)
    expect(JSON.parse(legacy.getItem('banksia:shop-purchases'))).toMatchObject({
      'old/post': true,
      'alice/managed-hosting': expect.any(String)
    })
  })
})

describe('cart store', () => {
  it('adds, dedupes, clamps and persists line items', () => {
    const cart = useCartStore()
    expect(cart.add({ author: 'Alice', permlink: 'hosting', quantity: 2 })).toBe(true)
    expect(cart.add({ author: 'alice', permlink: 'hosting', quantity: 3 })).toBe(true)
    expect(cart.items).toEqual([{ author: 'alice', permlink: 'hosting', quantity: 5 }])
    expect(cart.count).toBe(5)
    expect(cart.has('alice/hosting')).toBe(true)

    expect(cart.add({ author: 'not valid!', permlink: 'x', quantity: 1 })).toBe(false)
    expect(cart.setQuantity('alice/hosting', 500)).toBe(true)
    expect(cart.items[0].quantity).toBe(99)
    expect(cart.setQuantity('alice/hosting', 0)).toBe(true)
    expect(cart.items[0].quantity).toBe(1)

    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual({
      items: [{ author: 'alice', permlink: 'hosting', quantity: 1 }]
    })
    expect(cart.remove('alice/hosting')).toBe(true)
    expect(cart.items).toEqual([])
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
  })

  it('caps the cart at 20 lines', () => {
    const cart = useCartStore()
    for (let index = 0; index < 25; index += 1) {
      cart.add({ author: 'alice', permlink: 'item-' + index, quantity: 1 })
    }
    expect(cart.items).toHaveLength(20)
    expect(cart.isFull).toBe(true)
    expect(cart.add({ author: 'alice', permlink: 'overflow', quantity: 1 })).toBe(false)
  })

  it('reloads malformed storage, deduping and capping quantities', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([
      { author: 'alice', permlink: 'a', quantity: 500 },
      { author: 'alice', permlink: 'a', quantity: 2 },
      { author: 'bad!', permlink: 'b', quantity: 1 },
      { author: 'bob', permlink: 'c', quantity: 0 }
    ]))
    expect(readCartItems()).toEqual([
      { author: 'alice', permlink: 'a', quantity: 99 },
      { author: 'bob', permlink: 'c', quantity: 1 }
    ])

    localStorage.setItem(CART_STORAGE_KEY, '{broken')
    expect(readCartItems()).toEqual([])

    const cart = useCartStore()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      items: [{ author: 'bob', permlink: 'art', quantity: 2 }]
    }))
    cart.reload()
    expect(cart.items).toEqual([{ author: 'bob', permlink: 'art', quantity: 2 }])
  })

  it('never throws when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') }
    }
    expect(readCartItems(broken)).toEqual([])
    expect(() => persistCartItems([{ author: 'alice', permlink: 'a', quantity: 1 }], broken)).not.toThrow()
  })
})
