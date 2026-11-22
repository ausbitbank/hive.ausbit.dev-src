import { describe, expect, it } from 'vitest'
import { communitySpotlightSummary, utcDayOfYear } from '../../src/services/communitySpotlight'

const COMMUNITIES = [
  {
    name: 'hive-100001',
    title: 'Art',
    about: 'Pictures and **design**.',
    subscribers: '120',
    authors: 8,
    pendingRewards: '34.500 HBD'
  },
  {
    name: 'hive-100002',
    title: 'Writing',
    about: 'Stories, essays and poetry.',
    subscribers: 240,
    authors: '12',
    pendingRewards: 100
  },
  {
    name: 'hive-100003',
    title: 'Photography',
    about: 'Photos from everywhere.',
    subscribers: 80,
    authors: 5,
    pendingRewards: 2
  }
]

const DAY_ONE = '2026-01-01T12:00:00Z'
const DAY_TWO = '2026-01-02T12:00:00Z'

describe('community spotlight', () => {
  it('picks a card deterministically by UTC day', () => {
    const first = communitySpotlightSummary({ communities: COMMUNITIES, date: DAY_ONE })
    const again = communitySpotlightSummary({ communities: COMMUNITIES, date: DAY_ONE })
    expect(first.card).toEqual(again.card)
    expect(first.hasCard).toBe(true)
    expect(first.hasData).toBe(true)
    expect(first.candidates).toBe(3)
    expect(first.dayKey).toBe('2026-01-01')

    // Day-of-year 1 % 3 = 1, so the second community is today's pick.
    expect(first.card.name).toBe('hive-100002')
    expect(first.card.link).toBe('/c/hive-100002')

    const next = communitySpotlightSummary({ communities: COMMUNITIES, date: DAY_TWO })
    expect(next.card.name).toBe('hive-100003')
  })

  it('computes the UTC day of year', () => {
    expect(utcDayOfYear(DAY_ONE)).toBe(1)
    expect(utcDayOfYear('2026-12-31T23:59:59Z')).toBe(365)
    expect(utcDayOfYear('2026-02-01T00:00:00Z')).toBe(32)
  })

  it('filters NSFW communities by default', () => {
    const list = [
      COMMUNITIES[0],
      { ...COMMUNITIES[1], is_nsfw: true },
      COMMUNITIES[2]
    ]
    const safe = communitySpotlightSummary({ communities: list, date: DAY_ONE })
    expect(safe.candidates).toBe(2)
    expect(safe.card.name).not.toBe('hive-100002')

    const all = communitySpotlightSummary({ communities: list, date: DAY_ONE, hideNsfw: false })
    expect(all.candidates).toBe(3)
    expect(all.card.name).toBe('hive-100002')
    expect(all.card.nsfw).toBe(true)
  })

  it('normalises missing fields and cleans text', () => {
    const summary = communitySpotlightSummary({
      communities: [
        { name: 'hive-200001', about: 'A [link](https://example.com) and <b>bold</b> text.' }
      ],
      date: DAY_ONE
    })
    expect(summary.card).toEqual({
      name: 'hive-200001',
      title: 'hive-200001',
      about: 'A link and bold text.',
      subscribers: 0,
      authors: 0,
      pendingRewards: 0,
      link: '/c/hive-200001',
      nsfw: false
    })
  })

  it('returns empty flags when there are no candidates', () => {
    const empty = communitySpotlightSummary({ communities: [], date: DAY_ONE })
    expect(empty).toEqual({
      card: null,
      hasCard: false,
      hasData: false,
      candidates: 0,
      dayKey: '2026-01-01'
    })

    const nameless = communitySpotlightSummary({
      communities: [{ title: 'No name' }, null, {}],
      date: DAY_ONE
    })
    expect(nameless.hasCard).toBe(false)

    const hidden = communitySpotlightSummary({
      communities: [{ name: 'hive-300001', is_nsfw: true }],
      date: DAY_ONE
    })
    expect(hidden.hasData).toBe(false)
  })

  it('encodes the community name in the link', () => {
    const summary = communitySpotlightSummary({
      communities: [{ name: 'Hive Test/One' }],
      date: DAY_ONE
    })
    expect(summary.card.link).toBe('/c/Hive%20Test%2FOne')
  })
})
