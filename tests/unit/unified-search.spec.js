import { describe, expect, it } from 'vitest'
import {
  buildSearchPlan,
  clearFilters,
  exploreFacets,
  filterByFacets,
  filterByPeriod,
  hasActiveFilters,
  normalizeSearchState,
  parseSearchState,
  periodStartTimestamp,
  postMatchesQuery,
  rankAccounts,
  rankCommunities,
  rankPosts,
  rankProposals,
  rankWitnesses,
  searchToQuery,
  searchUrl,
  scorePost,
  tagAnalytics,
  tagFacets,
  toggleFacet
} from '../../src/services/unifiedSearch'

const NOW = Date.parse('2026-11-18T12:00:00')

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'hello-world',
    title: 'Hello world',
    body: 'A post about hive and photography.',
    category: 'hive-174578',
    community: 'hive-174578',
    community_title: 'Photography Lovers',
    created: '2026-11-17T12:00:00',
    pending_payout_value: '1.000 HBD',
    children: 3,
    stats: { total_votes: 10 },
    json_metadata: { tags: ['hive-174578', 'photography', 'hive'] },
    ...overrides
  }
}

describe('search state', () => {
  it('parses and normalises query strings', () => {
    const state = parseSearchState('q=ignored&type=posts&sort=trending&period=week&tag=photography&tag=hive&community=hive-174578&author=alice&order=asc&window=7d&style=list&page=3')
    expect(state).toMatchObject({
      type: 'posts',
      sort: 'trending',
      period: 'week',
      tags: ['photography', 'hive'],
      communities: ['hive-174578'],
      authors: ['alice'],
      sortOrder: 'asc',
      window: '7d',
      style: 'list',
      page: 3
    })
  })

  it('falls back to safe defaults for invalid values', () => {
    const state = normalizeSearchState({
      type: 'nope',
      sort: 'random',
      period: 'forever',
      tags: ['#Hive', 'Hive', '', 'bad tag!'],
      page: -5,
      style: 'masonry'
    })
    expect(state.type).toBe('all')
    expect(state.sort).toBe('relevance')
    expect(state.period).toBe('all')
    expect(state.tags).toEqual(['hive'])
    expect(state.page).toBe(1)
    expect(state.style).toBe('cards')
  })

  it('round-trips state into a shareable query string', () => {
    const state = normalizeSearchState({ type: 'tags', sort: 'created', tags: ['art', 'hive'], period: 'day' })
    const query = searchToQuery(state)
    expect(query).toContain('type=tags')
    expect(query).toContain('sort=created')
    expect(query).toContain('period=day')
    expect(query).toContain('tag=art')
    expect(parseSearchState(query)).toMatchObject({ type: 'tags', sort: 'created', period: 'day', tags: ['art', 'hive'] })
  })

  it('builds shareable search URLs and detects active filters', () => {
    expect(searchUrl('hive')).toBe('/search?q=hive')
    expect(searchUrl('hive', { tags: ['art'] })).toBe('/search?q=hive&tag=art')
    expect(searchUrl('')).toBe('/search')
    expect(hasActiveFilters({})).toBe(false)
    expect(hasActiveFilters({ tags: ['art'] })).toBe(true)
    expect(hasActiveFilters({ sort: 'created' })).toBe(true)
    expect(clearFilters().tags).toEqual([])
  })

  it('toggles facet values', () => {
    expect(toggleFacet([], 'Art')).toEqual(['art'])
    expect(toggleFacet(['art'], 'art')).toEqual([])
    expect(toggleFacet(['a'], 'b')).toEqual(['a', 'b'])
  })
})

