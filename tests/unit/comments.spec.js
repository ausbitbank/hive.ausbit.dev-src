import { describe, expect, it } from 'vitest'
import {
  COMMENT_SORT_OPTIONS,
  commentQueueItem,
  countDiscussion,
  deleteCommentQueueItem,
  flattenDiscussion,
  formatReputation
} from '../../src/services/comments'

function comment (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'comment',
    created: '2026-01-01T00:00:00',
    net_rshares: 0,
    children: 0,
    depth: 1,
    replies: [],
    stats: { gray: false, hide: false },
    ...overrides
  }
}

function discussion (rootReplies = []) {
  const root = {
    author: 'poster',
    permlink: 'post',
    depth: 0,
    replies: rootReplies,
    stats: { gray: false, hide: false }
  }
  return { 'poster/post': root }
}

describe('comment helpers', () => {
  it('flattens replies depth-first with 1-based depths', () => {
    const a = comment({ author: 'a', permlink: 'one', replies: ['b/two'] })
    const b = comment({ author: 'b', permlink: 'two', depth: 2 })
    const c = comment({ author: 'c', permlink: 'three' })
    const map = {
      ...discussion(['a/one', 'c/three']),
      'a/one': a,
      'b/two': b,
      'c/three': c
    }

    const flat = flattenDiscussion(map, 'poster/post', { sort: 'old' })
    expect(flat.map(item => item.key)).toEqual(['a/one', 'b/two', 'c/three'])
    expect(flat.map(item => item.depth)).toEqual([1, 2, 1])
  })

  it('sorts sibling groups by the selected method', () => {
    const a = comment({ author: 'a', permlink: 'one', net_rshares: 10, created: '2026-01-01T00:00:00' })
    const b = comment({ author: 'b', permlink: 'two', net_rshares: 30, created: '2026-02-01T00:00:00' })
    const c = comment({ author: 'c', permlink: 'three', net_rshares: 20, created: '2026-03-01T00:00:00' })
    const map = {
      ...discussion(['a/one', 'b/two', 'c/three']),
      'a/one': a,
      'b/two': b,
      'c/three': c
    }

    expect(flattenDiscussion(map, 'poster/post', { sort: 'best' }).map(i => i.key)).toEqual(['b/two', 'c/three', 'a/one'])
    expect(flattenDiscussion(map, 'poster/post', { sort: 'new' }).map(i => i.key)).toEqual(['c/three', 'b/two', 'a/one'])
    expect(flattenDiscussion(map, 'poster/post', { sort: 'old' }).map(i => i.key)).toEqual(['a/one', 'b/two', 'c/three'])
  })

  it('includes hidden comments and their subtrees so the UI can collapse them', () => {
    const hidden = comment({ author: 'spam', permlink: 'hidden', stats: { gray: false, hide: true }, replies: ['kid/reply'] })
    const kid = comment({ author: 'kid', permlink: 'reply' })
    const visible = comment({ author: 'ok', permlink: 'visible' })
    const map = {
      ...discussion(['spam/hidden', 'ok/visible']),
      'spam/hidden': hidden,
      'kid/reply': kid,
      'ok/visible': visible
    }

    expect(flattenDiscussion(map, 'poster/post').map(i => i.key)).toEqual(['spam/hidden', 'kid/reply', 'ok/visible'])
    expect(flattenDiscussion(map, 'poster/post', { showFiltered: true }).map(i => i.key)).toEqual(['spam/hidden', 'kid/reply', 'ok/visible'])
  })

  it('falls back to the map when the root post is absent', () => {
    const a = comment({ author: 'a', permlink: 'one', depth: 1 })
    const b = comment({ author: 'b', permlink: 'two', depth: 2 })
    const flat = flattenDiscussion({ 'a/one': a, 'b/two': b }, 'poster/post', { sort: 'old' })
    expect(flat.map(i => i.key)).toEqual(['a/one', 'b/two'])
    expect(flat.map(i => i.depth)).toEqual([1, 2])
  })

  it('counts comments without the root post', () => {
    const map = { 'poster/post': comment(), 'a/one': comment(), 'b/two': comment() }
    expect(countDiscussion(map, 'poster/post')).toBe(2)
    expect(countDiscussion(null, 'poster/post')).toBe(0)
  })

  it('formats reputation like PeakD and exposes sort options', () => {
    expect(formatReputation(295634214098804)).toBe('74')
    expect(formatReputation(0)).toBe('25')
    expect(formatReputation(undefined)).toBe('25')
    expect(COMMENT_SORT_OPTIONS.map(option => option.value)).toEqual(['best', 'new', 'old', 'replies'])
  })
})

