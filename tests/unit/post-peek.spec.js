import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyLocalPeekVote,
  closePostPeek,
  localVoteFor,
  noteLocalPeekVote,
  openPostPeek,
  openPostPeekFromRoute,
  parsePeekKey,
  peekKey,
  postPeek,
  resetLocalPeekVotes
} from '../../src/services/postPeek'

describe('quick-look post peek state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T12:00:00Z'))
    closePostPeek()
    resetLocalPeekVotes()
  })

  afterEach(() => {
    closePostPeek()
    resetLocalPeekVotes()
    vi.useRealTimers()
  })

  it('parses route keys with or without the leading @', () => {
    expect(parsePeekKey('@alice/hello-world')).toEqual({
      author: 'alice',
      permlink: 'hello-world',
      key: '@alice/hello-world'
    })
    expect(parsePeekKey('alice/hello-world')).toEqual({
      author: 'alice',
      permlink: 'hello-world',
      key: '@alice/hello-world'
    })
    expect(parsePeekKey('')).toBeNull()
    expect(parsePeekKey('@alice')).toBeNull()
    expect(parsePeekKey('@/hello')).toBeNull()
    expect(parsePeekKey('@alice/hello/world')).toBeNull()
    expect(peekKey('', 'hello')).toBe('')
  })

  it('opens from a card with the seed and increments the nonce once', () => {
    const post = { author: 'alice', permlink: 'hello-world', title: 'Hello' }
    expect(openPostPeek(post)).toBe(true)
    expect(postPeek.open).toBe(true)
    expect(postPeek.seed).toMatchObject({ author: 'alice', permlink: 'hello-world', title: 'Hello' })
    expect(postPeek.key).toBe('@alice/hello-world')
    expect(postPeek.openedFromCard).toBe(true)
    expect(postPeek.nonce).toBe(1)

    openPostPeek(post)
    expect(postPeek.nonce).toBe(1)
  })

  it('opens from the route without claiming a card origin', () => {
    openPostPeekFromRoute('alice', 'hello-world')
    expect(postPeek.open).toBe(true)
    expect(postPeek.seed).toMatchObject({ author: 'alice', permlink: 'hello-world' })
    expect(postPeek.openedFromCard).toBe(false)
  })

  it('closes and clears the active post', () => {
    openPostPeek({ author: 'alice', permlink: 'hello-world' })
    closePostPeek()
    expect(postPeek.open).toBe(false)
    expect(postPeek.seed).toBeNull()
    expect(postPeek.key).toBe('')
  })

  it('applies an optimistic vote for the matching voter only', () => {
    noteLocalPeekVote('alice', 'hello-world', 'bob', 100)
    const post = { author: 'alice', permlink: 'hello-world', active_votes: [] }

    expect(localVoteFor(post, 'carol')).toBeNull()
    expect(localVoteFor(post, 'bob')).toMatchObject({ direction: 1, weight: 100 })

    applyLocalPeekVote(post, 'bob')
    expect(post.active_votes).toHaveLength(1)
    expect(post.active_votes[0]).toMatchObject({ voter: 'bob', percent: 10000, rshares: 100 })
  })

  it('does not duplicate a vote already present in fresh chain data', () => {
    noteLocalPeekVote('alice', 'hello-world', 'bob', -100)
    const post = {
      author: 'alice',
      permlink: 'hello-world',
      active_votes: [{ voter: 'carol', rshares: 5 }, { voter: 'bob', rshares: -100 }]
    }
    applyLocalPeekVote(post, 'bob')
    expect(post.active_votes.filter(vote => vote.voter === 'bob')).toHaveLength(1)
    expect(post.active_votes[1].rshares).toBe(-100)
  })

  it('expires optimistic votes after the local TTL', () => {
    noteLocalPeekVote('alice', 'hello-world', 'bob', 100)
    const post = { author: 'alice', permlink: 'hello-world', active_votes: [] }
    const later = Date.now() + 10 * 60 * 1000 + 1
    expect(localVoteFor(post, 'bob', later)).toBeNull()
  })
})
