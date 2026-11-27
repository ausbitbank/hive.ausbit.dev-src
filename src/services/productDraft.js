// Hive Open Market authoring helpers.
//
// A product is a normal Hive post whose `json_metadata` carries the Hive Open
// Market keys below. The title and description stay in the normal post title
// and body; only the commercial fields live in metadata. Everything here is
// pure so the composer, the publish builder and the tests share one contract.

import { sanitizeTag } from '../utils/hiveTag'

export const PRODUCT_CONTENT_TYPE = 'product'
export const PRODUCT_VERSION = 0.1
export const PRODUCT_CURRENCIES = ['HIVE:HBD', 'HIVE:HIVE']
export const PRODUCT_MAX_TAGS = 6
export const PRODUCT_MAX_IMAGES = 20
export const PRODUCT_DESCRIPTION_MAX = 2000
export const PRODUCT_MIN_RECURRENCE_HOURS = 24
export const PRODUCT_DEFAULT_RECURRENCE_HOURS = 730
export const PRODUCT_PRICE_MAX_DECIMALS = 3
export const PRODUCT_DEFAULT_CURRENCY = 'HIVE:HBD'

export const PRODUCT_STATUS_LABELS = {
  1: 'Available',
  2: 'Inactive',
  3: 'Out of stock'
}

/** Core keys this panel owns in json_metadata. Tags/image are managed too. */
export const PRODUCT_METADATA_KEYS = [
  'content_type',
  'version',
  'currency',
  'price',
  'subscription',
  'subscription_recurrence',
  'status'
]

const PRICE_RE = /^\d+(?:\.\d{1,3})?$/

function hasControlChars (value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

function cleanString (value, maxLength = 1000) {
  if (value === null || value === undefined) return ''
  return String(value).slice(0, maxLength)
}

function tagSource (value) {
  if (Array.isArray(value)) return value
  return String(value || '').split(/[,\s]+/)
}

/** Comma/array input -> unique, sanitised product tags capped at six. */
export function normalizeProductTags (value) {
  const seen = new Set()
  const tags = []
  for (const item of tagSource(value)) {
    const tag = sanitizeTag(cleanString(item, 60))
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= PRODUCT_MAX_TAGS) break
  }
  return tags
}

function isHttpsImage (value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!/^https:\/\//i.test(text)) return false
  try {
    return new URL(text).protocol === 'https:'
  } catch {
    return false
  }
}

/** Keep only https image URLs, in order and deduplicated. */
export function normalizeProductImages (value) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : [])
  const seen = new Set()
  const images = []
  for (const item of list) {
    if (!isHttpsImage(item)) continue
    const url = item.trim()
    if (seen.has(url)) continue
    seen.add(url)
    images.push(url)
    if (images.length >= PRODUCT_MAX_IMAGES) break
  }
  return images
}

export function defaultProductFields () {
  return {
    enabled: false,
    price: '',
    currency: PRODUCT_DEFAULT_CURRENCY,
    subscription: false,
    recurrenceHours: PRODUCT_DEFAULT_RECURRENCE_HOURS,
    status: 1,
    tags: [],
    image: []
  }
}

function rawPrice (value) {
  return cleanString(value, 40).trim()
}

function rawRecurrenceHours (source) {
  const value = source.recurrenceHours ?? source.subscription_recurrence
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) return PRODUCT_DEFAULT_RECURRENCE_HOURS
  return Math.round(hours)
}

/**
 * Coerce stored/imported product fields into the shape the composer edits.
 * Unknown fields are dropped. Invalid enum values fall back to safe defaults;
 * `validateProductFields` is what reports them to the writer.
 */
export function normalizeProductFields (raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const currency = cleanString(source.currency, 20).trim().toUpperCase()
  const status = Number(source.status)
  return {
    enabled: source.enabled === true,
    price: rawPrice(source.price),
    currency: PRODUCT_CURRENCIES.includes(currency) ? currency : PRODUCT_DEFAULT_CURRENCY,
    subscription: source.subscription === true || Number(source.subscription) === 1,
    recurrenceHours: rawRecurrenceHours(source),
    status: PRODUCT_STATUS_LABELS[status] ? status : 1,
    tags: normalizeProductTags(source.tags),
    image: normalizeProductImages(source.image)
  }
}

/** Read HOM fields from a published post's json_metadata. */
export function readProductFieldsFromMetadata (metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {}
  if (String(source.content_type || '').toLowerCase() !== PRODUCT_CONTENT_TYPE) {
    return defaultProductFields()
  }
  return normalizeProductFields({
    enabled: true,
    price: source.price,
    currency: source.currency,
    subscription: Number(source.subscription) === 1,
    recurrenceHours: source.subscription_recurrence,
    status: source.status,
    tags: source.tags,
    image: source.image
  })
}

/** True when the panel is on and the post should publish as a product. */
export function hasProductFields (fields) {
  return normalizeProductFields(fields).enabled
}

