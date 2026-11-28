// Presentation helpers for the blog reading surface.
//
// These are deliberately separate from `posts.js` (which is shared with the
// explorer) so the blog can make editorial choices about covers, excerpts and
// ordering without changing browse cards.

import { stripHtml } from '../utils/safeHtml'
import { firstMarkdownImageUrl, stripMarkdownImages, stripMarkdownLinks } from '../utils/media'
import { blogPostPathFor as hostBlogPostPathFor } from './blogHost'
import { isVaultContainer } from './vaultProduct'
import {
  postCommentCount,
  postDisplayTitle,
  postMetadata,
  postPayoutLabel,
  postPayoutValue,
  postTags,
  postVotes
} from './posts'

function rawMetadata (post) {
  const value = post && post.json_metadata
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * True for Vault plumbing that must never appear in an archive or feed: the
 * hidden grant container and the HOM membership product.
 */
export function isVaultHiddenPost (post) {
  if (!post || typeof post !== 'object') return false
  if (isVaultContainer(post)) return true
  const metadata = rawMetadata(post)
  return String(metadata.content_type || '').toLowerCase() === 'product'
}

/** True for a top-level post (not a comment or a reply, not Vault plumbing). */
export function isBlogPost (post) {
  if (!post || !post.permlink || !post.author) return false
  if (post.parent_author) return false
  if (Number(post.depth || 0) !== 0) return false
  return !isVaultHiddenPost(post)
}

/** A safe https cover image for a post, or ''. */
export function blogPostImage (post) {
  if (!post) return ''
  const thumbnail = typeof post.thumbnail === 'string' ? post.thumbnail.trim() : ''
  if (/^https:\/\//i.test(thumbnail)) return thumbnail
  const images = postMetadata(post).image
  const list = Array.isArray(images) ? images : [images]
  for (const value of list) {
    if (typeof value === 'string' && /^https:\/\//i.test(value.trim())) return value.trim()
  }
  // Many Hive posts carry their hero image in the body but not in
  // json_metadata. Use the first inline image as a card cover so the archive
  // stays visual without a second API call.
  const body = typeof post.body === 'string' ? post.body : ''
  const markdown = firstMarkdownImageUrl(body)
  if (markdown && /^https:\/\//i.test(markdown)) return markdown
  const html = body.match(/<img\b[^>]*src=["'](https:\/\/[^"']+)["']/i)
  if (html) return html[1].replaceAll('&amp;', '&')
  return ''
}

export function blogPostTitle (post) {
  return postDisplayTitle(post)
}

/** Remove common Markdown syntax so card excerpts read as prose, not source. */
function stripMarkdown (value) {
  return stripMarkdownLinks(stripMarkdownImages(String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function blogPostExcerpt (post, maxLength = 200) {
  const text = stripMarkdown(stripHtml(post && post.body))
  if (text.length <= maxLength) return text
  const clipped = text.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  return clipped.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : clipped.length).trimEnd() + '…'
}

export function blogPostReadingMinutes (post) {
  const text = stripMarkdown(stripHtml(post && post.body))
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0
  return Math.max(1, Math.round(words / 220))
}

/**
 * True when the body already carries a visual. The post header uses this to
 * avoid repeating the lead image: Hive posts commonly put the same image in the
 * body that `json_metadata.image` promotes to a cover.
 */
export function blogPostHasBodyImage (post) {
  const body = String((post && post.body) || '')
  if (!body) return false
  if (firstMarkdownImageUrl(body)) return true
  if (/<img\b[^>]*src=/i.test(body)) return true
  if (/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s"'<>]*)?/i.test(body)) return true
  return false
}

export function blogPostTags (post, limit = 3) {
  return postTags(post, limit)
}

export function blogPostDate (post) {
  return (post && (post.created || post.last_update)) || ''
}

/** Format a chain timestamp for a reading surface; '' when absent/invalid. */
export function formatBlogDate (value, { locale = 'en' } = {}) {
  if (!value) return ''
  const date = new Date(/Z$/.test(value) ? value : value + 'Z')
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Remove duplicate author/permlink rows while keeping the first occurrence. */
export function dedupePosts (posts) {
  const seen = new Set()
  const out = []
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!post || !post.author || !post.permlink) continue
    const key = String(post.author).toLowerCase() + '/' + String(post.permlink).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(post)
  }
  return out
}

/**
 * Pinned posts first (in the author's chosen order), then newest first.
 * A pinned permlink that no longer exists is simply absent.
 */
export function sortBlogPosts (posts, pinned = []) {
  const unique = dedupePosts(posts)
  const pinnedOrder = new Map()
  ;(Array.isArray(pinned) ? pinned : []).forEach((permlink, index) => {
    const key = String(permlink || '').toLowerCase()
    if (key && !pinnedOrder.has(key)) pinnedOrder.set(key, index)
  })

  const pinRank = (post) => {
    const key = String(post.permlink || '').toLowerCase()
    return pinnedOrder.has(key) ? pinnedOrder.get(key) : Number.MAX_SAFE_INTEGER
  }
  const time = (post) => {
    const parsed = Date.parse(/Z$/.test(blogPostDate(post)) ? blogPostDate(post) : blogPostDate(post) + 'Z')
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return unique.sort((left, right) => {
    const leftPin = pinRank(left)
    const rightPin = pinRank(right)
    if (leftPin !== rightPin) return leftPin - rightPin
    return time(right) - time(left)
  })
}

/**
 * Lightweight Vault detection for the reader shell.
 *
 * The full crypto/metadata modules are lazy-loaded only when a post actually
 * carries `banksia_vault`. This helper parses the same JSON shape without
 * pulling WebCrypto into every post route.
 */
export function vaultSummary (value) {
  let root = value
  if (typeof root === 'string') {
    try { root = JSON.parse(root) } catch { return null }
  }
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null
  const meta = root.banksia_vault
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  if (meta.v !== 1) return null
  if (meta.mode !== 'section' && meta.mode !== 'post') return null
  return { mode: meta.mode }
}

/** Public teaser before the raw lock marker, without importing the crypto chunk. */
export function vaultPublicBody (body, mode = 'section') {
  const source = typeof body === 'string' ? body : ''
  const marker = '<!--banksia:vault-->'
  const index = source.indexOf(marker)
  if (mode === 'post' && index === -1) return ''
  return index === -1 ? source : source.slice(0, index)
}

/** Blog-relative path for a post, avoiding route-name collisions. */
export function blogPostPathFor (post, ownerAccount = '') {
  return hostBlogPostPathFor(post && post.permlink, post && post.author, ownerAccount)
}

export function blogPostPayout (post) {
  return postPayoutValue(post) > 0 ? postPayoutLabel(post) : ''
}

export function blogPostVoteCount (post) {
  return postVotes(post)
}

export function blogPostCommentCount (post) {
  return postCommentCount(post)
}
