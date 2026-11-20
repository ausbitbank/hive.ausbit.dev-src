import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HIVESENSE_HOSTS,
  HIVESENSE_MAX_FULL_POSTS,
  HIVESENSE_MAX_RESULTS,
  hiveSenseHostsFromBeacon,
  normalizeHiveSensePost,
  resetHiveSenseHosts,
  resolveHiveSenseHosts,
  searchHiveSenseAuthors,
  searchHiveSensePosts,
  fetchSimilarPosts
} from '../../src/services/hiveSense'
import { mergeSemanticPosts, postMatchesQuery, rankPosts } from '../../src/services/unifiedSearch'

function post (author, permlink, extra = {}) {
  return {
    author,
    permlink,
    title: permlink,
    created: '2026-11-01T00:00:00',
    category: 'hive-dev',
    stats: { total_votes: 3 },
    ...extra
  }
}

function jsonResponse (body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

afterEach(() => {
  resetHiveSenseHosts()
  vi.restoreAllMocks()
})

describe('hiveSenseHostsFromBeacon', () => {
  it('prefers advertised hosts ordered by score then the static fallback', () => {
    const hosts = hiveSenseHostsFromBeacon({
      'https://low': { endpoint: 'https://low', score: 40, features: ['hivesense_api'] },
      'https://high': { endpoint: 'https://high', score: 100, features: ['hivesense_api'] },
      'https://plain': { endpoint: 'https://plain', score: 100, features: ['broadcast'] }
    })

    expect(hosts[0]).toBe('https://high')
    expect(hosts[1]).toBe('https://low')
    expect(hosts).toContain(HIVESENSE_HOSTS[0])
    expect(hosts).not.toContain('https://plain')
  })

  it('falls back to the static list without beacon data', () => {
    expect(hiveSenseHostsFromBeacon(null)).toEqual(HIVESENSE_HOSTS)
  })
})

describe('searchHiveSensePosts', () => {
  it('returns normalised posts from the first working host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([post('alice', 'first'), post('bob', 'second')])
    )

    const result = await searchHiveSensePosts('hive dev', { hosts: ['https://n1'], fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.posts.map(p => p.author)).toEqual(['alice', 'bob'])
    expect(result.host).toBe('https://n1')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://n1/hivesense-api/posts/search?q=hive+dev&result_limit=20&full_posts=20',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('passes truncation, observer and time window through to the API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]))
    await searchHiveSensePosts('hive dev', {
      limit: 40, truncate: 400, observer: 'alice', author: 'bob',
      fromBlock: '2026-11-13 15:30:45', toBlock: '109000000',
      hosts: ['https://n1'], fetchImpl
    })
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('result_limit=40')
    expect(url).toContain('full_posts=40')
    expect(url).toContain('truncate=400')
    expect(url).toContain('observer=alice')
    expect(url).toContain('author=bob')
    expect(url).toContain('from-block=2026-11-13+15%3A30%3A45')
    expect(url).toContain('to-block=109000000')
  })

  it('fails over to the next host when the first is broken', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(jsonResponse([post('carol', 'post')]))

    const result = await searchHiveSensePosts('topic', { hosts: ['https://down', 'https://up'], fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.host).toBe('https://up')
  })

  it('rejects short queries without fetching', async () => {
    const fetchImpl = vi.fn()
    const result = await searchHiveSensePosts('a', { fetchImpl })
    expect(result.ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('clamps the result limit and full post count to the API maximums', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]))
    await searchHiveSensePosts('query', { limit: 5000, hosts: ['https://n1'], fetchImpl })
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('result_limit=' + HIVESENSE_MAX_RESULTS)
    expect(url).toContain('full_posts=' + HIVESENSE_MAX_FULL_POSTS)
  })

  it('reports failure when every host is down', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))
    const result = await searchHiveSensePosts('topic', { hosts: ['https://a', 'https://b'], fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.posts).toEqual([])
  })
})

