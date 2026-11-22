import { describe, expect, it } from 'vitest'
import {
  buildHomeSnapshot,
  injectHomeSnapshot,
  serialiseSnapshot,
  stripHomeSnapshot,
  trimBlock,
  trimJsonMetadata,
  trimPost
} from '../../scripts/lib/home-snapshot.mjs'

const POST = {
  author: 'alice',
  permlink: 'hello',
  title: 'Hello',
  created: '2026-01-01T00:00:00',
  body: 'x'.repeat(4000),
  children: 3,
  payout: 1.5,
  stats: { total_votes: 12, hide: false },
  active_votes: [{ voter: 'bob' }],
  json_metadata: JSON.stringify({
    image: ['https://images.example/a.png'],
    tags: ['hive', 'test'],
    app: 'peakd/1.0',
    description: 'd'.repeat(600),
    secret: 'drop-me'
  })
}

describe('home snapshot shaping', () => {
  it('keeps the fields a preview card renders and truncates the body', () => {
    const post = trimPost(POST)
    expect(post.author).toBe('alice')
    expect(post.body.length).toBeLessThan(POST.body.length)
    expect(post.stats).toEqual({ total_votes: 12 })
    expect(post.active_votes).toEqual([])
    expect(post.json_metadata.image).toEqual(['https://images.example/a.png'])
    expect(post.json_metadata.tags).toEqual(['hive', 'test'])
    expect(post.json_metadata.secret).toBeUndefined()
    expect(post.json_metadata.description).toBeUndefined()
  })

  it('drops invalid posts and malformed metadata', () => {
    expect(trimPost(null)).toBeNull()
    expect(trimPost({ author: '', permlink: 'x' })).toBeNull()
    expect(trimJsonMetadata('{oops')).toEqual({})
    expect(trimJsonMetadata(null)).toEqual({})
  })

  it('reduces a block to counters and the operation mix', () => {
    const trimmed = trimBlock({
      block: {
        witness: 'alice',
        timestamp: '2026-01-01T00:00:00',
        transactions: [
          { operations: [['vote', {}], ['vote', {}]] },
          { operations: [['transfer', {}]] }
        ]
      },
      blockNum: 42,
      headBlock: 43,
      virtualOps: [{ op: ['producer_reward', {}] }],
      sizeKb: 9.5
    })
    expect(trimmed.blockNum).toBe(42)
    expect(trimmed.block).toEqual({ witness: 'alice', timestamp: '2026-01-01T00:00:00' })
    expect(trimmed.summary.transactions).toBe(2)
    expect(trimmed.summary.operations).toBe(3)
    expect(trimmed.summary.virtualOps).toBe(1)
    expect(trimmed.summary.sizeKb).toBe('9.5')
    expect(trimmed.summary.mix[0]).toMatchObject({ type: 'vote', count: 2 })
  })

  it('builds a snapshot with only the requested sections', () => {
    const snapshot = buildHomeSnapshot({
      generatedAt: 123,
      props: { head_block_number: 42, unknown: 'drop' },
      witnesses: [{ owner: 'alice', votes: '1' }],
      block: { blockNum: 42 },
      marketCoins: [{ id: 'hive', current_price: 1 }],
      marketCurrency: 'usd',
      marketCoinIds: ['hive'],
      feeds: { 'global:trending': [POST] }
    })
    expect(snapshot.version).toBe(1)
    expect(snapshot.generatedAt).toBe(123)
    expect(snapshot.globalProps.unknown).toBeUndefined()
    expect(snapshot.witnesses[0].owner).toBe('alice')
    expect(snapshot.market.coins[0].id).toBe('hive')
    expect(snapshot.feeds['global:trending'].posts[0].permlink).toBe('hello')
  })

  it('injects and strips the snapshot without breaking the shell', () => {
    const snapshot = buildHomeSnapshot({ generatedAt: 123, props: { head_block_number: 1 } })
    const html = '<html><head></head><body><div id="q-app"></div><script>app()</script></body></html>'
    const injected = injectHomeSnapshot(html, snapshot)
    expect(injected).toContain('id="home-snapshot"')
    expect(injected.indexOf('id="home-snapshot"')).toBeGreaterThan(injected.indexOf('app()'))
    expect(stripHomeSnapshot(injected)).toBe(html)
  })

  it('escapes angle brackets in the inline JSON', () => {
    const json = serialiseSnapshot({ version: 1, value: '</script><b>' })
    expect(json).not.toContain('</script>')
    expect(json).toContain('\\u003c')
  })
})
