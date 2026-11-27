// Canonical paths for blog shop products.
//
// The shop route table mirrors blog posts: an owner product keeps the clean
// `/shop/<permlink>` URL, while a third-party seller is always explicit in
// `/shop/@<author>/<permlink>`. Parsing the inverse keeps both the listing page
// and the detail page on the same rules.

import { isValidHiveAccountName } from './blogHost'

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const SHOP_PATH = '/shop'

export function isProductPermlink (value) {
  return typeof value === 'string' && PERMLINK_RE.test(value.trim())
}

export function isProductAuthor (value) {
  return typeof value === 'string' && isValidHiveAccountName(value.trim().toLowerCase())
}

/**
 * Blog-relative path for a product detail page.
 *
 * @param {string} permlink
 * @param {string} author  Product author; defaults to the blog owner.
 * @param {string} owner   Blog owner account.
 */
export function blogProductPath (permlink, author = '', owner = '') {
  const value = String(permlink || '').trim()
  if (!PERMLINK_RE.test(value)) return SHOP_PATH
  const productAuthor = String(author || '').trim().toLowerCase()
  const blogOwner = String(owner || '').trim().toLowerCase()
  if (productAuthor && !isValidHiveAccountName(productAuthor)) return SHOP_PATH
  if (productAuthor && blogOwner && productAuthor !== blogOwner) {
    return SHOP_PATH + '/@' + productAuthor + '/' + value
  }
  return SHOP_PATH + '/' + value
}

/**
 * Resolve route params into the author/permlink pair to fetch.
 *
 * The owner route (`/shop/<permlink>`) uses the blog account. The author route
 * (`/shop/@<author>/<permlink>`) uses the explicit author. Returns null for
 * malformed input so the page can show a not-found state without a fetch.
 *
 * @returns {{ author: string, permlink: string }|null}
 */
export function parseProductRoute (params = {}, owner = '') {
  const permlink = typeof params.permlink === 'string' ? params.permlink.trim() : ''
  if (!PERMLINK_RE.test(permlink)) return null
  const explicitAuthor = typeof params.author === 'string' ? params.author.trim().toLowerCase() : ''
  const blogOwner = String(owner || '').trim().toLowerCase()
  if (explicitAuthor) {
    if (!isValidHiveAccountName(explicitAuthor)) return null
    return { author: explicitAuthor, permlink }
  }
  if (!isValidHiveAccountName(blogOwner)) return null
  return { author: blogOwner, permlink }
}
