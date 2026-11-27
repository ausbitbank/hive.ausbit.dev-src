// Cart and checkout helpers for the Hive Open Market shop.
//
// The URL only ever selects products and quantities. Amounts, sellers and
// memos are re-derived from the product posts fetched at checkout, so a crafted
// `/checkout?items=...` link cannot change what is paid.

import { BLOG_MAX_CART_ITEMS } from 'src/config/blog'
import { isValidHiveAccountName } from './blogHost'
import {
  formatProductAmount,
  isPurchasable,
  isSupportedProduct,
  productTotalLabel,
  purchaseMemo
} from './blogShop'
import { isMembershipProduct } from './shopMembership'

export const CART_STORAGE_KEY = 'banksia:shop-cart'
export const PURCHASES_STORAGE_KEY = 'banksia:shop-purchases'
export const MAX_CART_QUANTITY = 99
export const MAX_SUBSCRIPTION_EXECUTIONS = 12

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/i

export function cartItemKey (item) {
  if (!item) return ''
  return String(item.author || '').toLowerCase() + '/' + String(item.permlink || '')
}

function clampQuantity (value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) return 1
  return Math.min(MAX_CART_QUANTITY, Math.max(1, number))
}

function clampExecutions (value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) return MAX_SUBSCRIPTION_EXECUTIONS
  return Math.min(MAX_SUBSCRIPTION_EXECUTIONS, Math.max(1, number))
}

/** Validate one `{ author, permlink, quantity }` item, or return null. */
function normalizeItem (value) {
  if (!value || typeof value !== 'object') return null
  const author = String(value.author || '').trim().toLowerCase()
  const permlink = String(value.permlink || '').trim()
  if (!isValidHiveAccountName(author) || !PERMLINK_RE.test(permlink)) return null
  return { author, permlink, quantity: clampQuantity(value.quantity) }
}

function decode (value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '))
  } catch {
    return String(value || '')
  }
}

function itemFromReference (reference) {
  const raw = String(reference || '').trim()
  if (!raw) return null
  const separator = raw.lastIndexOf(':')
  const hasQuantity = separator > -1
  const path = hasQuantity ? raw.slice(0, separator) : raw
  const quantity = hasQuantity ? raw.slice(separator + 1) : 1
  const slash = path.indexOf('/')
  if (slash < 1) return null
  return normalizeItem({
    author: path.slice(0, slash),
    permlink: path.slice(slash + 1),
    quantity
  })
}

function collectReferences (query, output) {
  if (query === null || query === undefined) return output
  if (Array.isArray(query)) {
    for (const entry of query) collectReferences(entry, output)
    return output
  }
  if (typeof query === 'object') {
    if (query.author !== undefined || query.permlink !== undefined) {
      output.push(query)
      return output
    }
    if (query.items !== undefined) return collectReferences(query.items, output)
    return output
  }
  for (const part of String(query).split(',')) output.push(part)
  return output
}

/**
 * Parse a checkout `items` query into safe cart items.
 *
 * Accepts `alice%2Fhosting:1,bob%2Fart:2`, the decoded form, repeated query
 * values (`items=a:1&items=b:2`), and `{ items: [...] }`. Everything else is
 * ignored: only account, permlink and a clamped quantity survive.
 */
export function parseCheckoutItems (query) {
  const references = collectReferences(query, [])
  const items = []
  const seen = new Set()
  for (const reference of references) {
    const item = typeof reference === 'string'
      ? itemFromReference(decode(reference))
      : normalizeItem(reference)
    if (!item) continue
    const key = cartItemKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length >= BLOG_MAX_CART_ITEMS) break
  }
  return items
}

/** Serialize cart items as `alice%2Fhosting:1,bob%2Fart:2`. */
export function serializeCheckoutItems (items) {
  if (!Array.isArray(items)) return ''
  const parts = []
  const seen = new Set()
  for (const value of items) {
    const item = normalizeItem(value)
    if (!item) continue
    const key = cartItemKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(encodeURIComponent(key) + ':' + item.quantity)
    if (parts.length >= BLOG_MAX_CART_ITEMS) break
  }
  return parts.join(',')
}

export function checkoutUrl (items) {
  const serialized = serializeCheckoutItems(items)
  return serialized ? '/checkout?items=' + serialized : '/checkout'
}

/**
 * Build the single chain operation for one product line.
 *
 * Subscriptions always use `recurrent_transfer` with quantity 1 and the
 * recurrence advertised by the product post. One-time products use a normal
 * `transfer`. Amounts are the 3-decimal product total, never a URL value.
 */
export function buildPaymentOperation (product, quantity = 1, username = '', { executions } = {}) {
  if (!product || !product.author || !product.permlink) return null
  const subscription = Boolean(product.subscription && Number(product.recurrenceHours) > 0)
  const amount = subscription ? 1 : clampQuantity(quantity)
  const totalLabel = productTotalLabel(product, amount)
  const memo = purchaseMemo(product.author, product.permlink, amount)
  const to = String(product.author).toLowerCase()
  const from = String(username || '')

  if (subscription) {
    return ['recurrent_transfer', {
      to,
      from,
      amount: totalLabel,
      memo,
      recurrence: Number(product.recurrenceHours),
      executions: clampExecutions(executions),
      extensions: []
    }]
  }

  return ['transfer', { to, from, amount: totalLabel, memo }]
}

