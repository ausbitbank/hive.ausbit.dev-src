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
  postVotes
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