/**
 * Product metadata to merge into a post's json_metadata. Returns an empty
 * object when product mode is off. The post title/body stay on the operation.
 */
export function buildProductMetadata (fields) {
  const value = normalizeProductFields(fields)
  if (!value.enabled) return {}

  const amount = Number(value.price)
  const price = Number.isFinite(amount) && amount > 0
    ? Number(amount.toFixed(PRODUCT_PRICE_MAX_DECIMALS))
    : 0
  const metadata = {
    content_type: PRODUCT_CONTENT_TYPE,
    version: PRODUCT_VERSION,
    currency: value.currency,
    price,
    subscription: value.subscription ? 1 : 0,
    subscription_recurrence: value.subscription ? value.recurrenceHours : 0,
    status: value.status
  }
  if (value.tags.length) metadata.tags = value.tags
  if (value.image.length) metadata.image = value.image
  return metadata
}

function countRawTags (value) {
  const seen = new Set()
  for (const item of tagSource(value)) {
    const tag = sanitizeTag(cleanString(item, 60))
    if (tag) seen.add(tag)
  }
  return seen.size
}

function hasUnsafeImage (value) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : [])
  return list.some(item => typeof item === 'string' && item.trim() && !isHttpsImage(item))
}

/**
 * Validate product fields for the publish checklist. `title` and
 * `description` come from the normal post fields; when omitted the same-named
 * fields on the product object are used (useful for a standalone preview).
 */
export function validateProductFields (fields, { title = null, description = null } = {}) {
  const source = fields && typeof fields === 'object' ? fields : {}
  const value = normalizeProductFields(source)
  const errors = []
  const warnings = []
  if (!value.enabled) {
    return { ok: true, errors, warnings, value }
  }

  const productTitle = String(title ?? source.title ?? '').trim()
  if (!productTitle) {
    errors.push('Add a product title in the post title field.')
  } else if (productTitle.length > 255) {
    errors.push('Product titles are limited to 255 characters.')
  } else if (hasControlChars(productTitle)) {
    errors.push('The product title contains control characters.')
  } else if (productTitle.length > 120) {
    warnings.push('Long product titles are truncated on shop cards.')
  }

  const productDescription = String(description ?? source.description ?? '').trim()
  if (!productDescription) {
    errors.push('Write a product description in the post body before publishing.')
  } else if (productDescription.length > PRODUCT_DESCRIPTION_MAX) {
    warnings.push('Keep the product description under about ' + PRODUCT_DESCRIPTION_MAX + ' characters; the rest becomes body text.')
  }

  const priceText = rawPrice(source.price)
  if (!priceText) {
    errors.push('Enter a product price.')
  } else {
    const amount = Number(priceText)
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push('The product price must be greater than zero.')
    } else if (!PRICE_RE.test(priceText)) {
      errors.push('Use a plain price with at most 3 decimal places, such as 0.001.')
    } else {
      value.price = amount.toFixed(PRODUCT_PRICE_MAX_DECIMALS)
    }
  }

  const currency = cleanString(source.currency, 20).trim().toUpperCase()
  if (!PRODUCT_CURRENCIES.includes(currency)) {
    errors.push('Choose HBD or HIVE as the product currency.')
  }

  if (value.subscription) {
    const hours = Number(source.recurrenceHours ?? source.subscription_recurrence)
    if (!Number.isInteger(hours) || hours < PRODUCT_MIN_RECURRENCE_HOURS) {
      errors.push('Recurring products need a whole number of hours, at least ' + PRODUCT_MIN_RECURRENCE_HOURS + '.')
    } else {
      value.recurrenceHours = hours
    }
  }

  const status = Number(source.status)
  if (!PRODUCT_STATUS_LABELS[status]) {
    errors.push('Choose a product status: Available, Inactive or Out of stock.')
  }

  if (countRawTags(source.tags) > PRODUCT_MAX_TAGS) {
    errors.push('Use at most ' + PRODUCT_MAX_TAGS + ' product tags.')
  }
  if (hasUnsafeImage(source.image)) {
    errors.push('Product images must use https:// URLs.')
  }

  return { ok: errors.length === 0, errors, warnings, value }
}

/** Content for the shop-style preview card in the composer. */
export function productPreview (fields) {
  const source = fields && typeof fields === 'object' ? fields : {}
  const value = normalizeProductFields(source)
  const ticker = String(value.currency || '').split(':')[1] || ''
  const amount = Number(value.price)
  const priceLabel = Number.isFinite(amount) && amount > 0
    ? amount.toFixed(PRODUCT_PRICE_MAX_DECIMALS) + ' ' + ticker
    : ''
  return {
    title: String(source.title || '').trim(),
    priceLabel,
    currency: value.currency,
    subscription: value.subscription,
    recurrenceHours: value.recurrenceHours,
    statusLabel: PRODUCT_STATUS_LABELS[value.status] || PRODUCT_STATUS_LABELS[1],
    tags: value.tags,
    image: value.image[0] || ''
  }
}
