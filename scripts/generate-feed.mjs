#!/usr/bin/env node
// Generate dist/spa/feed.xml from the project author's Hive blog.
// Build-time only; failures fall back to a minimal valid feed so deployment
// never depends on a live API request.

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildFeedXml, FEED_BASE, FEED_ACCOUNT } from './lib/feed.mjs'

const API = 'https://api.hive.blog'
const OUT = resolve(process.cwd(), 'dist/spa/feed.xml')

async function fetchPosts () {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'bridge.get_account_posts',
      params: {
        sort: 'posts',
        account: FEED_ACCOUNT,
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

  const xml = buildFeedXml({ posts, base: FEED_BASE, account: FEED_ACCOUNT })
  await mkdir(resolve(process.cwd(), 'dist/spa'), { recursive: true })
  await writeFile(OUT, xml, 'utf8')
  console.log('RSS feed written to dist/spa/feed.xml')
}

main().catch(error => {
  console.error('RSS feed generation failed:', error)
  process.exitCode = 1
})
