// Dependency-free RSS 2.0 generation for an account blog.
//
// This module is imported by the SPA tests and by the Cloudflare metadata
// Worker. Keep it free of browser APIs so the edge can build a feed without a
// separate implementation.

import { stripMarkdownImages, stripMarkdownLinks } from '../utils/media'
import { blogPostPathFor } from './blogHost'

const BLOCK_TAG_RE = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|section|article|hr)[^>]*>/gi
const MAX_TITLE = 180
const MAX_DESCRIPTION = 320

function isObject (value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseMetadata (post) {
  const metadata = post && post.json_metadata
  if (isObject(metadata)) return metadata
  if (typeof metadata !== 'string' || !metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Plain text from untrusted post HTML, without a DOM. */
export function feedText (value, max = MAX_DESCRIPTION) {
  if (typeof value !== 'string') return ''
  const text = decodeEntities(
    stripMarkdownLinks(stripMarkdownImages(value))
      .replace(BLOCK_TAG_RE, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  const clipped = text.slice(0, max)
  const lastSpace = clipped.lastIndexOf(' ')
  return clipped.slice(0, lastSpace > max * 0.6 ? lastSpace : clipped.length).trimEnd() + '…'
}

function decodeEntities (value) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
}

export function escapeXml (value) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function rfc822 (value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toUTCString()
}

function createdTime (post) {
  const value = post && (post.created || post.last_update)
  if (!value) return 0
  const date = new Date(/Z$/.test(value) ? value : value + 'Z')
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function isTopLevel (post) {
  return Boolean(post && post.author && post.permlink && !post.parent_author && Number(post.depth || 0) === 0)
}

/** Vault containers and HOM products are plumbing, never feed content. */
function isHiddenFeedPost (post) {
  let metadata = post && post.json_metadata
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch {
      metadata = null
    }
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  return metadata.banksia_vault_container === true ||
    String(metadata.content_type || '').toLowerCase() === 'product'
}

export function blogFeedPosts (posts, limit = 20) {
  const seen = new Set()
  return (Array.isArray(posts) ? posts : [])
    .filter(isTopLevel)
    .filter(post => !isHiddenFeedPost(post))
    .filter(post => {
      const key = String(post.author).toLowerCase() + '/' + String(post.permlink).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => createdTime(right) - createdTime(left))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 20)))
}

function postLink (base, post, owner = '') {
  const baseUrl = String(base || '').replace(/\/+$/, '')
  return baseUrl + blogPostPathFor(post.permlink, post.author, owner)
}

function postCategories (post) {
  const tags = parseMetadata(post).tags
  if (!Array.isArray(tags)) return []
  const out = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const value = tag.trim()
    if (!value || value.startsWith('hive-') || out.includes(value)) continue
    out.push(value)
    if (out.length >= 6) break
  }
  return out
}

/**
 * Build an RSS 2.0 feed for one account blog.
 *
 * @returns {string} XML text (always valid, even when `posts` is empty).
 */
export function buildBlogRss ({
  account = '',
  title = '',
  description = '',
  posts = [],
  baseUrl = '',
  limit = 20,
  language = 'en',
  now = new Date()
} = {}) {
  const accountName = String(account || '').trim().toLowerCase()
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const feedTitle = String(title || '').trim() || (accountName ? '@' + accountName : 'Hive blog')
  const feedDescription = String(description || '').trim() || (accountName ? 'Posts by @' + accountName + ' on Hive.' : 'A blog on Hive.')
  const items = blogFeedPosts(posts, limit)
  const newest = items.reduce((max, post) => Math.max(max, createdTime(post)), 0)
  const lastBuild = newest ? new Date(newest) : (now instanceof Date ? now : new Date(now))

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    '    <title>' + escapeXml(feedTitle) + '</title>',
    '    <link>' + escapeXml(base || 'https://banksia.io') + '</link>',
    '    <description>' + escapeXml(feedDescription) + '</description>',
    '    <language>' + escapeXml(language) + '</language>',
    '    <atom:link href="' + escapeXml((base || 'https://banksia.io') + '/rss.xml') + '" rel="self" type="application/rss+xml" />',
    '    <lastBuildDate>' + escapeXml(rfc822(lastBuild)) + '</lastBuildDate>'
  ]

  for (const post of items) {
    const link = postLink(base, post, accountName)
    const postTitle = feedText(post.title, MAX_TITLE) || String(post.permlink || '').replaceAll('-', ' ')
    const postDescription = feedText(post.body, MAX_DESCRIPTION) || ('A Hive post by @' + post.author + '.')
    const published = rfc822(post.created || post.last_update)
    lines.push('    <item>')
    lines.push('      <title>' + escapeXml(postTitle) + '</title>')
    lines.push('      <link>' + escapeXml(link) + '</link>')
    lines.push('      <guid isPermaLink="true">' + escapeXml(link) + '</guid>')
    lines.push('      <dc:creator>' + escapeXml(post.author) + '</dc:creator>')
    if (published) lines.push('      <pubDate>' + escapeXml(published) + '</pubDate>')
    lines.push('      <description>' + escapeXml(postDescription) + '</description>')
    for (const category of postCategories(post)) {
      lines.push('      <category>' + escapeXml(category) + '</category>')
    }
    lines.push('    </item>')
  }

  lines.push('  </channel>')
  lines.push('</rss>')
  lines.push('')
  return lines.join('\n')
}