describe('comment queue item', () => {
  it('builds a posting-key comment operation for a reply', () => {
    const item = commentQueueItem({
      username: 'alice',
      parentAuthor: 'bob',
      parentPermlink: 'parent-comment',
      body: 'Hello **world**',
      permlink: 're-bob-parent-comment-20261117t120000000z'
    })

    expect(item[0]).toBe('alice')
    expect(item[1]).toBe('posting')
    expect(item[2][0]).toBe('comment')
    expect(item[2][1]).toMatchObject({
      parent_author: 'bob',
      parent_permlink: 'parent-comment',
      author: 'alice',
      permlink: 're-bob-parent-comment-20261117t120000000z',
      title: '',
      body: 'Hello **world**'
    })
    expect(JSON.parse(item[2][1].json_metadata)).toEqual({ app: 'banksia.io', format: 'markdown' })
    expect(item[2][1].comment_options).toMatchObject({
      author: 'alice',
      permlink: 're-bob-parent-comment-20261117t120000000z',
      max_accepted_payout: '100000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true
    })
    expect(item[2][1].comment_options.extensions).toEqual([])
  })

  it('builds an edit without comment options and preserves metadata', () => {
    const item = commentQueueItem({
      username: 'alice',
      mode: 'edit',
      parentAuthor: 'bob',
      parentPermlink: 'post',
      author: 'alice',
      permlink: 're-existing',
      body: 'Updated text',
      previousMetadata: { image: ['https://img.example/a.png'] }
    })
    const operation = item[2][1]
    expect(operation).toMatchObject({
      parent_author: 'bob',
      parent_permlink: 'post',
      author: 'alice',
      permlink: 're-existing',
      body: 'Updated text',
      _edit: true
    })
    expect(operation.comment_options).toBeUndefined()
    expect(JSON.parse(operation.json_metadata)).toMatchObject({
      app: 'banksia.io',
      format: 'markdown',
      image: ['https://img.example/a.png']
    })
  })

  it('includes valid beneficiaries', () => {
    const item = commentQueueItem({
      username: 'alice',
      parentAuthor: 'bob',
      parentPermlink: 'post',
      body: 'Reply',
      permlink: 're-bob-post-1',
      beneficiaries: [{ account: 'ausbitbank', weight: 1000 }, { account: '', weight: 100 }]
    })
    expect(item[2][1].comment_options.extensions).toEqual([[0, { beneficiaries: [{ account: 'ausbitbank', weight: 1000 }] }]])
  })

  it('builds a delete_comment operation', () => {
    const item = deleteCommentQueueItem({ username: 'alice', author: 'alice', permlink: 're-old' })
    expect(item).toEqual(['alice', 'posting', ['delete_comment', { author: 'alice', permlink: 're-old' }]])
  })

  it('refuses to queue a delete under another author', () => {
    expect(() => deleteCommentQueueItem({ username: 'alice', author: 'bob', permlink: 're-old' }))
      .toThrow(/signed-in author/)
    expect(() => deleteCommentQueueItem({ username: '', author: '', permlink: 're-old' }))
      .toThrow(/signed-in author/)
  })
})