describe('search plan', () => {
  it('recognises account, tag, block, transaction and proposal input', () => {
    expect(buildSearchPlan('@ausbitbank')).toMatchObject({ kind: 'account', accounts: 'ausbitbank' })
    expect(buildSearchPlan('#photography')).toMatchObject({ kind: 'tag', tags: 'photography' })
    expect(buildSearchPlan('hive-174578')).toMatchObject({ kind: 'tag', tags: 'hive-174578' })
    expect(buildSearchPlan('100000000')).toMatchObject({ kind: 'block', blocks: '100000000' })
    expect(buildSearchPlan('7ad5edd0997430be8eaa48ead159b2cfb8f5b606')).toMatchObject({ kind: 'transaction' })
    expect(buildSearchPlan('proposal 392')).toMatchObject({ kind: 'proposal', proposals: '392' })
    expect(buildSearchPlan('https://peakd.com/@alice/hello')).toMatchObject({ kind: 'post' })
  })

  it('treats single-word free text as a keyword search, not an account jump', () => {
    for (const term of ['photography', 'bitcoin', 'hive', 'climate']) {
      expect(buildSearchPlan(term)).toMatchObject({
        kind: 'keyword',
        query: term,
        accounts: term,
        posts: term
      })
    }
    // A bare tag-shaped word still exposes tag facets.
    expect(buildSearchPlan('photography')).toMatchObject({ tags: 'photography', communities: 'photography' })
  })

  it('keeps an explicit @account as an account search', () => {
    expect(buildSearchPlan('@ausbitbank')).toMatchObject({ kind: 'account', accounts: 'ausbitbank' })
    expect(buildSearchPlan('https://peakd.com/@alice')).toMatchObject({ kind: 'account', accounts: 'alice' })
  })

  it('treats free text as a post search without using it as a tag', () => {
    expect(buildSearchPlan('hive photography')).toMatchObject({
      kind: 'keyword',
      posts: 'hive photography',
      tags: null,
      communities: null
    })
    expect(buildSearchPlan('landing on the moon')).toMatchObject({
      kind: 'keyword',
      posts: 'landing on the moon',
      tags: null
    })
    expect(buildSearchPlan('')).toMatchObject({ kind: 'keyword', query: '' })
  })
})

describe('post ranking', () => {
  it('ranks exact tag matches above body matches', () => {
    const tagPost = post({ permlink: 'tagged', json_metadata: { tags: ['photography'] }, title: 'Something else' })
    const bodyPost = post({ permlink: 'body', json_metadata: { tags: ['hive'] }, title: 'Unrelated', body: 'mentions photography once' })
    const ranked = rankPosts([bodyPost, tagPost], { query: 'photography', now: NOW })
    expect(ranked.map(item => item.permlink)).toEqual(['tagged', 'body'])
  })

  it('filters by period, tag, community and author', () => {
    const fresh = post({ permlink: 'fresh', created: '2026-11-18T00:00:00' })
    const old = post({ permlink: 'old', created: '2026-01-01T00:00:00' })
    expect(filterByPeriod([fresh, old], 'week', NOW).map(item => item.permlink)).toEqual(['fresh'])
    expect(filterByPeriod([fresh, old], 'all', NOW)).toHaveLength(2)

    const other = post({ permlink: 'other', author: 'bob', json_metadata: { tags: ['art'] }, community: 'hive-1' })
    expect(filterByFacets([fresh, other], { tags: ['photography'] }).map(item => item.permlink)).toEqual(['fresh'])
    expect(filterByFacets([fresh, other], { communities: ['hive-1'] }).map(item => item.permlink)).toEqual(['other'])
    expect(filterByFacets([fresh, other], { authors: ['bob'] }).map(item => item.permlink)).toEqual(['other'])
  })

  it('ignores stopwords when deciding whether a post mentions the query', () => {
    expect(postMatchesQuery(post({ title: 'Hello world', body: 'A post about hive and photography.' }), 'landing on the moon')).toBe(false)
    expect(postMatchesQuery(post({ title: 'Moon landing', body: 'Apollo.' }), 'landing on the moon')).toBe(true)
  })

  it('formats a period start as the UTC timestamp HiveSense expects', () => {
    const now = Date.parse('2026-11-20T15:30:45Z')
    expect(periodStartTimestamp('day', now)).toBe('2026-11-19 15:30:45')
    expect(periodStartTimestamp('week', now)).toBe('2026-11-13 15:30:45')
    expect(periodStartTimestamp('month', now)).toBe('2026-10-20 15:30:45')
    expect(periodStartTimestamp('all', now)).toBe('')
  })

  it('sorts chronologically, de-duplicates and keeps a stable fallback', () => {
    const a = post({ permlink: 'a', created: '2026-11-10T00:00:00' })
    const b = post({ permlink: 'b', created: '2026-11-16T00:00:00', pending_payout_value: '5.000 HBD' })
    expect(rankPosts([a, b, b], { sort: 'created', now: NOW }).map(item => item.permlink)).toEqual(['b', 'a'])
    expect(rankPosts([a, b], { sort: 'trending', now: NOW })[0].permlink).toBe('b')
  })

  it('scores tag, author and payout signals', () => {
    expect(scorePost(post({ permlink: 'x' }), 'alice')).toBeGreaterThan(20)
    expect(scorePost(post({ permlink: 'x', pending_payout_value: '100.000 HBD' }), 'hive')).toBeGreaterThan(
      scorePost(post({ permlink: 'y', pending_payout_value: '0.001 HBD' }), 'hive')
    )
    expect(scorePost(null)).toBe(0)
  })
})