describe('fetchSimilarPosts and author search', () => {
  it('encodes the post path for the similar endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([post('x', 'y')]))
    const result = await fetchSimilarPosts('@Alice', 'my post', { hosts: ['https://n1'], fetchImpl })
    expect(result.ok).toBe(true)
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://n1/hivesense-api/posts/alice/my%20post/similar?result_limit=8&full_posts=8'
    )
  })

  it('normalises author results to plain names', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(['alice', { name: 'bob' }, { author: 'carol' }, null]))
    const result = await searchHiveSenseAuthors('photography', { hosts: ['https://n1'], fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.authors).toEqual(['alice', 'bob', 'carol'])
    expect(fetchImpl.mock.calls[0][0]).toContain('result_limit=6')
  })

  it('drops malformed posts when normalising', () => {
    expect(normalizeHiveSensePost({ author: 'a' })).toBe(null)
    expect(normalizeHiveSensePost(null)).toBe(null)
    expect(normalizeHiveSensePost({ author: 'a', permlink: 'b' })).toBe(null)
    expect(normalizeHiveSensePost({ author: 'a', permlink: 'b', title: 'Hi' })).toMatchObject({
      author: 'a',
      permlink: 'b',
      stats: { total_votes: 0 }
    })
  })

  it('drops sparse rows that only have author and permlink', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      post('good', 'one'),
      { author: 'sparse', permlink: 'two', title: null, body: null },
      { author: 'sparse2', permlink: 'three', title: '', body: '   ' }
    ]))
    const result = await searchHiveSensePosts('topic', { hosts: ['https://n1'], fetchImpl })
    expect(result.posts.map(p => p.author)).toEqual(['good'])
  })
})

describe('resolveHiveSenseHosts', () => {
  it('derives hosts from beacon and caches the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      { endpoint: 'https://api.hive.blog', score: 100, features: ['hivesense_api'] }
    ]))

    const first = await resolveHiveSenseHosts({ fetchImpl })
    const second = await resolveHiveSenseHosts()
    expect(first[0]).toBe('https://api.hive.blog')
    expect(second).toBe(first)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to the static list when beacon fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(resolveHiveSenseHosts({ fetchImpl })).resolves.toEqual(HIVESENSE_HOSTS)
  })
})

describe('mergeSemanticPosts', () => {
  it('keeps semantic order first and appends unseen keyword posts', () => {
    const semantic = [post('semantic1', 'a'), post('shared', 'b')]
    const keyword = [post('shared', 'b'), post('keyword', 'c')]

    const merged = mergeSemanticPosts(semantic, keyword)
    expect(merged.map(p => `${p.author}/${p.permlink}`)).toEqual([
      'semantic1/a',
      'shared/b',
      'keyword/c'
    ])
    expect(merged[0].semantic).toBe(true)
    expect(merged[2].semantic).toBe(false)
  })

  it('applies the posting window filter to semantic results', () => {
    const now = Date.parse('2026-11-19T00:00:00Z')
    const recent = post('new', 'a', { created: '2026-11-18T00:00:00' })
    const old = post('old', 'b', { created: '2020-01-01T00:00:00' })

    const merged = mergeSemanticPosts([recent, old], [], { period: 'week', now })
    expect(merged.map(p => p.author)).toEqual(['new'])
  })

  it('does not pad semantic results with unrelated keyword posts', () => {
    const semantic = [post('semantic', 'hive-development')]
    const keyword = [post('gardener', 'tomatoes', { category: 'gardening' }), post('dev', 'hive-development-notes')]
    const merged = mergeSemanticPosts(semantic, keyword, { query: 'hive development' })
    expect(merged.map(p => p.author)).toEqual(['semantic', 'dev'])
  })

  it('drops malformed posts and tolerates missing input', () => {
    expect(mergeSemanticPosts(null, null)).toEqual([])
    const merged = mergeSemanticPosts([{ author: 'a' }, post('b', 'c')], [])
    expect(merged).toHaveLength(1)
  })
})

describe('relevance ranking', () => {
  it('matches posts by any query token', () => {
    expect(postMatchesQuery(post('alice', 'hive-development'), 'hive development')).toBe(true)
    expect(postMatchesQuery(post('bob', 'tomatoes', { category: '' }), 'hive development')).toBe(false)
    expect(postMatchesQuery(post('bob', 'tomatoes'), '')).toBe(true)
  })

  it('keeps only text matches for a relevance query', () => {
    const posts = [
      post('alice', 'hive-development', { title: 'Hive development notes' }),
      post('bob', 'tomatoes', { title: 'Growing tomatoes', category: 'gardening' })
    ]
    expect(rankPosts(posts, { query: 'hive', sort: 'relevance' }).map(p => p.author)).toEqual(['alice'])
    // If nothing matches the text, the original candidates are kept so a query
    // never produces an empty page by accident.
    expect(rankPosts(posts, { query: 'zebra', sort: 'relevance' })).toHaveLength(2)
  })
})
