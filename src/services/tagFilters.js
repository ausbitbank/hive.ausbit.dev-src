// Local tag filters for feed listings.
//
// This is deliberately separate from the content-decision engine: ignored tags
// cut noise out of feeds, but they never hide a post the reader deliberately
// opened. The canonical list lives in the moderation policy so it travels with
// the existing local export/import.

import { postMetadata } from './posts'

export const MAX_IGNORED_TAGS = 200
export const MAX_IGNORED_TAG_LENGTH = 64

/** Normalize one tag for matching or storage. Case and a leading # are ignored. */
export function normalizeIgnoredTag (value) {
  return String(value ?? '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .slice(0, MAX_IGNORED_TAG_LENGTH)
}

/** Dedupe and cap a tag list while preserving the order the viewer added them. */
export function normalizeIgnoredTags (value, cap = MAX_IGNORED_TAGS) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const tag = normalizeIgnoredTag(item)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= cap) break
  }
  return out
}

/**
 * Every tag a post can be matched on: the category, the reply target and the
 * declared metadata tags. Community ids (hive-123) are included so a viewer can
 * filter a whole community through the same list if they choose to.
 */
export function postTagValues (post) {
  if (!post || typeof post !== 'object') return []
  const tags = []
  const push = value => {
    if (typeof value !== 'string') return
    const tag = normalizeIgnoredTag(value)
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  push(post.category)
  push(post.parent_permlink)
  const metadata = postMetadata(post)
  if (Array.isArray(metadata.tags)) {
    for (const tag of metadata.tags) push(tag)
  }
  return tags
}

/** Return the first ignored tag that matches the post, or '' when none do. */
export function matchingIgnoredTag (post, ignoredTags) {
  const ignored = normalizeIgnoredTags(ignoredTags)
  if (!ignored.length) return ''
  const postTags = new Set(postTagValues(post))
  for (const tag of ignored) {
    if (postTags.has(tag)) return tag
  }
  return ''
}

/** True when a specific tag is currently on the ignored list. */
export function isTagIgnored (tag, ignoredTags) {
  const needle = normalizeIgnoredTag(tag)
  if (!needle) return false
  return normalizeIgnoredTags(ignoredTags).includes(needle)
}
