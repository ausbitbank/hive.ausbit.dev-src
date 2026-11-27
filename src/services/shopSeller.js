// Public seller signals for the shop.
//
// These helpers use only the Hive account object and the product post already
// loaded by the product page. They do not call a reputation service, score
// buyers, or claim buyer protection. The panel is context, not a guarantee.

import { formatBlogDate } from './blogPosts'

function parseTime (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

/** Hive's raw reputation integer -> the familiar display score. */
export function hiveReputation (raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  if (value === 0) return 25
  const sign = value < 0 ? -1 : 1
  const magnitude = Math.log10(Math.abs(value))
  return Math.round((sign * (magnitude - 9) * 9 + 25) * 10) / 10
}

/** Whole days since an account was created; null when the date is unusable. */
export function sellerAgeDays (created, now = Date.now()) {
  const time = parseTime(created)
  const current = Number(now)
  if (!time || !Number.isFinite(current) || current < time) return null
  return Math.floor((current - time) / (24 * 60 * 60 * 1000))
}

export function sellerAgeLabel (days) {
  const count = Number(days)
  if (!Number.isFinite(count) || count < 0) return ''
  if (count < 1) return 'joined today'
  if (count < 30) return count + (count === 1 ? ' day' : ' days')
  if (count < 365) {
    const months = Math.max(1, Math.round(count / 30))
    return months + (months === 1 ? ' month' : ' months')
  }
  const years = Math.round((count / 365) * 10) / 10
  return years + (years === 1 ? ' year' : ' years')
}

/** The last update timestamp the chain exposes, preferring `last_update`. */
export function productLastUpdate (product) {
  const post = product && product.post ? product.post : {}
  return String(post.last_update || post.updated || post.lastUpdate || '')
}

/**
 * Build the display model for a seller card.
 *
 * @returns {object|null} null when no account was loaded.
 */
export function buildSellerTrust (account, { product = null, now = Date.now() } = {}) {
  if (!account) return null
  const created = String(account.created || '')
  const days = sellerAgeDays(created, now)
  const reputation = hiveReputation(account.reputation)
  const postCount = Number(account.post_count)
  const lastUpdate = productLastUpdate(product)
  const lastUpdateTime = parseTime(lastUpdate)
  const createdTime = parseTime(product && product.created)
  const edited = Boolean(lastUpdateTime && createdTime && lastUpdateTime - createdTime > 60 * 1000)
  return {
    name: String(account.name || ''),
    joined: created,
    joinedLabel: formatBlogDate(created),
    ageDays: days,
    ageLabel: sellerAgeLabel(days),
    reputation,
    reputationLabel: reputation === null ? '' : reputation.toFixed(1),
    postCount: Number.isFinite(postCount) && postCount >= 0 ? Math.trunc(postCount) : null,
    lastUpdate: edited ? lastUpdate : '',
    lastUpdateLabel: edited ? formatBlogDate(lastUpdate) : '',
    edited
  }
}
