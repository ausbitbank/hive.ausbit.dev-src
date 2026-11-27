// Hive Open Market product for a Banksia Vault membership.
//
// The product post is a normal top-level Hive post with HOM `json_metadata`, so
// the existing shop and `/pay` flow can discover and pay for it. It is also the
// ONLY source of truth for the amount, currency and recurrence: `blog.vault.price`
// is a display hint and must never be used to build a payment.
//
// A small `banksia_vault_product` extension lets the reader find the hidden
// grant container and the plan id without a second lookup. Ordinary HOM
// subscription products tagged `membership` or `vault` are accepted too, so a
// creator can enable Vault against a product published by another HOM client.

import {
  VAULT_ALLOWED_ARCHIVE,
  VAULT_DEFAULT_CONTAINER,
  VAULT_DEFAULT_EXECUTIONS,
  VAULT_DEFAULT_PRODUCT_PERMLINK,
  VAULT_DEFAULT_RECURRENCE
} from '../config/blog'
import { isValidHiveAccountName } from './blogHost'
import { formatVaultPrice, vaultPriceValue, vaultProductRef } from './vaultSettings'

export const VAULT_PRODUCT_CONTENT_TYPE = 'product'

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const PLAN_RE = /^[a-z][a-z0-9_-]{0,31}$/
const STATUSES = [1, 2, 3]
const CATEGORY = 'membership'
const PRODUCT_TAGS = ['membership', 'vault']
const MAX_BODY = 4000

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function normalizeAccount (value) {
  const raw = typeof value === 'string' ? value : String(value && value.name || '')
  return raw.trim().replace(/^@/, '').toLowerCase()
}

function cleanPlan (value, fallback = 'member') {
  if (typeof value !== 'string') return fallback
  const plan = value.trim().toLowerCase()
  return PLAN_RE.test(plan) ? plan : fallback
}

function cleanPermlink (value, fallback) {
  if (typeof value !== 'string') return fallback
  const slug = value.trim().toLowerCase()
  return PERMLINK_RE.test(slug) ? slug : fallback
}

function cleanRecurrence (value) {
  const hours = Number(value)
  if (!Number.isInteger(hours) || hours < 24 || hours > 8760) return VAULT_DEFAULT_RECURRENCE
  return hours
}

function cleanExecutions (value) {
  return Number.isInteger(value) && value >= 2 && value <= 120
    ? value
    : VAULT_DEFAULT_EXECUTIONS
}

function cleanArchive (value) {
  return VAULT_ALLOWED_ARCHIVE.includes(value) ? value : 'all'
}

function effectivePost (value) {
  if (isPlainObject(value) && isPlainObject(value.post)) return value.post
  return isPlainObject(value) ? value : {}
}

/** Unwrap `json_metadata` (string or object) from a post, or accept metadata. */
function metadataOf (value) {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return isPlainObject(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  if (!isPlainObject(value)) return null
  if (isPlainObject(value.post) && value.post.json_metadata !== undefined) {
    return metadataOf(value.post)
  }
  if (value.json_metadata !== undefined) {
    const meta = value.json_metadata
    if (typeof meta === 'string') {
      try {
        const parsed = JSON.parse(meta)
        return isPlainObject(parsed) ? parsed : null
      } catch {
        return null
      }
    }
    return isPlainObject(meta) ? meta : null
  }
  return value
}

function tagList (value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const tags = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const tag = item.trim()
    if (!tag || tag.startsWith('hive-') || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= 6) break
  }
  return tags
}

function hasSubscription (value) {
  return value === 1 || value === true || String(value) === '1'
}

/**
 * Standard HOM product metadata for the membership product.
 *
 * @param {object} settings Normalised `blog.vault` settings.
 * @param {{ plan?: string }} [options]
 * @returns {object|null} null when the price is missing or invalid.
 */
export function buildVaultProductMetadata (settings, { plan = 'member' } = {}) {
  const price = vaultPriceValue(settings && settings.price)
  if (price === null || price <= 0) return null
  const recurrence = cleanRecurrence(settings && settings.recurrence)
  return {
    content_type: VAULT_PRODUCT_CONTENT_TYPE,
    version: 0.1,
    currency: 'HIVE:HBD',
    price,
    subscription: 1,
    subscription_recurrence: recurrence,
    status: 1,
    tags: [...PRODUCT_TAGS],
    banksia_vault_product: {
      v: 1,
      plan: cleanPlan(plan),
      container: cleanPermlink(settings && settings.container, VAULT_DEFAULT_CONTAINER),
      archive: cleanArchive(settings && settings.archive)
    }
  }
}

