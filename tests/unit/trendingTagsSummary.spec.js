import { describe, expect, it } from 'vitest'
import { trendingTagsSummary } from '../../src/services/trendingTagsSummary'

const TAGS = [
  { name: 'hive', top_posts: 120, comments: '340', total_payouts: '125000.500 HBD' },
  { name: 'photography', posts: '42', comments: 18, payout: 950 },
  { name: 'writing', top_posts: '7', comments: '2', total_payouts: '12.345 HBD' },
  { name: 'empty', top_posts: null, comments: undefined, total_payouts: '' }
]

describe('trending tags summary', () => {
  it('shapes rows and parses string numbers', () => {
    const summary = trendingTagsSummary({ tags: TAGS, limit: 8 })
    expect(summary.hasData).toBe(true)
    expect(summary.rows).toHaveLength(4)

    expect(summary.rows[0]).toMatchObject({
      name: 'hive',
      posts: 120,
      comments: 340,
      payout: 125000.5,
      payoutLabel: '125k HBD',
      link: '/trending/hive'
    })
    expect(summary.rows[1]).toMatchObject({
      name: 'photography',
      posts: 42,
      comments: 18,
      payout: 950,
      payoutLabel: '950 HBD'
    })
    expect(summary.rows[2].payoutLabel).toBe('12.3 HBD')
  })

  it('keeps the server order and caps the list', () => {
    const summary = trendingTagsSummary({ tags: TAGS, limit: 2 })
    expect(summary.rows.map(row => row.name)).toEqual(['hive', 'photography'])
  })

  it('treats missing numbers as zero', () => {
    const summary = trendingTagsSummary({ tags: TAGS })
    const row = summary.rows.find(item => item.name === 'empty')
    expect(row).toMatchObject({ posts: 0, comments: 0, payout: 0, payoutLabel: '0 HBD' })
  })

  it('returns an empty summary for empty or malformed data', () => {
    expect(trendingTagsSummary()).toEqual({ rows: [], hasData: false })
    expect(trendingTagsSummary({ tags: null })).toEqual({ rows: [], hasData: false })
    expect(trendingTagsSummary({ tags: [null, {}, { name: '   ' }] })).toEqual({ rows: [], hasData: false })
    expect(trendingTagsSummary({ tags: TAGS, limit: 0 })).toEqual({ rows: [], hasData: false })
  })

  it('encodes the tag in the feed link', () => {
    const summary = trendingTagsSummary({
      tags: [{ name: 'art photography', top_posts: 1 }, { name: 'c++/rust?', top_posts: 1 }]
    })
    expect(summary.rows[0].link).toBe('/trending/art%20photography')
    expect(summary.rows[1].link).toBe('/trending/c%2B%2B%2Frust%3F')
  })

  it('drops duplicate and nameless rows without breaking the order', () => {
    const summary = trendingTagsSummary({
      tags: [{ name: 'hive' }, { name: 'hive' }, { top_posts: 4 }, { name: 'art' }]
    })
    expect(summary.rows.map(row => row.name)).toEqual(['hive', 'art'])
  })
})
