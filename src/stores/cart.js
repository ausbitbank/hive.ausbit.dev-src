// Local shopping cart for the Hive Open Market shop.
//
// The cart is only a list of product references and quantities. It stores no
// prices, titles or seller data: those are re-read from Hive at checkout so a
// stale or tampered localStorage entry cannot change an amount. Persistence is
// best-effort, so private mode keeps the in-memory cart working.

import { defineStore } from 'pinia'
import { BLOG_MAX_CART_ITEMS } from 'src/config/blog'
import { isValidHiveAccountName } from 'src/services/blogHost'

export const CART_STORAGE_KEY = 'banksia:shop-cart'
export const MAX_CART_QUANTITY = 99

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/i

export function cartItemKey (item) {
  if (!item) return ''
  return String(item.author || '').toLowerCase() + '/' + String(item.permlink || '')
}

export function clampCartQuantity (value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) return 1
  return Math.min(MAX_CART_QUANTITY, Math.max(1, number))
}

function normalizeItem (value) {
  if (!value || typeof value !== 'object') return null
  const author = String(value.author || '').trim().toLowerCase()
  const permlink = String(value.permlink || '').trim()
  if (!isValidHiveAccountName(author) || !PERMLINK_RE.test(permlink)) return null
  return { author, permlink, quantity: clampCartQuantity(value.quantity) }
}

function defaultStorage () {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/**
 * Read the cart from storage. Tolerates `[]`, `{ items: [] }`, malformed JSON,
 * duplicate keys and out-of-range quantities, capping at the shop maximum.
 */
export function readCartItems (storage) {
  const store = storage || defaultStorage()
  if (!store) return []
  try {
    const raw = JSON.parse(store.getItem(CART_STORAGE_KEY) || 'null')
    const list = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray(raw.items) ? raw.items : [])
    const items = []
    const seen = new Set()
    for (const value of list) {
      const item = normalizeItem(value)
      if (!item) continue
      const key = cartItemKey(item)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
      if (items.length >= BLOG_MAX_CART_ITEMS) break
    }
    return items
  } catch {
    // Corrupt or unavailable storage must not stop the page rendering.
    return []
  }
}

export function persistCartItems (items, storage) {
  const store = storage || defaultStorage()
  if (!store) return
  try {
    if (!Array.isArray(items) || items.length === 0) {
      store.removeItem(CART_STORAGE_KEY)
      return
    }
    store.setItem(CART_STORAGE_KEY, JSON.stringify({ items }))
  } catch {
    // Ignore quota and private-mode failures; the in-memory cart still works.
  }
}

export const useCartStore = defineStore('shopCart', {
  state: () => ({
    items: readCartItems()
  }),
  getters: {
    count: state => state.items.reduce((total, item) => total + item.quantity, 0),
    lineCount: state => state.items.length,
    keys: state => state.items.map(item => cartItemKey(item)),
    isFull: state => state.items.length >= BLOG_MAX_CART_ITEMS
  },
  actions: {
    has (key) {
      const wanted = String(key || '')
      return this.items.some(item => cartItemKey(item) === wanted)
    },
    /**
     * Add one item or increase its quantity. Returns false when the item is
     * invalid or the 20-line cap is reached.
     */
    add (value) {
      const item = normalizeItem(value)
      if (!item) return false
      const key = cartItemKey(item)
      const existing = this.items.find(entry => cartItemKey(entry) === key)
      if (existing) {
        existing.quantity = clampCartQuantity(existing.quantity + item.quantity)
        persistCartItems(this.items)
        return true
      }
      if (this.items.length >= BLOG_MAX_CART_ITEMS) return false
      this.items.push(item)
      persistCartItems(this.items)
      return true
    },
    remove (key) {
      const wanted = String(key || '')
      const index = this.items.findIndex(item => cartItemKey(item) === wanted)
      if (index === -1) return false
      this.items.splice(index, 1)
      persistCartItems(this.items)
      return true
    },
    setQuantity (key, quantity) {
      const wanted = String(key || '')
      const item = this.items.find(entry => cartItemKey(entry) === wanted)
      if (!item) return false
      item.quantity = clampCartQuantity(quantity)
      persistCartItems(this.items)
      return true
    },
    clear () {
      this.items = []
      persistCartItems(this.items)
    },
    reload () {
      this.items = readCartItems()
    }
  }
})
