// Hive Open Market helpers for a blog shop.
//
// The protocol is deliberately simple: a product is a normal Hive post with
// `json_metadata.content_type = "product"`, a price/currency and a status. A
// purchase is a normal transfer (or recurrent transfer) whose memo is
// `{"product":"author/permlink","quantity":N}`. The blog only reads and
// displays; signing stays on banksia.io.

import { blogPostImage } from './blogPosts'
import { fetchAccountPosts } from './chainData'
import { postMetadata } from './posts'

const SUPPORTED = {
  'HIVE:HBD': 'HBD',
  'HIVE:HIVE': 'HIVE'
}

const STATUS_LABELS = {
  1: 'Available',
  2: 'Inactive',
  3: 'Out of stock'
}

export function formatProductAmount (value, ticker) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return amount.toFixed(3) + ' ' + String(ticker || '').toUpperCase()
}

/** Every safe https image advertised by a post, in order, deduplicated. */
export function productImages (post) {
  const meta = postMetadata(post)
  const values = Array.isArray(meta.image) ? meta.image : [meta.image]
  const seen = new Set()
  const images = []
  for (const value of values) {
    if (typeof value !== 'string' || !/^https:\/\//i.test(value.trim())) continue
    const url = value.trim()
    if (seen.has(url)) continue
    seen.add(url)
    images.push(url)
  }
  return images
}

/** Parse a Hive post into a product, or return null when it is not one. */
export function parseProductMetadata (post) {
  if (!post || !post.author || !post.permlink) return null
  const meta = postMetadata(post)
  if (String(meta.content_type || '').toLowerCase() !== 'product') return null
  const currency = String(meta.currency || '').toUpperCase()
  const ticker = SUPPORTED[currency] || ''
  const price = Number(meta.price)
  if (!ticker || !Number.isFinite(price) || price <= 0) return null
  const statusValue = Number(meta.status === undefined ? 1 : meta.status)
  const status = STATUS_LABELS[statusValue] ? statusValue : 1
  const recurrenceHours = Number(meta.subscription_recurrence) || 0
  const subscription = Number(meta.subscription) === 1 && recurrenceHours > 0
  const tags = Array.isArray(meta.tags)
    ? meta.tags.filter(tag => typeof tag === 'string' && tag.trim()).slice(0, 6)
    : []
  const images = productImages(post)
  return {
    author: String(post.author).toLowerCase(),
    permlink: String(post.permlink),
    title: String(post.title || post.permlink),
    body: String(post.body || ''),
    created: post.created || '',
    image: blogPostImage(post) || images[0] || '',
    images,
    currency,
    ticker,
    price,
    priceLabel: formatProductAmount(price, ticker),
    status,
    statusLabel: STATUS_LABELS[status],
    subscription,
    recurrenceHours,
    tags,
    post
  }
}

export function productTotalLabel (product, quantity = 1) {
  if (!product) return ''
  return formatProductAmount(product.price * Math.max(1, Number(quantity) || 1), product.ticker)
}

export function purchaseMemo (author, permlink, quantity = 1) {
  return JSON.stringify({
    product: String(author).toLowerCase() + '/' + String(permlink),
    quantity: Math.max(1, Number(quantity) || 1)
  })
}

export function isSupportedProduct (product) {
  return Boolean(product && SUPPORTED[product.currency])
}

export function isPurchasable (product) {
  return Boolean(product && isSupportedProduct(product) && product.status === 1)
}

const SCHEMA_AVAILABILITY = {
  1: 'https://schema.org/InStock',
  2: 'https://schema.org/Discontinued',
  3: 'https://schema.org/OutOfStock'
}

/**
 * schema.org Product/Offer for a Hive Open Market product.
 *
 * `priceCurrency` is the Hive ticker (`HBD` or `HIVE`). HBD is not an ISO 4217
 * currency, so there is no honest ISO code to substitute: schema.org accepts a
 * text currency, and we document the mapping instead of faking `USD`. Google's
 * rich-result validator may therefore decline the offer; the JSON-LD still
 * describes the product correctly for other consumers.
 */
export function productJsonLd (product, url) {
  if (!product) return null
  const productUrl = String(url || '')
  const images = product.images && product.images.length
    ? product.images
    : (product.image ? [product.image] : [])
  const description = String(product.body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    sku: product.author + '/' + product.permlink,
    url: productUrl || undefined,
    image: images.length ? images : undefined,
    offers: {
      '@type': 'Offer',
      url: productUrl || undefined,
      price: Number(product.price).toFixed(3),
      priceCurrency: product.ticker,
      availability: SCHEMA_AVAILABILITY[product.status] || 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: '@' + product.author,
        url: 'https://banksia.io/@' + product.author
      }
    }
  }
}

/**
 * Read the account's recent posts and return product posts. Bridge caps a page
 * at 20 rows, so paginate a few pages rather than fetching one large page.
 */
export async function fetchAccountProducts (account, { max = 24, pages = 5 } = {}) {
  const name = String(account || '').trim().toLowerCase()
  if (!name) return []
  const products = []
  const seen = new Set()
  let startAuthor = null
  let startPermlink = null

  for (let page = 0; page < pages; page += 1) {
    const rows = await fetchAccountPosts({
      sort: 'posts',
      account: name,
      observer: '',
      limit: 20,
      start_author: startAuthor,
      start_permlink: startPermlink
    })
    if (!Array.isArray(rows) || rows.length === 0) break

    for (const row of rows) {
      const product = parseProductMetadata(row)
      if (!product) continue
      const key = product.author + '/' + product.permlink
      if (seen.has(key)) continue
      seen.add(key)
      products.push(product)
      if (products.length >= max) return products
    }

    const last = rows[rows.length - 1]
    startAuthor = last.author
    startPermlink = last.permlink
  }

  return products
}
