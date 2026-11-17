#!/usr/bin/env node
// Generate dist/spa/feed.xml from the project author's Hive blog.
// Build-time only; failures fall back to a minimal valid feed so deployment
// never depends on a live API request.

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE = 'https://hive.ausbit.dev'
const ACCOUNT = 'ausbitbank'
const API = 'https://api.hive.blog'
const OUT = resolve(process.cwd(), 'dist/spa/feed.xml')

function escapeXml (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripHtml (value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function itemXml (post) {
  const link = BASE + '/@' + post.author + '/' + post.permlink
  const date = new Date((post.created || '').replace(' ', 'T') + (post.created?.includes('T') ? '' : 'Z'))
  const published = Number.isFinite(date.getTime()) ? date.toUTCString() : new Date().toUTCString()
  const description = stripHtml(post.body || post.title || '').slice(0, 500)
  return `    <item>
      <title>${escapeXml(post.title || post.permlink)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(published)}</pubDate>
      <author>@${escapeXml(post.author)}</author>
      <description>${escapeXml(description)}</description>
    </item>`
}

async function fetchPosts () {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'bridge.get_account_posts',
      params: {
        sort: 'blog',
        account: ACCOUNT,
        observer: null,
        limit: 20,
        start_author: null,
        start_permlink: null
      }
    })
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const data = await response.json()
  return Array.isArray(data.result) ? data.result : []
}

async function main () {
  let posts = []
  try {
    posts = await fetchPosts()
  } catch (error) {
    console.warn('RSS feed: using fallback item:', error.message)
  }

  const items = posts.length > 0
    ? posts.map(itemXml).join('\n')
    : `    <item>
      <title>hive.ausbit.dev</title>
      <link>${BASE}/</link>
      <guid isPermaLink="true">${BASE}/</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Hive block explorer and toolkit.</description>
    </item>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>hive.ausbit.dev — project updates</title>
    <link>${BASE}/</link>
    <description>Hive block explorer, wallet, governance and market updates from @${ACCOUNT}.</description>
    <language>en-us</language>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
  await mkdir(resolve(process.cwd(), 'dist/spa'), { recursive: true })
  await writeFile(OUT, xml, 'utf8')
  console.log('RSS feed written to dist/spa/feed.xml')
}

main().catch(error => {
  console.error('RSS feed generation failed:', error)
  process.exitCode = 1
})