describe('facets and analytics', () => {
  it('ranks accounts by exact, prefix and substring match', () => {
    const accounts = [
      { name: 'susbitbank', reputation: 20 },
      { name: 'ausbitbank-dev', reputation: 40 },
      { name: 'ausbitbank', reputation: 60 },
      { name: 'other', reputation: 99 }
    ]
    expect(rankAccounts(accounts, 'ausbit').map(item => item.name)).toEqual(['ausbitbank', 'ausbitbank-dev'])
    expect(rankAccounts(accounts, '@ausbitbank')[0].name).toBe('ausbitbank')
  })

  it('builds tag facets from posts and typed input', () => {
    const posts = [post({ permlink: 'a' }), post({ permlink: 'b' }), post({ permlink: 'c', json_metadata: { tags: ['art'] } })]
    const facets = tagFacets(posts, '', { limit: 10 })
    expect(facets[0]).toEqual({ tag: 'hive', count: 2 })
    expect(facets.some(item => item.tag === 'photography')).toBe(true)
    expect(tagFacets([], 'newtag', { limit: 5 })).toEqual([{ tag: 'newtag', count: 1 }])
  })

  it('ranks communities, witnesses and proposals', () => {
    const communities = [
      { name: 'hive-1', title: 'Photography Lovers', subscribers: 100 },
      { name: 'hive-2', title: 'Other', subscribers: 900 },
      { name: 'hive-3', title: 'Photo Feed', subscribers: 50 }
    ]
    expect(rankCommunities(communities, 'photography').map(item => item.name)).toEqual(['hive-1'])

    const witnesses = [
      { owner: 'alpha', votes: 10 },
      { owner: 'beta', votes: 50 },
      { owner: 'alphawitness', votes: 5 }
    ]
    expect(rankWitnesses(witnesses, 'alpha').map(item => item.owner)).toEqual(['alpha', 'alphawitness'])

    const proposals = [
      { proposal_id: 1, subject: 'Hive dev', total_votes: '10' },
      { proposal_id: 2, subject: 'Other', total_votes: '99' },
      { proposal_id: 3, subject: 'Hive design', total_votes: '50' }
    ]
    expect(rankProposals(proposals, 'hive').map(item => item.proposal_id)).toEqual([3, 1])
  })

  it('explores author facets and computes topic analytics', () => {
    const posts = [
      post({ permlink: 'a', created: '2026-11-17T12:00:00' }),
      post({ permlink: 'b', author: 'bob', created: '2026-11-16T12:00:00', pending_payout_value: '9.000 HBD' }),
      post({ permlink: 'c', created: '2026-09-01T12:00:00' })
    ]
    const facets = exploreFacets(posts)
    expect(facets.tags.find(item => item.value === 'photography').count).toBe(3)
    expect(facets.communities[0]).toEqual({ value: 'hive-174578', count: 3 })

    const analytics = tagAnalytics(posts, { now: NOW, label: 'photography' })
    expect(analytics.posts).toBe(2)
    expect(analytics.authors).toBe(2)
    expect(analytics.postsPerDay).toBe(0.14)
    expect(analytics.topAuthors.map(row => row.author)).toContain('alice')
    expect(analytics.relatedTags.map(row => row.tag)).toContain('hive')
    expect(analytics.cadence).toHaveLength(14)
  })
})
