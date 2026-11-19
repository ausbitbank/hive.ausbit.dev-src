import { describe, expect, it } from 'vitest'
import {
  formatPostReputation,
  postCommentCount,
  postCommunityTitle,
  postDisplayTitle,
  postIsComment,
  postMetadata,
  postPayoutLabel,
  postPayoutValue,
  postRebloggers,
  postTags,
  postUserVote,
  postUserVoteDirection,
  postVotes,
  voteDirection
} from '../../src/services/posts'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'post',
    title: 'A post',
    children: 4,
    json_metadata: { tags: ['hive', 'hive-123', 'writing', 'hive'] },
    pending_payout_value: '1.250 HBD',
    payout: 2.5,
    stats: { total_votes: 12 },
    ...overrides
  }
}

describe('post preview helpers', () => {
  it('parses object and string metadata', () => {
    expect(postMetadata(post()).tags).toEqual(['hive', 'hive-123', 'writing', 'hive'])
    expect(postMetadata({ json_metadata: '{"tags":["a"]}' }).tags).toEqual(['a'])
    expect(postMetadata({ json_metadata: 'nope' })).toEqual({})
  })

  it('uses the title or a comment fallback', () => {
    expect(postDisplayTitle(post())).toBe('A post')
    expect(postDisplayTitle(post({ title: '' }))).toBe('Post by @alice')
    expect(postDisplayTitle(post({ title: '', parent_author: 'bob' }))).toBe('Comment by @alice')
  })

  it('detects comments and cleans tags', () => {
    expect(postIsComment(post({ parent_author: 'bob' }))).toBe(true)
    expect(postIsComment(post({ depth: 2 }))).toBe(true)
    expect(postIsComment(post())).toBe(false)
    expect(postTags(post())).toEqual(['hive', 'writing'])
    expect(postTags(post(), 1)).toEqual(['hive'])
  })

  it('combines payout, votes, comments and rebloggers', () => {
    expect(postPayoutValue(post())).toBe(2.5)
    expect(postPayoutValue(post({ pending_payout_value: '5.000 HBD', payout: 2 }))).toBe(5)
    expect(postPayoutLabel(post())).toBe('2.500 HBD')
    expect(postPayoutLabel(post({ pending_payout_value: '0.000 HBD', payout: 0 }))).toBe('0 HBD')
    expect(postVotes(post())).toBe(12)
    expect(postVotes(post({ stats: {}, active_votes: [{}, {}] }))).toBe(2)
    expect(postCommentCount(post())).toBe(4)
    expect(postRebloggers(post({ reblogged_by: ['bob'] }))).toEqual(['bob'])
  })

  it('formats bridge and raw reputation values', () => {
    expect(formatPostReputation(73.44)).toBe('73.4')
    expect(formatPostReputation(74.2)).toBe('74.2')
    expect(formatPostReputation(295634214098804)).toBe('74')
    expect(formatPostReputation(0)).toBe(null)
    expect(postCommunityTitle(post({ community_title: 'Hive' }))).toBe('Hive')
  })
})

describe('post user vote helpers', () => {
  const voters = (...votes) => post({ active_votes: votes })

  it('derives vote direction from numeric and string weights', () => {
    expect(voteDirection({ rshares: 12345 })).toBe(1)
    expect(voteDirection({ rshares: '12345' })).toBe(1)
    expect(voteDirection({ rshares: -42 })).toBe(-1)
    expect(voteDirection({ rshares: '-42' })).toBe(-1)
    // Bridge zeroes rshares on some neutral votes but keeps the percent sign.
    expect(voteDirection({ rshares: 0, percent: -5000 })).toBe(-1)
    expect(voteDirection({ rshares: 0, percent: 0 })).toBe(0)
    expect(voteDirection(null)).toBe(0)
  })

  it('finds the logged-in user vote case-insensitively', () => {
    const current = voters(
      { voter: 'bob', rshares: 10 },
      { voter: 'Alice', rshares: 20 }
    )
    expect(postUserVote(current, 'alice').rshares).toBe(20)
    expect(postUserVote(current, 'carol')).toBe(undefined)
    expect(postUserVote(current, '')).toBe(undefined)
    expect(postUserVote(post(), 'alice')).toBe(undefined)
  })

  it('reports up, down or no vote for the user', () => {
    expect(postUserVoteDirection(voters({ voter: 'alice', rshares: 20 }), 'alice')).toBe('up')
    expect(postUserVoteDirection(voters({ voter: 'alice', rshares: '-20' }), 'alice')).toBe('down')
    expect(postUserVoteDirection(voters({ voter: 'alice', rshares: 0 }), 'alice')).toBe(null)
    expect(postUserVoteDirection(voters({ voter: 'bob', rshares: 20 }), 'alice')).toBe(null)
    expect(postUserVoteDirection(voters({ voter: 'alice', rshares: 20 }), null)).toBe(null)
  })
})
