import { describe, expect, it } from 'vitest'
import { buildCommunityCards, communityRoleWeight, mergeCommunityFeeds } from '../../src/services/community'

const SUBSCRIPTIONS = [
  { name: 'hive-140217', title: 'Hive Gaming', role: 'guest', guestTitle: '' },
  { name: 'hive-139531', title: 'HiveDevs', role: 'admin', guestTitle: '' },
  { name: 'hive-12390', title: 'Openclaw', role: 'mod', guestTitle: 'Claw Fawkes' },
  { name: 'hive-168088', title: 'FreeSpeech', role: 'member', guestTitle: '' }
]

describe('communityRoleWeight', () => {
  it('ranks official roles above guests and tolerates unknown roles', () => {
    expect(communityRoleWeight('owner')).toBeGreaterThan(communityRoleWeight('admin'))
    expect(communityRoleWeight('admin')).toBeGreaterThan(communityRoleWeight('mod'))
    expect(communityRoleWeight('mod')).toBeGreaterThan(communityRoleWeight('member'))
    expect(communityRoleWeight('member')).toBeGreaterThan(communityRoleWeight('guest'))
    expect(communityRoleWeight('something-new')).toBe(0)
    expect(communityRoleWeight(undefined)).toBe(0)
  })
})

describe('buildCommunityCards', () => {
  it('merges subscription rows with community records and sorts by role', () => {
    const cards = buildCommunityCards(SUBSCRIPTIONS, {
      'hive-139531': {
        name: 'hive-139531',
        title: 'HiveDevs',
        about: 'Talk about **Hive** development [here](https://dev.example).',
        subscribers: 900,
        num_authors: 30,
        sum_pending: 12.5,
        num_pending: 44
      },
      'hive-140217': {
        name: 'hive-140217',
        title: 'Hive Gaming',
        about: 'Games',
        subscribers: 5000,
        num_authors: 80
      }
    })

    expect(cards.map(card => card.name)).toEqual([
      'hive-139531',
      'hive-12390',
      'hive-168088',
      'hive-140217'
    ])
    expect(cards[0]).toMatchObject({
      title: 'HiveDevs',
      about: 'Talk about Hive development here.',
      role: 'admin',
      roleLabel: 'Admin',
      subscribers: 900,
      authors: 30,
      pendingRewards: 12.5,
      weeklyInteractions: 44,
      known: true,
      link: '/c/hive-139531/trending'
    })
    expect(cards[1].roleLabel).toBe('Mod')
    expect(cards[2].roleLabel).toBe('Member')
    expect(cards[3]).toMatchObject({ title: 'Hive Gaming', known: true, subscribers: 5000 })
    expect(cards.map(card => card.order)).toEqual([0, 1, 2, 3])
  })

  it('keeps subscriptions whose community record is missing', () => {
    const cards = buildCommunityCards([{ name: 'hive-1', title: '', role: 'owner' }], {})
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      name: 'hive-1',
      title: 'hive-1',
      about: '',
      known: false,
      subscribers: 0,
      roleLabel: 'Owner'
    })
  })

  it('falls back to the guest title for guest memberships', () => {
    const cards = buildCommunityCards([{ name: 'hive-1', title: 'Hive One', role: 'guest', guestTitle: 'Aussie Witness' }], {})
    expect(cards[0].roleLabel).toBe('Aussie Witness')
  })

  it('degrades malformed input to an empty list', () => {
    expect(buildCommunityCards(null, null)).toEqual([])
    expect(buildCommunityCards([null, {}, 'nope'], {})).toEqual([])
  })

  it('truncates long descriptions', () => {
    const about = 'word '.repeat(100)
    const cards = buildCommunityCards([{ name: 'hive-1', title: 'One', role: 'member' }], {
      'hive-1': { name: 'hive-1', title: 'One', about }
    }, { aboutLength: 40 })
    expect(cards[0].about.length).toBeLessThanOrEqual(40)
  })
})

describe('mergeCommunityFeeds', () => {
  function post (community, permlink, extra = {}) {
    return { author: 'author-' + community, permlink, community, ...extra }
  }

  it('round-robins communities so one busy feed cannot dominate', () => {
    const feeds = [
      { name: 'hive-a', title: 'A', posts: [post('hive-a', '1'), post('hive-a', '2'), post('hive-a', '3')] },
      { name: 'hive-b', title: 'B', posts: [post('hive-b', '1')] }
    ]
    const merged = mergeCommunityFeeds(feeds, { limit: 4 })
    expect(merged.map(item => item.community + '/' + item.permlink)).toEqual([
      'hive-a/1',
      'hive-b/1',
      'hive-a/2',
      'hive-a/3'
    ])
  })

  it('deduplicates restacked posts and fills missing community data', () => {
    const shared = { author: 'bob', permlink: 'shared' }
    const feeds = [
      { name: 'hive-a', title: 'Alpha', posts: [{ ...shared }, { author: 'ann', permlink: 'a1' }] },
      { name: 'hive-b', title: 'Beta', posts: [{ author: 'bob', permlink: 'shared' }] }
    ]
    const merged = mergeCommunityFeeds(feeds, { limit: 10 })
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ community: 'hive-a', community_title: 'Alpha' })
    expect(merged[1]).toMatchObject({ community: 'hive-a', community_title: 'Alpha', permlink: 'a1' })
  })

  it('puts pinned posts first and drops invalid entries', () => {
    const feeds = [
      {
        name: 'hive-a',
        title: 'Alpha',
        posts: [post('hive-a', '1'), post('hive-a', 'pinned', { stats: { is_pinned: true } }), { author: '', permlink: '' }]
      }
    ]
    const merged = mergeCommunityFeeds(feeds, { limit: 5 })
    expect(merged.map(item => item.permlink)).toEqual(['pinned', '1'])
  })

  it('returns an empty list for missing or malformed feeds', () => {
    expect(mergeCommunityFeeds(null)).toEqual([])
    expect(mergeCommunityFeeds([{ name: 'hive-a', posts: null }])).toEqual([])
  })
})