/**
 * Markdown body for the membership product post.
 *
 * The body is human-facing copy. It explains the price, the renewal, how to
 * cancel and that payment is direct with no escrow or platform balance. It is
 * capped well below the Hive comment limit.
 */
export function buildVaultProductBody (settings, { account = null } = {}) {
  const owner = normalizeAccount(account)
  const validOwner = isValidHiveAccountName(owner)
  const product = vaultProductRef(settings) ||
    (validOwner ? owner + '/' + VAULT_DEFAULT_PRODUCT_PERMLINK : '')
  const price = formatVaultPrice(settings && settings.price) || '5.000 HBD'
  const executions = cleanExecutions(settings && settings.executions)
  const container = cleanPermlink(settings && settings.container, VAULT_DEFAULT_CONTAINER)
  const mention = validOwner ? '@' + owner : 'the creator'

  const body = [
    '# Membership',
    '',
    'Support ' + mention + ' and read every members-only post on this blog.',
    '',
    '**Price:** ' + price + ' per month',
    '**Billing:** ' + executions + ' monthly payments, then it stops automatically.',
    '**Cancel:** cancel any time; access lasts until the paid period ends.',
    '',
    '## What is included',
    '',
    '- Every members-only post published while your membership is active',
    '- The full members-only archive, including posts from before you joined',
    '- Text-only content in this first release (encrypted media is not promised)',
    '',
    '## How payment works',
    '',
    'This is a direct Hive payment to ' + mention + '. There is no escrow, no',
    'platform balance and Banksia takes no cut. The product is a standard Hive',
    'Open Market product, so other HOM-aware frontends can recognise it.',
    '',
    '## How to cancel',
    '',
    'Open your Hive wallet, find the recurring payment for this product and',
    'cancel it. You keep access until the current month ends. Do not send a',
    'second payment to cancel.',
    '',
    product ? 'Product: `' + product + '`' : '',
    'Container: `' + container + '`'
  ].join('\n')

  return body.slice(0, MAX_BODY)
}

/**
 * `comment` operation that publishes the membership product.
 *
 * @returns {[string, object]|null}
 */
export function buildVaultProductOperation ({
  account,
  settings,
  permlink = VAULT_DEFAULT_PRODUCT_PERMLINK,
  title,
  plan = 'member'
} = {}) {
  const owner = normalizeAccount(account)
  if (!isValidHiveAccountName(owner)) return null
  const slug = cleanPermlink(permlink, '')
  if (!slug) return null
  const metadata = buildVaultProductMetadata(settings, { plan })
  if (!metadata) return null
  const body = buildVaultProductBody(settings, { account: owner })
  return ['comment', {
    parent_author: '',
    parent_permlink: CATEGORY,
    author: owner,
    permlink: slug,
    title: typeof title === 'string' && title.trim()
      ? title.trim()
      : 'Membership — @' + owner,
    body,
    json_metadata: JSON.stringify({
      ...metadata,
      app: 'banksia.io',
      format: 'markdown',
      tags: [...metadata.tags]
    })
  }]
}

/**
 * `comment` operation that publishes the hidden grant container.
 *
 * The container is a normal top-level post with no archive-facing content. The
 * reader filter excludes it (and the product post) from the blog archive; it
 * stays fetchable by permlink for bulletins.
 *
 * @returns {[string, object]|null}
 */
export function buildVaultContainerOperation ({
  account,
  container = VAULT_DEFAULT_CONTAINER,
  parentAuthor = '',
  parentPermlink = ''
} = {}) {
  const owner = normalizeAccount(account)
  if (!isValidHiveAccountName(owner)) return null
  const slug = cleanPermlink(container, '')
  if (!slug) return null
  const parent = normalizeAccount(parentAuthor)
  const parentSlug = cleanPermlink(parentPermlink, '')
  const isReply = Boolean(parent && parentSlug)
  return ['comment', {
    parent_author: isReply ? parent : '',
    parent_permlink: isReply ? parentSlug : CATEGORY,
    author: owner,
    permlink: slug,
    title: isReply ? '' : 'Membership grant container',
    body: 'Membership grant container. Do not reply here.',
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      format: 'markdown',
      tags: [CATEGORY],
      banksia_vault_container: true
    })
  }]
}

