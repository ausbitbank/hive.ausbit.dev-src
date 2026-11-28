import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_WATCHED, isWatched, loadWatchlist, toggleWatched } from '../../src/services/downvoteWatchlist'

beforeEach(() => {
  localStorage.clear()
})

describe('downvote watchlist', () => {
  it('adds, checks and removes a voter', () => {
    expect(loadWatchlist('viewer')).toEqual([])
    expect(toggleWatched('viewer', 'Bob')).toEqual(['bob'])
    expect(isWatched(loadWatchlist('viewer'), '@Bob')).toBe(true)
    expect(toggleWatched('viewer', 'bob')).toEqual([])
    expect(isWatched(loadWatchlist('viewer'), 'bob')).toBe(false)
  })

  it('keeps scopes separate, normalizes names and caps the list', () => {
    toggleWatched('alice', 'Bob')
    expect(loadWatchlist('bob')).toEqual([])
    expect(loadWatchlist('alice')).toEqual(['bob'])
    for (let index = 0; index < MAX_WATCHED + 5; index++) {
      toggleWatched('alice', 'voter' + index)
    }
    expect(loadWatchlist('alice')).toHaveLength(MAX_WATCHED)
    expect(loadWatchlist('alice')).toContain('voter204')
  })
})
