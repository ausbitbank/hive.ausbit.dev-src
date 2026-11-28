import { describe, expect, it } from 'vitest'
import {
  excerpt,
  extractVoteContext,
  extractVoterComments,
  keywordHits,
  mergeVoteContext,
  stripMarkdown
} from '../../src/services/downvoteContext'

const VOTE_TIME = Date.parse('2026-11-28T10:00:00Z')

function discussion () {
  return {
    'alice/post': {
      author: 'alice',
      permlink: 'post',
      depth: 0,
      replies: ['bob/re-1']
    },
    'bob/re-1': {
      author: 'bob',
      permlink: 're-1',
      parent_author: 'alice',
      parent_permlink: 'post',
      depth: 1,
      created: '2026-11-28T09:00:00',
      body: 'I downvoted **this** because the claim looks like spam. [source](https://example.com)',
      replies: ['alice/re-2']
    },
    'alice/re-2': {
      author: 'alice',
      permlink: 're-2',
      parent_author: 'bob',
      parent_permlink: 're-1',
      depth: 2,
      created: '2026-11-28T11:00:00',
      body: 'Can you point to the source?',
      replies: []
    }
  }
}

describe('comment context', () => {
  it('strips markdown and makes bounded excerpts', () => {
    expect(stripMarkdown('# Title\n\n**bold** [link](https://x) ![img](y) <b>tag</b>')).toBe('Title bold link tag')
    expect(excerpt('a'.repeat(300), 20)).toBe('a'.repeat(19) + '…')
    expect(keywordHits('This is spam because it was downvoted')).toEqual(['downvote', 'because', 'spam'])
  })

  it('finds voter comments and author replies on the target post', () => {
    const context = extractVoteContext(discussion(), {
      author: 'alice',
      permlink: 'post',
      voter: 'bob',
      voteTime: VOTE_TIME
    })
    expect(context.count).toBe(1)
    expect(context.hasVoterComment).toBe(true)
    expect(context.voterComments[0]).toMatchObject({
      author: 'bob',
      relativeToVote: 'before',
      link: '/@bob/re-1',
      parentLink: '/@alice/post'
    })
    expect(context.voterComments[0].excerpt).toContain('spam')
    expect(context.voterComments[0].excerpt).not.toContain('example.com')
    expect(context.keywords).toEqual(expect.arrayContaining(['downvote', 'because', 'spam']))
    expect(context.authorReplies[0]).toMatchObject({
      author: 'alice',
      relativeToVote: 'after',
      link: '/@alice/re-2'
    })
  })

  it('finds comments the voter left on the author’s other posts near the vote', () => {
    const posts = [
      {
        author: 'bob',
        permlink: 're-a',
        parent_author: 'alice',
        parent_permlink: 'other-post',
        created: '2026-11-27T10:00:00',
        body: 'Off-topic and repeated.'
      },
      {
        author: 'bob',
        permlink: 're-b',
        parent_author: 'alice',
        parent_permlink: 'far-post',
        created: '2026-10-01T10:00:00',
        body: 'This is outside the window.'
      },
      {
        author: 'bob',
        permlink: 're-c',
        parent_author: 'someone-else',
        parent_permlink: 'not-alice',
        created: '2026-11-27T11:00:00',
        body: 'Not about Alice.'
      }
    ]
    const context = extractVoterComments(posts, {
      voter: 'bob',
      author: 'alice',
      voteTime: VOTE_TIME,
      windowDays: 14
    })
    expect(context.count).toBe(1)
    expect(context.comments[0]).toMatchObject({
      permlink: 're-a',
      relativeToVote: 'before',
      link: '/@bob/re-a',
      parentLink: '/@alice/other-post'
    })
    expect(context.comments[0].keywords).toContain('off-topic')
  })

  it('merges contexts without repeating a comment already in the target thread', () => {
    const target = extractVoteContext(discussion(), {
      author: 'alice',
      permlink: 'post',
      voter: 'bob',
      voteTime: VOTE_TIME
    })
    const elsewhere = extractVoterComments([
      {
        author: 'bob',
        permlink: 're-1',
        parent_author: 'alice',
        parent_permlink: 'post',
        created: '2026-11-28T09:00:00',
        body: 'I downvoted this because the claim looks like spam.'
      },
      {
        author: 'bob',
        permlink: 're-3',
        parent_author: 'alice',
        parent_permlink: 'another-post',
        created: '2026-11-28T09:30:00',
        body: 'Also off-topic.'
      }
    ], {
      voter: 'bob',
      author: 'alice',
      voteTime: VOTE_TIME,
      windowDays: 14
    })
    const merged = mergeVoteContext(target, elsewhere)
    expect(merged.count).toBe(2)
    expect(merged.otherComments.map(comment => comment.permlink)).toEqual(['re-3'])
    expect(merged.keywords).toEqual(expect.arrayContaining(['spam', 'off-topic']))
  })
})
