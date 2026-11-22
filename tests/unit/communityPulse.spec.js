import { describe, expect, it } from 'vitest'
import { communityPulseSummary } from '../../src/services/communityPulse'

const COMMUNITY = {
  name: 'hive-139531',
  title: '<b>Hive Devs</b>',
  about: 'A [place](https://example.com) for `devs`',
  subscribers: '1234',
  num_authors: 12,
  sum_pending: '4.500',
  settings: { nsfw: false }
}

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    payout: 1,
    children: 3,
    stats: { total_votes: 7 },
    ...overrides
  }
}

describe('community pulse summary', () => {
  it('shapes a single community and picks its top post', () => {
    const summary = communityPulseSummary({
      community: COMMUNITY,
      posts: [
        post({ permlink: 'small', title: 'Small', payout: 2 }),
        post({ author: 'bob', permlink: 'big', title: 'Big', payout: 9, children: 5, stats: { total_votes: 11 } })
      ],
      role: 'member'
    })

    expect(summary.mode).toBe('single')
    expect(summary.hasCommunity).toBe(true)
    expect(summary.community).toEqual({
      name: 'hive-139531',
      title: 'Hive Devs',
      about: 'A place for devs',
      subscribers: 1234,
      authors: 12,
      pendingRewards: 4.5,
      link: '/c/hive-139531',
      nsfw: false
    })
    expect(summary.role).toBe('member')
    expect(summary.roleLabel).toBe('Member')
    expect(summary.topPost).toEqual({
      title: 'Big',
      permlink: 'big',
      author: 'bob',
      payoutHbd: 9,
      payoutUsd: 9,
      votes: 11,
      comments: 5
    })
  })

  it('handles a missing community', () => {
    const summary = communityPulseSummary({ community: null, posts: [] })

    expect(summary.hasCommunity).toBe(false)
    expect(summary.community.name).toBe('')
    expect(summary.community.title).toBe('')
    expect(summary.community.subscribers).toBe(0)
    expect(summary.community.link).toBe('')
    expect(summary.topPost).toBeNull()
  })

  it('labels roles and normalises an unknown mode', () => {
    expect(communityPulseSummary({ community: COMMUNITY, role: 'owner' }).roleLabel).toBe('Owner')
    expect(communityPulseSummary({ community: COMMUNITY, role: 'admin' }).roleLabel).toBe('Admin')
    expect(communityPulseSummary({ community: COMMUNITY, role: 'mod' }).roleLabel).toBe('Moderator')
    expect(communityPulseSummary({ community: COMMUNITY, role: 'guest' }).roleLabel).toBe('Guest')
    expect(communityPulseSummary({ community: COMMUNITY, role: '' }).roleLabel).toBe('')
    expect(communityPulseSummary({ community: COMMUNITY, mode: 'bogus' }).mode).toBe('single')
  })

  it('builds and sorts cards for the account communities mode', () => {
    const summary = communityPulseSummary({
      mode: 'mine',
      communities: [
        { name: 'hive-1', title: 'Joined', role: 'member', subscribers: 900, num_authors: 4, sum_pending: 1 },
        { name: 'hive-2', title: 'Owned', role: 'owner', subscribers: 50, num_authors: 2, sum_pending: 0.5 },
        { title: 'No name' }
      ]
    })

    expect(summary.mode).toBe('mine')
    expect(summary.hasCommunity).toBe(true)
    expect(summary.communities).toHaveLength(2)
    expect(summary.communities[0]).toEqual({
      name: 'hive-2',
      title: 'Owned',
      role: 'owner',
      roleLabel: 'Owner',
      subscribers: 50,
      authors: 2,
      pendingRewards: 0.5,
      link: '/c/hive-2'
    })
    expect(summary.communities[1].name).toBe('hive-1')
    expect(summary.communities[1].roleLabel).toBe('Member')
  })

  it('reports an empty account communities list', () => {
    const summary = communityPulseSummary({ mode: 'mine', communities: [] })
    expect(summary.hasCommunity).toBe(false)
    expect(summary.communities).toEqual([])
  })

  it('reads the NSFW flag from settings or the record', () => {
    expect(communityPulseSummary({ community: { ...COMMUNITY, settings: { nsfw: true } } }).community.nsfw).toBe(true)
    expect(communityPulseSummary({ community: { ...COMMUNITY, is_nsfw: true } }).community.nsfw).toBe(true)
    expect(communityPulseSummary({ community: COMMUNITY }).community.nsfw).toBe(false)
  })

  it('parses numbers defensively', () => {
    const summary = communityPulseSummary({
      community: { name: 'hive-3', subscribers: '1,234', num_authors: 'nope', sum_pending: null }
    })

    expect(summary.community.subscribers).toBe(1234)
    expect(summary.community.authors).toBe(0)
    expect(summary.community.pendingRewards).toBe(0)
  })

  it('falls back to a display title and skips malformed posts', () => {
    const summary = communityPulseSummary({
      community: COMMUNITY,
      posts: [post({ title: '', permlink: 'untitled' }), { title: 'No permlink' }]
    })

    expect(summary.topPost.title).toBe('Post by @alice')
    expect(summary.topPost.permlink).toBe('untitled')
  })
})
