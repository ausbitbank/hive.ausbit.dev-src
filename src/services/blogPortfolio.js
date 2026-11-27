// Portfolio image extraction for a blog post.
//
// The portfolio is curated by permlink, so the page fetches the full post and
// shows every https image it can find: the metadata image, Markdown images and
// inline HTML images. Duplicates are removed and the list is capped.

import { postMetadata } from './posts'

const MAX_IMAGES = 12

function isHttps (value) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim())
}

export function portfolioImages (post) {
  if (!post) return []
  const images = []
  const seen = new Set()
  const add = (url, alt = '') => {
    const value = String(url || '').trim().replaceAll('&amp;', '&')
    if (!isHttps(value) || seen.has(value)) return
    seen.add(value)
    images.push({ url: value, alt: String(alt || '').trim().slice(0, 160) })
  }

  const thumbnail = typeof post.thumbnail === 'string' ? post.thumbnail.trim() : ''
  if (isHttps(thumbnail)) add(thumbnail)

  const metadata = postMetadata(post)
  const metadataImages = Array.isArray(metadata.image) ? metadata.image : [metadata.image]
  for (const value of metadataImages) add(value)

  const body = String(post.body || '')
  for (const match of body.matchAll(/!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/gi)) {
    add(match[2], match[1])
  }

  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    const src = tag.match(/\bsrc\s*=\s*["'](https:\/\/[^"']+)["']/i)
    if (!src) continue
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)
    add(src[1], alt ? alt[1] : '')
  }

  return images.slice(0, MAX_IMAGES)
}

export function portfolioPostTags (post, limit = 3) {
  const tags = postMetadata(post).tags
  if (!Array.isArray(tags)) return []
  return tags
    .filter(tag => typeof tag === 'string' && tag.trim() && !tag.startsWith('hive-'))
    .slice(0, limit)
}
