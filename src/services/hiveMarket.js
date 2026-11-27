// Hive Open Market data layer for the read-only blog shop.
//
// A product is a normal Hive post whose `json_metadata` says
// `content_type: "product"`. The chain post is the only source of truth for
// money: even when the market API supplies discovery candidates, its `price`
// field is a milli-ticker integer and is deliberately ignored. Every candidate
// is re-read from chain and normalised with `normalizeProduct` before display.
//
// Reads are paginated with an opaque cursor and never throw on a malformed
// post: bad products are skipped so one bad row cannot break a shop page.

import { blogPostImage } from './blogPosts'
import { fetchAccountPosts, fetchPostContent, fetchRankedPosts } from './chainData'
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

const SCHEMA_AVAILABILITY = {
  1: 'https://schema.org/InStock',
  2: 'https://schema.org/Discontinued',
  3: 'https://schema.org/OutOfStock'
}

/** Discovery only. Money from this endpoint is unverified and never displayed. */
const MARKET_API = 'https://market-api.hivehub.dev/products'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const CHAIN_PAGE_SIZE = 20
const MAX_CHAIN_PAGES = 10
const FEATURED_LIMIT = 20
const CURSOR_PREFIX = 'hm1.'

function clampLimit (value) {
  const count = Math.trunc(Number(value))
  if (!Number.isFinite(count) || count <= 0) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, count))
}

