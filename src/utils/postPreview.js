// Lightweight post preview helpers.
//
// The full render-helper bundle is only needed when a post body is rendered.
// Cards and carousels only need the first image and a plain-text summary, so
// keeping those helpers local avoids shipping the markdown renderer on the
// home, browse and account surfaces.

import { safeJsonParse } from './safeHtml'
import { firstMarkdownImageUrl, stripMarkdownImages, stripMarkdownLinks } from './media'
import { resizeImageUrl } from '../services/imageProxy'

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

const THREESPEAK_HOSTS = ['3speak.tv', 'www.3speak.tv', 'play.3speak.tv']

function urlHost (value) {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function hasThreeSpeakUrl (value) {
  if (typeof value !== 'string' || !/3speak\.tv/i.test(value)) return false
  const urls = value.match(/https?:\/\/[^\s)"'<>]+/gi) || []
  return urls.some(url => THREESPEAK_HOSTS.includes(urlHost(url)))
}

/**
 * True when a post is a 3Speak video. 3Speak writes `app: "3speak/embed"`, a
 * `video` object and/or a `threespeak.video` marker; older clients sometimes
 * only keep the embed URL in the body. A prose post merely tagged #3speak is
 * not a video.
 */
export function postIsThreeSpeakVideo (post) {
  if (!post) return false
  const metadata = metadataFor(post)
  if (/^3speak(?:\/|$)/i.test(String(metadata.app || '').trim())) return true
  if (metadata['threespeak.video']) return true
  const video = metadata.video
  if (video && typeof video === 'object') {
    if (String(video.platform || '').trim().toLowerCase() === '3speak') return true
    if (hasThreeSpeakUrl(video.url) || hasThreeSpeakUrl(video.embed)) return true
  }
  const links = Array.isArray(metadata.links) ? metadata.links : []
  if (links.some(hasThreeSpeakUrl)) return true
  return hasThreeSpeakUrl(String(post.body || ''))
}

/**
 * Card images are thumbnails, not full-size media. Cloudinary URLs can be
 * resized at the edge; YouTube thumbnails can move from maxresdefault (often
 * 200 KB+) to hqdefault (~20 KB) without touching the article page.
 */
export function previewImageUrl (url, width = 480) {
  if (typeof url !== 'string' || !url) return ''
  const youtube = url.match(/^(https?:\/\/i\.ytimg\.com\/vi\/[\w-]+\/)(?:maxresdefault|sddefault|hqdefault|mqdefault)(\.[a-z]+)$/i)
  if (youtube) return youtube[1] + 'hqdefault' + youtube[2]
  const cloudinary = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i)
  if (cloudinary) {
    const rest = cloudinary[2]
    if (/^[a-z]{1,3}_[^/]+\//i.test(rest)) return url
    return cloudinary[1] + 'w_' + Number(width) + ',q_auto:eco,f_auto/' + rest
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return url
    return resizeImageUrl(url, Number(width))
  } catch {
    return url
  }
}

function firstBodyImage (body) {
  if (typeof body !== 'string' || !body) return ''
  const markdown = firstMarkdownImageUrl(body)
  if (markdown && SAFE_IMAGE_URL.test(markdown)) return markdown
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
  if (typeof post === 'string') return previewImageUrl(decodeImage(firstBodyImage(post)))
  const meta = metadataFor(post)
  const thumbnail = firstString(meta.thumbnails)
  if (thumbnail) return previewImageUrl(decodeImage(thumbnail))
  const image = firstString(meta.image)
  if (image) return previewImageUrl(decodeImage(image))
  return previewImageUrl(decodeImage(firstBodyImage(post.body)))
}

/**
 * Strip common markdown/HTML so a preview summary reads as plain text.
 */
export function postSummary (post, length = 200) {
  const body = typeof post === 'string' ? post : post?.body
  if (typeof body !== 'string' || !body.trim()) return ''
  let text = stripMarkdownLinks(stripMarkdownImages(body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')))
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