/**
 * Parse a post (or just its metadata) as a Vault membership product.
 *
 * Accepts the Banksia extension or an ordinary HOM subscription product tagged
 * `membership`/`vault`. Rejects non-products, non-HBD currencies, non-positive
 * prices, products without a subscription of at least 24 hours and unknown
 * statuses.
 *
 * @returns {object|null}
 */
export function parseVaultProduct (postOrMetadata) {
  const meta = metadataOf(postOrMetadata)
  if (!meta) return null
  if (String(meta.content_type || '').toLowerCase() !== VAULT_PRODUCT_CONTENT_TYPE) return null
  if (String(meta.currency || '').toUpperCase() !== 'HIVE:HBD') return null
  const price = Number(meta.price)
  if (!Number.isFinite(price) || price <= 0) return null
  const status = meta.status === undefined ? 1 : Number(meta.status)
  if (!STATUSES.includes(status)) return null
  const recurrenceHours = Number(meta.subscription_recurrence)
  if (!hasSubscription(meta.subscription) || !Number.isFinite(recurrenceHours) || recurrenceHours < 24) {
    return null
  }

  const tags = tagList(meta.tags)
  const extension = meta.banksia_vault_product
  if (extension !== undefined && extension !== null && !isPlainObject(extension)) return null

  let vaultMarked = false
  let plan = 'member'
  let container = VAULT_DEFAULT_CONTAINER
  let archive = 'all'
  let executions = VAULT_DEFAULT_EXECUTIONS
  if (isPlainObject(extension)) {
    if (extension.v !== undefined && extension.v !== 1) return null
    vaultMarked = true
    plan = cleanPlan(extension.plan)
    container = cleanPermlink(extension.container, VAULT_DEFAULT_CONTAINER)
    archive = cleanArchive(extension.archive)
    executions = cleanExecutions(extension.executions)
  }
  if (!vaultMarked) {
    const marked = tags.some(tag => PRODUCT_TAGS.includes(tag.toLowerCase()))
    if (!marked) return null
  }

  const post = effectivePost(postOrMetadata)
  const author = normalizeAccount(post.author)
  const permlink = typeof post.permlink === 'string' ? post.permlink.trim() : ''
  const title = typeof post.title === 'string' && post.title.trim()
    ? post.title.trim()
    : permlink
  const priceLabel = formatVaultPrice(price) || Number(price).toFixed(3) + ' HBD'

  return {
    author,
    permlink,
    title,
    price,
    priceLabel,
    currency: 'HIVE:HBD',
    amount: priceLabel,
    subscription: true,
    recurrenceHours: Math.trunc(recurrenceHours),
    executions,
    plan,
    container,
    archive,
    status,
    tags
  }
}

/** True when the post is a Vault membership product (Banksia or HOM-tagged). */
export function isVaultProduct (post) {
  return Boolean(parseVaultProduct(post))
}

/** True for the hidden grant container post. */
export function isVaultContainer (post) {
  const meta = metadataOf(post)
  return Boolean(meta && meta.banksia_vault_container === true)
}

/** Canonical shop path for the product, or '' for malformed input. */
export function vaultProductPath (author, permlink) {
  const owner = normalizeAccount(author)
  const slug = cleanPermlink(permlink, '')
  if (!isValidHiveAccountName(owner) || !slug) return ''
  return '/shop/@' + owner + '/' + slug
}

/**
 * Derive the payment plan from chain data. This is the only place a Vault
 * amount should come from; `blog.vault.price` is never consulted.
 *
 * `fallback` may carry local-only preferences such as `executions`, `plan`,
 * `container`, `archive` or `title`; amount, currency and recurrence always come
 * from the product post.
 *
 * @returns {object|null}
 */
export function deriveVaultPlan (post, { fallback = {} } = {}) {
  const product = parseVaultProduct(post)
  if (!product) return null
  const local = isPlainObject(fallback) ? fallback : {}
  const plan = cleanPlan(local.plan, product.plan)
  const container = cleanPermlink(local.container, product.container)
  const archive = VAULT_ALLOWED_ARCHIVE.includes(local.archive) ? local.archive : product.archive
  return {
    author: product.author,
    permlink: product.permlink,
    product: product.author + '/' + product.permlink,
    price: product.price,
    priceLabel: product.priceLabel,
    currency: 'HBD',
    amount: product.priceLabel,
    recurrence: product.recurrenceHours,
    executions: cleanExecutions(local.executions === undefined ? product.executions : local.executions),
    plan,
    container,
    archive,
    title: product.title || String(local.title || '')
  }
}
