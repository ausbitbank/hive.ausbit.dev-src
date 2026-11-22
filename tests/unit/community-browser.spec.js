import { describe, expect, it } from 'vitest'
import {
  COMMUNITY_CATEGORIES,
  buildDirectoryCards,
  communityTypeLabel,
  directoryCategory,
  isHiveCommunityName,
  rankDirectoryCards,
  sortDirectoryCards,
  summarizeDirectory
} from '../../src/services/communityDirectory'

const RECORDS = [
  {
    name: 'hive-100001',
    title: 'Hive Photography',
    about: 'Share **photos** and learn from [other photographers](https://example.com).',
    type_id: 1,
    subscribers: 1200,
    num_authors: 18,
    num_pending: 44,
    sum_pending: 12.5,
    created_at: '2021-01-28 18:34:09',
    is_nsfw: false
  },
  {
    name: 'hive-200002',
    title: 'Hive Gaming Journal',
    about: 'Games and game development.',
    type_id: 2,
    subscribers: 8000,
    num_authors: 64,
    num_pending: 120,
    sum_pending: 30,
    created_at: '2022-06-01 10:00:00',
    is_nsfw: false
  },
  {
    name: 'hive-300003',
    title: 'Council',
    about: 'A restricted council.',
    type_id: 3,
    subscribers: 40,
    num_authors: 2,
    created_at: '2020-01-01 00:00:00',
    is_nsfw: true
  }
]

describe('buildDirectoryCards', () => {
  it('normalises bridge records into community cards', () => {
    const cards = buildDirectoryCards(RECORDS)
    expect(cards).toHaveLength(3)
    expect(cards[0]).toMatchObject({
      name: 'hive-100001',
      title: 'Hive Photography',
      about: 'Share photos and learn from other photographers.',
      subscribers: 1200,
      authors: 18,
      pendingRewards: 12.5,
      weeklyInteractions: 44,
      type: 'topic',
      typeLabel: 'Topic',
      nsfw: false,
      restricted: false,
      link: '/c/hive-100001/trending'
    })
    expect(cards[1]).toMatchObject({ type: 'journal', typeLabel: 'Journal', restricted: true })
    expect(cards[2]).toMatchObject({ type: 'council', typeLabel: 'Council', nsfw: true, restricted: true })
  })

  it('deduplicates names, drops malformed records and truncates descriptions', () => {
    const cards = buildDirectoryCards([
      ...RECORDS,
      RECORDS[0],
      null,
      {},
      { name: '' },
      { name: 'hive-999999', title: 'Long', about: 'word '.repeat(100), type_id: 1 }
    ], { aboutLength: 40 })
    expect(cards.map(card => card.name)).toEqual(['hive-100001', 'hive-200002', 'hive-300003', 'hive-999999'])
    expect(cards[3].about.length).toBeLessThanOrEqual(40)
  })

  it('degrades missing fields without NaN', () => {
    const cards = buildDirectoryCards([{ name: 'hive-123456' }])
    expect(cards[0]).toMatchObject({
      title: 'hive-123456',
      about: '',
      subscribers: 0,
      authors: 0,
      pendingRewards: 0,
      typeLabel: 'Topic'
    })
    expect(communityTypeLabel({ type_id: 99 })).toBe('Topic')
  })
})

describe('sortDirectoryCards', () => {
  const cards = buildDirectoryCards(RECORDS)

  it('sorts by subscribers', () => {
    expect(sortDirectoryCards(cards, 'subs').map(card => card.name)).toEqual([
      'hive-200002',
      'hive-100001',
      'hive-300003'
    ])
  })

  it('sorts by active authors', () => {
    expect(sortDirectoryCards(cards, 'active').map(card => card.name)).toEqual([
      'hive-200002',
      'hive-100001',
      'hive-300003'
    ])
  })

  it('sorts by creation time', () => {
    expect(sortDirectoryCards(cards, 'new').map(card => card.name)).toEqual([
      'hive-200002',
      'hive-100001',
      'hive-300003'
    ])
  })

  it('keeps server order for rank and tolerates bad input', () => {
    expect(sortDirectoryCards(cards, 'rank').map(card => card.name)).toEqual(cards.map(card => card.name))
    expect(sortDirectoryCards(null, 'subs')).toEqual([])
  })

  it('ranks title and name matches above description-only matches', () => {
    const searchCards = buildDirectoryCards([
      { name: 'hive-100', title: 'Hive Open Circle', about: 'A photography circle.', subscribers: 9000, num_authors: 20 },
      { name: 'hive-200', title: 'Gaming Photography', about: 'Games and screenshots.', subscribers: 2000, num_authors: 15 },
      { name: 'hive-300', title: 'Photography Lovers', about: 'Share your best shots.', subscribers: 1000, num_authors: 10 }
    ])

    expect(rankDirectoryCards(searchCards, 'photography').map(card => card.name)).toEqual([
      'hive-300',
      'hive-200',
      'hive-100'
    ])
    expect(sortDirectoryCards(searchCards, 'relevance', 'photography').map(card => card.name)).toEqual([
      'hive-300',
      'hive-200',
      'hive-100'
    ])
    expect(rankDirectoryCards(searchCards, 'hive-200')[0].name).toBe('hive-200')
    expect(rankDirectoryCards(searchCards, '')).toEqual(searchCards)
  })
})

describe('categories and names', () => {
  it('maps category queries back to their chip', () => {
    expect(COMMUNITY_CATEGORIES.length).toBeGreaterThan(5)
    expect(directoryCategory('photography')?.label).toBe('Photography')
    expect(directoryCategory(' Photography ')?.label).toBe('Photography')
    expect(directoryCategory('custom search')).toBeNull()
    expect(directoryCategory('')).toBeNull()
  })

  it('recognises exact community account names', () => {
    expect(isHiveCommunityName('hive-174578')).toBe(true)
    expect(isHiveCommunityName('HIVE-174578')).toBe(true)
    expect(isHiveCommunityName('hive-17457x')).toBe(false)
    expect(isHiveCommunityName('photography')).toBe(false)
  })
})

describe('summarizeDirectory', () => {
  it('totals subscribers, authors, payouts and NSFW rows', () => {
    const summary = summarizeDirectory(buildDirectoryCards(RECORDS))
    expect(summary).toEqual({
      communities: 3,
      subscribers: 9240,
      authors: 84,
      pendingRewards: 42.5,
      nsfw: 1
    })
    expect(summarizeDirectory(null)).toEqual({
      communities: 0,
      subscribers: 0,
      authors: 0,
      pendingRewards: 0,
      nsfw: 0
    })
  })
})
