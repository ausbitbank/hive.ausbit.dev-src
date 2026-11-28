import { describe, expect, it } from 'vitest'
import {
  activeFeedFilterCount,
  applyFeedFilters,
  defaultFeedFilters
} from '../../src/services/feedFilters'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'post-1',
    category: 'hive',
    created: '2026-01-01T00:00:00',
    json_metadata: { tags: ['hive'] },
    pending_payout_value: '1.000 HBD',
    active_votes: [],
    ...overrides
  }
}

describe('activeFeedFilterCount', () => {
  it('counts only filters that differ from the defaults', () => {
    expect(activeFeedFilterCount(defaultFeedFilters())).toBe(0)
    expect(activeFeedFilterCount({ ...defaultFeedFilters(), hideReblogs: true })).toBe(1)
    expect(activeFeedFilterCount({ ...defaultFeedFilters(), hideHidden: false })).toBe(1)
    expect(activeFeedFilterCount({ ...defaultFeedFilters(), hideGray: false, hideVoted: true })).toBe(2)
  })

  it('adds ignored tags to the badge count', () => {
    expect(activeFeedFilterCount(defaultFeedFilters(), ['spam', 'nsfw'])).toBe(2)
  })
})

describe('applyFeedFilters', () => {
  it('drops posts matching an ignored tag', () => {
    const posts = [
      post({ permlink: 'keep', category: 'art' }),
      post({ permlink: 'category-match', category: 'spam' }),
      post({ permlink: 'metadata-match', json_metadata: { tags: ['NSFW', 'art'] } })
    ]
    expect(applyFeedFilters(posts, { ignoredTags: ['spam', 'nsfw'] }).map(item => item.permlink))
      .toEqual(['keep'])
  })

  it('hides posts the viewer has already voted on', () => {
    const posts = [
      post({ permlink: 'voted', active_votes: [{ voter: 'Bob', percent: 100 }] }),
      post({ permlink: 'unvoted' }),
      post({ permlink: 'someone-else', active_votes: [{ voter: 'carol', percent: 100 }] })
    ]
    expect(applyFeedFilters(posts, { filter: { ...defaultFeedFilters(), hideVoted: true }, viewer: 'bob' }).map(item => item.permlink))
      .toEqual(['unvoted', 'someone-else'])
  })

  it('ignores the voted filter for guests', () => {
    const posts = [post({ permlink: 'voted', active_votes: [{ voter: 'bob', percent: 100 }] })]
    expect(applyFeedFilters(posts, { filter: { ...defaultFeedFilters(), hideVoted: true } })).toHaveLength(1)
  })

  it('drops reblogs, pinned, muted and moderated posts', () => {
    const posts = [
      post({ permlink: 'keep' }),
      post({ permlink: 'reblog', reblogged_by: ['carol'] }),
      post({ permlink: 'pinned', stats: { is_pinned: true } }),
      post({ permlink: 'muted', stats: { hide: true } }),
      post({ permlink: 'moderated', stats: { gray: true } })
    ]
    const filter = {
      ...defaultFeedFilters(),
      hideReblogs: true,
      hidePinned: true,
      hideHidden: true,
      hideGray: true
    }
    expect(applyFeedFilters(posts, { filter }).map(item => item.permlink)).toEqual(['keep'])
  })

  it('keeps posts inside the reward range', () => {
    const posts = [
      post({ permlink: 'low', pending_payout_value: '0.100 HBD' }),
      post({ permlink: 'inside', pending_payout_value: '5.000 HBD' }),
      post({ permlink: 'high', pending_payout_value: '80.000 HBD' })
    ]
    const filter = {
      ...defaultFeedFilters(),
      hideRewardsFilter: true,
      hideRewardsBelow: 1,
      hideRewardsAbove: 50
    }
    expect(applyFeedFilters(posts, { filter }).map(item => item.permlink)).toEqual(['inside'])
  })

  it('tolerates missing data', () => {
    expect(applyFeedFilters(null)).toEqual([])
    expect(applyFeedFilters([post()], { filter: {}, ignoredTags: null })).toHaveLength(1)
  })
})