function normalizeAuthor (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function normalizeTag (value) {
  return String(value || '').trim().replace(/^#/, '').toLowerCase()
}

/** Dedupe key: Hive account names are case-insensitive; permlinks are matched
 * case-insensitively too so the same product cannot appear twice. */
function productKey (product) {
  return String(product.author).toLowerCase() + '/' + String(product.permlink).toLowerCase()
}

function productAllowed (product, includeInactive) {
  if (!product) return false
  return includeInactive ? true : product.status === 1
}

/** Cursors are opaque to callers. The encoding is an implementation detail. */
export function encodeCursor (value) {
  return CURSOR_PREFIX + encodeURIComponent(JSON.stringify(value))
}

export function decodeCursor (cursor) {
  if (typeof cursor !== 'string' || !cursor.startsWith(CURSOR_PREFIX)) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(cursor.slice(CURSOR_PREFIX.length)))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function formatProductAmount (value, ticker) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 1000) < 1) return ''
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
export function normalizeProduct (post) {
  if (!post || !post.author || !post.permlink) return null
  const meta = postMetadata(post)
  if (String(meta.content_type || '').toLowerCase() !== 'product') return null
  const currency = String(meta.currency || '').toUpperCase()
  const ticker = SUPPORTED[currency] || ''
  const price = Number(meta.price)
  const milli = Math.round(price * 1000)
  // HOM prices are positive assets with at most three decimals. Reject values
  // that would round to zero or overflow the transfer amount.
  if (!ticker || !Number.isFinite(price) || price <= 0 || price > 1e12 ||
    milli < 1 || Math.abs(price * 1000 - milli) > 1e-6) return null
  const statusValue = meta.status === undefined ? 1 : Number(meta.status)
  // HOM only defines 1/2/3. A malformed status must not be treated as active.
  if (!STATUS_LABELS[statusValue]) return null
  const status = statusValue
  const recurrenceHours = Number(meta.subscription_recurrence) || 0
  // The protocol requires at least 24 hours between recurring payments.
  const wantsSubscription = meta.subscription === 1 || meta.subscription === true ||
    String(meta.subscription) === '1'
  const subscription = wantsSubscription && recurrenceHours >= 24
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

/** Backwards-compatible name kept from the original blog shop module. */
export const parseProductMetadata = normalizeProduct

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

function parseFeaturedRef (value) {
  if (typeof value !== 'string') return null
  const match = value.trim().replace(/^@/, '').match(/^([^/\s]+)\/([^/\s]+)$/)
  if (!match) return null
  return { author: match[1].toLowerCase(), permlink: match[2] }
}

/**
 * Resolve curated `author/permlink` entries from chain. Invalid or missing
 * posts are skipped rather than failing the whole listing.
 */
async function resolveFeatured (featured, includeInactive) {
  const refs = []
  const seenRefs = new Set()
  for (const entry of (Array.isArray(featured) ? featured : []).slice(0, FEATURED_LIMIT)) {
    const ref = parseFeaturedRef(entry)
    if (!ref) continue
    const key = ref.author + '/' + ref.permlink.toLowerCase()
    if (seenRefs.has(key)) continue
    seenRefs.add(key)
    refs.push(ref)
  }
  if (refs.length === 0) return []

  const posts = await Promise.all(
    refs.map(ref => fetchPostContent(ref.author, ref.permlink).catch(() => null))
  )

  const products = []
  const seen = new Set()
  for (const post of posts) {
    const product = normalizeProduct(post)
    if (!productAllowed(product, includeInactive)) continue
    const key = productKey(product)
    if (seen.has(key)) continue
    seen.add(key)
    products.push(product)
  }
  return products
}

function chainParams ({ author, tag, start }) {
  const params = { limit: CHAIN_PAGE_SIZE }
  if (author) {
    params.sort = 'posts'
    params.account = author
    params.observer = ''
  } else {
    params.sort = 'created'
    if (tag) params.tag = tag
  }
  if (start && start.a && start.p) {
    params.start_author = start.a
    params.start_permlink = start.p
  }
  return params
}

/**
 * Walk bridge feed pages until `need` products are collected. The cursor
 * remembers the last raw post examined, not a product offset, so skipped
 * non-products and inactive rows are never re-read.
 */
async function collectChain ({ author, tag, start, need, includeInactive, seen }) {
  const items = []
  let cursor = start && start.a && start.p ? { a: start.a, p: start.p } : null
  let exhausted = false

  for (let page = 0; page < MAX_CHAIN_PAGES && items.length < need; page += 1) {
    let rows
    try {
      const params = chainParams({ author, tag, start: cursor })
      rows = author ? await fetchAccountPosts(params) : await fetchRankedPosts(params)
    } catch {
      rows = null
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      exhausted = true
      break
    }

    let advanced = false
    for (const row of rows) {
      if (!row || !row.author || !row.permlink) continue
      cursor = { a: String(row.author), p: String(row.permlink) }
      advanced = true

      const product = normalizeProduct(row)
      if (!productAllowed(product, includeInactive)) continue
      const key = productKey(product)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(product)
      if (items.length >= need) break
    }

    // A page of unusable rows would otherwise loop forever on the same cursor.
    if (!advanced) {
      exhausted = true
      break
    }
    if (rows.length < CHAIN_PAGE_SIZE) {
      exhausted = true
      break
    }
  }

  return {
    items,
    nextCursor: exhausted || !cursor ? null : encodeCursor({ ...cursor })
  }
}

/**
 * Ask the market API for discovery candidates only. The response is filtered
 * to author/permlink and any failure returns null so callers can fail open to
 * chain reads. The API `price` is milli-ticker and must not be trusted.
 */
async function fetchMarketCandidates (offset, count) {
  if (typeof fetch !== 'function') return null
  const url = MARKET_API +
    '?select=author,permlink&order=created.desc' +
    '&limit=' + Math.max(1, Math.min(MAX_LIMIT, count)) +
    '&offset=' + Math.max(0, offset)
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    if (!response || !response.ok) return null
    const rows = await response.json()
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

/** One API-discovery batch, resolving each candidate against its chain post. */
async function collectMarketApi ({ offset, need, includeInactive, seen }) {
  const batchSize = Math.min(MAX_LIMIT, Math.max(CHAIN_PAGE_SIZE, need * 2))
  const rows = await fetchMarketCandidates(offset, batchSize)
  if (rows === null) return null
  if (rows.length === 0) return { items: [], nextCursor: null }

  const posts = await Promise.all(rows.map(row => {
    if (!row || !row.author || !row.permlink) return null
    return fetchPostContent(row.author, row.permlink).catch(() => null)
  }))

  const items = []
  let consumed = 0
  for (let index = 0; index < rows.length && items.length < need; index += 1) {
    consumed = index + 1
    const product = normalizeProduct(posts[index])
    if (!productAllowed(product, includeInactive)) continue
    const key = productKey(product)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(product)
  }

  const more = rows.length === batchSize || consumed < rows.length
  return {
    items,
    nextCursor: more ? encodeCursor({ o: offset + consumed }) : null
  }
}

/**
 * List products for a shop page.
 *
 * - `author` pages an account's posts; `tag` pages the tag feed; neither pages
 *   the global market (API discovery, with a global created-feed fallback).
 * - `cursor` is opaque and must be passed back unchanged; `nextCursor` is null
 *   once the listing is exhausted.
 * - `featured` (`author/permlink` entries) is resolved from chain and
 *   prepended in order on the first page only.
 * - `includeInactive` defaults to false, which returns status 1 only.
 */
export async function listProducts ({
  author = '',
  tag = '',
  limit = DEFAULT_LIMIT,
  cursor = null,
  includeInactive = false,
  featured = []
} = {}) {
  const size = clampLimit(limit)
  const firstName = normalizeAuthor(author)
  const firstTag = normalizeTag(tag)
  const firstPage = !cursor
  const seen = new Set()
  const items = []

  if (firstPage) {
    for (const product of await resolveFeatured(featured, includeInactive)) {
      const key = productKey(product)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(product)
    }
  }

  const need = size - items.length
  if (need <= 0) return { items: items.slice(0, size), nextCursor: null }

  const decoded = firstPage ? null : decodeCursor(cursor)
  if (!firstPage && !decoded) return { items: [], nextCursor: null }

  let page
  if (firstName || firstTag) {
    page = await collectChain({
      author: firstName,
      tag: firstTag,
      start: decoded,
      need,
      includeInactive,
      seen
    })
  } else if (decoded && decoded.a && decoded.p) {
    // Continue a global chain-feed page that began after an API failure.
    page = await collectChain({
      start: decoded,
      need,
      includeInactive,
      seen
    })
  } else {
    page = await collectMarketApi({
      offset: decoded && Number.isFinite(Number(decoded.o)) ? Math.max(0, Number(decoded.o)) : 0,
      need,
      includeInactive,
      seen
    })
    if (!page) {
      page = await collectChain({
        start: null,
        need,
        includeInactive,
        seen
      })
    }
  }

  return {
    items: items.concat(page.items).slice(0, size),
    nextCursor: page.nextCursor
  }
}

/**
 * Read an account's recent posts and return product posts. Bridge caps a page
 * at 20 rows, so paginate a few pages rather than fetching one large page.
 */
export async function fetchAccountProducts (account, { max = 24, pages = 5 } = {}) {
  const name = normalizeAuthor(account)
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
      limit: CHAIN_PAGE_SIZE,
      start_author: startAuthor,
      start_permlink: startPermlink
    })
    if (!Array.isArray(rows) || rows.length === 0) break

    for (const row of rows) {
      const product = normalizeProduct(row)
      if (!product) continue
      const key = productKey(product)
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
