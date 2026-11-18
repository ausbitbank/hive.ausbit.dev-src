// Lightweight post preview helpers.
//
// The full render-helper bundle is only needed when a post body is rendered.
// Cards and carousels only need the first image and a plain-text summary, so
// keeping those helpers local avoids shipping the markdown renderer on the
// home, browse and account surfaces.

import { safeJsonParse } from './safeHtml'

const IMAGE_EXTENSION = /\.(?:tiff?|jpe?g|gif|png|svg|ico|heic|webp|arw)(?:[?#][^\s)"'<>]*)?/i
const SAFE_IMAGE_URL = /^https?:\/\//i

function decodeEntities (value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function decodeImage (value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const decoded = decodeEntities(value).trim()
  try {
    return decodeURIComponent(decoded)
  } catch {
    return decoded
  }
}

function firstString (value) {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) return value.find(item => typeof item === 'string' && item.trim()) || ''
  return ''
}

function metadataFor (post) {
  if (!post) return {}
  if (post.json_metadata && typeof post.json_metadata === 'object') return post.json_metadata
  return safeJsonParse(post.json_metadata || '{}')
}

function firstBodyImage (body) {
  if (typeof body !== 'string' || !body) return ''
  const markdown = body.match(/!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/)
  if (markdown && SAFE_IMAGE_URL.test(markdown[1])) return markdown[1]
  const html = body.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (html && SAFE_IMAGE_URL.test(html[1])) return html[1]
  const bare = body.match(/https?:\/\/[^\s)"'<>]+/g) || []
  return bare.find(url => IMAGE_EXTENSION.test(url)) || ''
}

/**
 * Return the best available image for a post card. Metadata images win, then
 * the first image in the body. This mirrors the render-helper priority without
 * pulling the markdown renderer into preview-only routes.
 */
export function postImage (post) {
  if (!post) return ''
  if (typeof post === 'string') return decodeImage(firstBodyImage(post))
  const meta = metadataFor(post)
  const thumbnail = firstString(meta.thumbnails)
  if (thumbnail) return decodeImage(thumbnail)
  const image = firstString(meta.image)
  if (image) return decodeImage(image)
  return decodeImage(firstBodyImage(post.body))
}

/**
 * Strip common markdown/HTML so a preview summary reads as plain text.
 */
export function postSummary (post, length = 200) {
  const body = typeof post === 'string' ? post : post?.body
  if (typeof body !== 'string' || !body.trim()) return ''
  let text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:https?|ftp):\/\/[^\s]+/g, ' ')
    .replace(/^[ \t]*[#>*+-]+\s*/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  text = decodeEntities(text)
  const limit = Number(length) || 0
  if (limit > 0 && text.length > limit) {
    const cut = text.slice(0, limit)
    const lastSpace = cut.lastIndexOf(' ')
    text = (lastSpace > Math.floor(limit * 0.6) ? cut.slice(0, lastSpace) : cut).trim() + '…'
  }
  return text
}
