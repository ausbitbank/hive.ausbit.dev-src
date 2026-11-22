// Pure shaping helpers for the build-time home snapshot.
//
// The snapshot is deliberately small: it only carries the fields the first
// frame of the home dashboard reads. Live refreshes replace it immediately, so
// trimming a list or a body costs nothing after the first paint.

import { blockOperationMix } from '../../src/services/home.js'
import { trimPost } from '../../src/services/postSnapshot.js'

export { trimJsonMetadata, trimPost } from '../../src/services/postSnapshot.js'

export const HOME_SNAPSHOT_VERSION = 1
export const SNAPSHOT_ID = 'home-snapshot'

const POST_BODY_LIMIT = 420
const SPARKLINE_POINTS = 24

function numberOrNull (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function trimWitness (witness) {
  if (!witness || !witness.owner) return null
  return {
    owner: witness.owner,
    votes: witness.votes ?? '0',
    running_version: witness.running_version || '',
    total_missed: Number(witness.total_missed) || 0,
    last_hbd_exchange_update: witness.last_hbd_exchange_update || '',
    last_confirmed_block_num: Number(witness.last_confirmed_block_num) || 0,
    signing_key: witness.signing_key || ''
  }
}

export function trimGlobalProps (props) {
  if (!props || typeof props !== 'object') return null
  const keys = [
    'head_block_number',
    'time',
    'last_irreversible_block_num',
    'participation_count',
    'current_hbd_supply',
    'current_supply',
    'virtual_supply',
    'total_vesting_fund_hive',
    'total_vesting_shares',
    'hbd_interest_rate',
    'hbd_print_rate',
    'maximum_block_size',
    'current_witness'
  ]
  const trimmed = {}
  for (const key of keys) {
    if (props[key] !== undefined) trimmed[key] = props[key]
  }
  return trimmed
}

export function trimMarketCoin (coin) {
  if (!coin || !coin.id) return null
  const prices = Array.isArray(coin.sparkline_in_7d?.price)
    ? coin.sparkline_in_7d.price
    : []
  const step = Math.max(1, Math.ceil(prices.length / SPARKLINE_POINTS))
  const sparkline = prices.filter((_, index) => index % step === 0).slice(0, SPARKLINE_POINTS)

  return {
    id: coin.id,
    symbol: coin.symbol || '',
    name: coin.name || '',
    image: coin.image || '',
    current_price: numberOrNull(coin.current_price),
    market_cap: numberOrNull(coin.market_cap),
    total_volume: numberOrNull(coin.total_volume),
    price_change_percentage_24h: numberOrNull(coin.price_change_percentage_24h),
    last_updated: coin.last_updated || '',
    sparkline_in_7d: sparkline.length ? { price: sparkline } : undefined
  }
}

/**
 * The latest block reduced to what the home card shows. The full block can be
 * hundreds of kilobytes, so transactions are counted and reduced to their
 * operation types for the activity mix.
 */
export function trimBlock ({ block, blockNum, headBlock, virtualOps = [], sizeKb } = {}) {
  if (!block || !Number.isFinite(Number(blockNum))) return null
  const transactions = Array.isArray(block.transactions) ? block.transactions : []
  const operations = transactions.reduce(
    (total, tx) => total + (Array.isArray(tx.operations) ? tx.operations.length : 0),
    0
  )
  const regularTuples = transactions.flatMap(tx => (
    Array.isArray(tx.operations) ? tx.operations.map(op => [Array.isArray(op) ? op[0] : op?.op?.[0]]) : []
  ))
  const virtualTuples = virtualOps.map(op => [Array.isArray(op) ? op[0] : op?.op?.[0]]).filter(op => op[0])
  const computedSize = Number.isFinite(Number(sizeKb))
    ? Number(sizeKb)
    : JSON.stringify(block).length / 1024

  return {
    blockNum: Number(blockNum),
    headBlock: Number(headBlock) || Number(blockNum),
    block: {
      witness: block.witness || '',
      timestamp: block.timestamp || ''
    },
    summary: {
      transactions: transactions.length,
      operations,
      virtualOps: virtualOps.length,
      sizeKb: computedSize.toFixed(1),
      mix: blockOperationMix([...regularTuples, ...virtualTuples], 4)
    }
  }
}

export function trimFeed (posts, { bodyLimit = POST_BODY_LIMIT } = {}) {
  return {
    posts: (Array.isArray(posts) ? posts : []).map(post => trimPost(post, { bodyLimit })).filter(Boolean)
  }
}

export function buildHomeSnapshot ({
  generatedAt = Date.now(),
  props,
  witnesses = [],
  median = null,
  hardforkVersion = '',
  block = null,
  marketCoins = [],
  marketCurrency = 'usd',
  marketCoinIds = [],
  feeds = {}
} = {}) {
  const snapshot = {
    version: HOME_SNAPSHOT_VERSION,
    generatedAt: Number(generatedAt) || Date.now(),
    globalProps: trimGlobalProps(props),
    witnesses: (Array.isArray(witnesses) ? witnesses : []).map(trimWitness).filter(Boolean),
    median,
    hardforkVersion: hardforkVersion || '',
    block,
    market: {
      currency: marketCurrency || 'usd',
      coinIds: Array.isArray(marketCoinIds) ? [...marketCoinIds] : [],
      coins: (Array.isArray(marketCoins) ? marketCoins : []).map(trimMarketCoin).filter(Boolean)
    },
    network: null,
    feeds: {}
  }

  if (snapshot.globalProps) {
    snapshot.network = {
      props: snapshot.globalProps,
      median: median || null
    }
  }
  for (const [key, posts] of Object.entries(feeds)) {
    if (!key) continue
    snapshot.feeds[key] = trimFeed(posts)
  }
  return snapshot
}

/** `<` is escaped so the JSON can never terminate its containing script tag. */
export function serialiseSnapshot (snapshot) {
  return JSON.stringify(snapshot).replace(/</g, '\\u003c')
}

function snapshotTag (snapshot) {
  return '<script type="application/json" id="' + SNAPSHOT_ID + '">' +
    serialiseSnapshot(snapshot) +
    '</script>'
}

export function stripHomeSnapshot (html) {
  if (typeof html !== 'string') return html
  return html.replace(
    new RegExp('[ \\t]*<script\\b[^>]*\\bid=["\']?' + SNAPSHOT_ID + '["\']?[^>]*>[\\s\\S]*?</script>\\s*', 'i'),
    ''
  )
}

/**
 * Put the snapshot at the end of the body, after the app scripts. Module
 * scripts are deferred, so the element is in the DOM before Vue boots, but it
 * never delays parsing the head.
 */
export function injectHomeSnapshot (html, snapshot) {
  if (typeof html !== 'string' || !snapshot) return html
  const clean = stripHomeSnapshot(html)
  const tag = snapshotTag(snapshot)
  if (clean.includes('</body>')) return clean.replace('</body>', '    ' + tag + '\n  </body>')
  return clean + '\n' + tag
}
