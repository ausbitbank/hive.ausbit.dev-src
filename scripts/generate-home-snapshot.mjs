#!/usr/bin/env node
// Pre-warm the home dashboard at build time.
//
// The first home visit currently waits for a public node before the block,
// witness and post cards can paint. This script publishes a small snapshot of
// those reads into the built shell so the first frame is independent of node
// latency. Widgets keep refreshing live; the snapshot is only the first paint.
//
// Failures are non-fatal: the app falls back to its normal live reads.

import { BRAND } from '../src/config/brand.js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DEFAULT_HOME_MARKET_COIN_IDS,
  DEFAULT_HOME_MARKET_PREFS,
  buildMarketUrl
} from '../src/services/homeMarket.js'
import {
  buildHomeSnapshot,
  injectHomeSnapshot,
  serialiseSnapshot,
  trimBlock
} from './lib/home-snapshot.mjs'

const DIST = resolve(process.cwd(), 'dist/spa')
const INDEX = resolve(DIST, 'index.html')
const OUT = resolve(DIST, 'home-snapshot.json')

const HIVE_RPCS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info'
]
const RPC_TIMEOUT_MS = 4500
const MARKET_TIMEOUT_MS = 3500
const WITNESS_LIMIT = 10

const FEEDS = [
  {
    key: 'global:trending',
    method: 'bridge.get_ranked_posts',
    params: { sort: 'trending', tag: '', limit: 6, observer: null }
  },
  {
    key: 'account:ausbitbank:blog',
    method: 'bridge.get_account_posts',
    params: {
      sort: 'blog',
      account: 'ausbitbank',
      observer: 'ausbitbank',
      limit: 6,
      start_author: null,
      start_permlink: null
    }
  },
  {
    key: 'community:hive-139531:trending',
    method: 'bridge.get_ranked_posts',
    params: { sort: 'trending', tag: 'hive-139531', limit: 6, observer: null }
  }
]

async function rpc (method, params = []) {
  for (const endpoint of HIVE_RPCS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': BRAND.name + ' home snapshot (+' + BRAND.url + ')'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS)
      })
      if (!response.ok) continue
      const data = await response.json()
      if (data?.result) return data.result
      if (data?.error) continue
    } catch {
      // Try the next node.
    }
  }
  return null
}

async function fetchMarket () {
  const prefs = {
    coinIds: DEFAULT_HOME_MARKET_COIN_IDS,
    currency: DEFAULT_HOME_MARKET_PREFS.currency
  }
  try {
    const response = await fetch(buildMarketUrl(prefs), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(MARKET_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const data = await response.json()
    return {
      ...prefs,
      coins: Array.isArray(data) ? data : []
    }
  } catch (error) {
    console.warn('Home snapshot: market data skipped:', error.message)
    return { ...prefs, coins: [] }
  }
}

async function fetchFeeds () {
  const entries = await Promise.all(FEEDS.map(async feed => {
    const posts = await rpc(feed.method, feed.params)
    return [feed.key, Array.isArray(posts) ? posts : []]
  }))
  return Object.fromEntries(entries)
}

async function main () {
  const [props, witnesses, median, hardforkVersion, market, feeds] = await Promise.all([
    rpc('condenser_api.get_dynamic_global_properties'),
    rpc('condenser_api.get_witnesses_by_vote', ['', WITNESS_LIMIT]),
    rpc('condenser_api.get_current_median_history_price'),
    rpc('condenser_api.get_hardfork_version'),
    fetchMarket(),
    fetchFeeds()
  ])

  const head = Number(props?.head_block_number)
  if (!Number.isFinite(head) || head <= 0) throw new Error('head block unavailable')

  const [block, virtualOps] = await Promise.all([
    rpc('condenser_api.get_block', [head]),
    rpc('condenser_api.get_ops_in_block', [head, true])
  ])
  const trimmedBlock = trimBlock({
    block,
    blockNum: head,
    headBlock: head,
    virtualOps: Array.isArray(virtualOps) ? virtualOps : []
  })

  const snapshot = buildHomeSnapshot({
    generatedAt: Date.now(),
    props,
    witnesses: Array.isArray(witnesses) ? witnesses : [],
    median,
    hardforkVersion: hardforkVersion || '',
    block: trimmedBlock,
    marketCoins: market.coins,
    marketCurrency: market.currency,
    marketCoinIds: market.coinIds,
    feeds
  })

  await writeFile(OUT, JSON.stringify(snapshot) + '\n', 'utf8')

  const html = await readFile(INDEX, 'utf8')
  await writeFile(INDEX, injectHomeSnapshot(html, snapshot), 'utf8')

  const bytes = Buffer.byteLength(serialiseSnapshot(snapshot))
  console.log(
    'Home snapshot written: head ' + head +
    ', ' + snapshot.witnesses.length + ' witnesses' +
    ', ' + Object.values(snapshot.feeds).reduce((total, feed) => total + feed.posts.length, 0) + ' posts' +
    ', ' + snapshot.market.coins.length + ' coins' +
    ', ' + Math.round(bytes / 1024) + ' KB inline'
  )
}

main().catch(error => {
  console.warn('Home snapshot skipped:', error.message)
})