function indexProducts (products) {
  const map = new Map()
  const add = product => {
    if (!product || !product.author || !product.permlink) return
    map.set(cartItemKey(product), product)
  }
  if (products instanceof Map) {
    for (const product of products.values()) add(product)
  } else if (Array.isArray(products)) {
    for (const product of products) add(product)
  } else if (products && typeof products === 'object') {
    for (const product of Object.values(products)) add(product)
  }
  return map
}

/**
 * Build operations for every valid line, skipping missing or unpurchasable
 * products. Callers should use `validateCheckout` to explain the skips.
 */
export function buildCheckoutOperations (products, items, username, { executions } = {}) {
  const catalog = indexProducts(products)
  const lines = []
  for (const value of Array.isArray(items) ? items : []) {
    const item = normalizeItem(value)
    if (!item) continue
    const product = catalog.get(cartItemKey(item))
    if (!product || !isPurchasable(product)) continue
    // A Vault membership needs a reader key in the memo. Cart checkout cannot
    // supply one, so it must use the apex Subscribe flow instead.
    if (isMembershipProduct(product)) continue
    const operation = buildPaymentOperation(product, item.quantity, username, { executions })
    if (!operation) continue
    lines.push({
      product,
      item: { ...item, quantity: product.subscription ? 1 : item.quantity },
      operation,
      memo: operation[1].memo,
      totalLabel: operation[1].amount
    })
  }
  return lines
}

/**
 * Validate a checkout against freshly fetched products.
 *
 * Returns every problem in `errors` and a `lines` entry for each payable item
 * with the exact memo and per-payment total the queue would use.
 */
export function validateCheckout (products, items, username) {
  const list = Array.isArray(items) ? items : []
  const errors = []
  const lines = []
  const catalog = indexProducts(products)

  if (!String(username || '').trim()) {
    errors.push('Sign in with your Hive account to continue to checkout.')
  } else if (!isValidHiveAccountName(String(username).trim())) {
    errors.push('The signed-in Hive account name is not valid.')
  }
  if (list.length === 0) {
    errors.push('Your cart is empty.')
    return { ok: false, errors, lines }
  }

  for (const value of list) {
    const item = normalizeItem(value)
    if (!item) {
      errors.push('A cart item has an invalid Hive account or permlink.')
      continue
    }
    const key = cartItemKey(item)
    const product = catalog.get(key)
    if (!product) {
      errors.push('@' + key + ' could not be loaded from Hive.')
      continue
    }
    if (isMembershipProduct(product)) {
      errors.push('@' + key + ' is a Banksia Vault membership. Use the Subscribe page so your reader key can be attached.')
      continue
    }
    if (!isSupportedProduct(product)) {
      errors.push('@' + key + ' uses a currency Banksia does not support yet.')
      continue
    }
    if (product.status !== 1) {
      errors.push('@' + key + ' is ' + String(product.statusLabel || 'unavailable').toLowerCase() + '.')
      continue
    }
    const rawQuantity = Number(value.quantity)
    if (!product.subscription && (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > MAX_CART_QUANTITY)) {
      errors.push('Quantity for @' + key + ' must be between 1 and ' + MAX_CART_QUANTITY + '.')
      continue
    }
    const quantity = product.subscription ? 1 : clampQuantity(rawQuantity)
    lines.push({
      key,
      product,
      item: { author: item.author, permlink: item.permlink, quantity },
      quantity,
      totalLabel: productTotalLabel(product, quantity),
      memo: purchaseMemo(product.author, product.permlink, quantity),
      subscription: Boolean(product.subscription),
      recurrenceHours: Number(product.recurrenceHours) || 0
    })
  }

  return { ok: errors.length === 0, errors, lines }
}

function defaultStorage () {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Remember purchased product keys locally for the "You bought this" badge.
 * Pass a storage object (localStorage-like) in tests.
 */
export function recordPurchases (products, storage) {
  const store = storage || defaultStorage()
  if (!store) return []
  let existing = {}
  try {
    const raw = JSON.parse(store.getItem(PURCHASES_STORAGE_KEY) || '{}')
    if (Array.isArray(raw)) {
      existing = Object.fromEntries(raw.filter(key => typeof key === 'string').map(key => [key, true]))
    } else if (raw && typeof raw === 'object') {
      existing = { ...raw }
    }
  } catch {
    existing = {}
  }

  const now = new Date().toISOString()
  const keys = []
  for (const product of Array.isArray(products) ? products : [products]) {
    if (!product || !product.author || !product.permlink) continue
    const key = cartItemKey(product)
    existing[key] = now
    keys.push(key)
  }

  try {
    store.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(existing))
  } catch {
    // Private mode and quota failures leave the in-memory purchase list intact.
  }
  return keys
}

/** Format a per-currency total without ever adding HBD and HIVE together. */
export function totalsByTicker (lines) {
  const totals = new Map()
  for (const line of Array.isArray(lines) ? lines : []) {
    const product = line && (line.product || line)
    if (!product || !product.ticker) continue
    const quantity = line && line.quantity ? line.quantity : 1
    const amount = Number(product.price) * Math.max(1, Number(quantity) || 1)
    if (!Number.isFinite(amount)) continue
    totals.set(product.ticker, (totals.get(product.ticker) || 0) + amount)
  }
  return [...totals].map(([ticker, amount]) => ({
    ticker,
    label: formatProductAmount(amount, ticker)
  }))
}
