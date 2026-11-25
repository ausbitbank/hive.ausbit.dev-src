import { describe, expect, it } from 'vitest'
import { communityModerationContext } from '../../src/services/communityModeration'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'post-' + Math.random().toString(36).slice(2),
    title: 'A muted post',
    created: '2026-11-25T00:00:00',
    stats: {},
    ...overrides
  }
}

describe('communityModerationContext', () => {
  it('groups the current muted feed by bridge reason and keeps recent posts', () => {
    const posts = [
      post({ author: 'a', permlink: 'one', stats: { muted_reasons: [0] } }),
      post({ author: 'b', permlink: 'two', stats: { muted_reasons: [4] } }),
      post({ author: 'c', permlink: 'three', stats: { muted_reasons: [4, 3] } }),
      post({ author: 'd', permlink: 'hidden', stats: { hide: true } }),
      post({ author: 'e', permlink: 'grey', stats: { gray: true } }),
      post({ author: 'f', permlink: 'unknown', stats: {} }),
      { permlink: 'missing-author', stats: {} }
    ]

    const context = communityModerationContext({
      posts,
      community: {
        name: 'hive-1',
        flag_text: 'Be kind.',
        settings: { restricted: true },
        team: [
          ['owner', 'owner', 'Owner'],
          ['admin', 'admin', ''],
          ['mod-one', 'mod', 'Mod'],
          ['mod-two', 'mod', 'Mod']
        ]
      }
    })

    expect(context.mutedCount).toBe(6)
    const byKey = Object.fromEntries(context.reasons.map(row => [row.key, row]))
    expect(byKey['0']).toMatchObject({ label: 'Hidden by community moderation', count: 1 })
    expect(byKey['3']).toMatchObject({ label: 'Low reputation', count: 1 })
    expect(byKey['4']).toMatchObject({ label: 'Muted community role', count: 2 })
    expect(byKey.hidden.count).toBe(1)
    expect(byKey.gray.count).toBe(1)
    expect(byKey.unknown.count).toBe(1)
    expect(context.recent).toHaveLength(5)
    expect(context.recent[0]).toMatchObject({ author: 'a', permlink: 'one' })
    expect(context.reasons.some(row => row.code === null)).toBe(true)
    expect(context.roles).toEqual([
      { role: 'owner', count: 1 },
      { role: 'admin', count: 1 },
      { role: 'mod', count: 2 }
    ])
    expect(context.teamSize).toBe(4)
    expect(context.flagText).toBe('Be kind.')
    expect(context.restricted).toBe(true)
    expect(context.nsfw).toBe(false)
    expect(context.mutedFeed).toBe('/muted/hive-1')
  })

  it('distinguishes a missing reason field from a known category', () => {
    const context = communityModerationContext({
      posts: [post({ stats: { muted_reasons: [9] } })]
    })
    expect(context.hasReasons).toBe(false)
    expect(context.reasons).toEqual([{
      key: 'unknown-code',
      code: null,
      label: 'Unrecognised bridge reason',
      hint: 'Bridge returned a reason code this client does not recognise.',
      count: 1
    }])
  })

  it('handles an empty feed and missing community record', () => {
    const context = communityModerationContext()
    expect(context.mutedCount).toBe(0)
    expect(context.reasons).toEqual([])
    expect(context.recent).toEqual([])
    expect(context.roles).toEqual([])
    expect(context.teamSize).toBe(0)
    expect(context.mutedFeed).toBe('')
    expect(context.flagText).toBe('')
  })

  it('truncates long titles and tolerates object-shaped team rows', () => {
    const context = communityModerationContext({
      posts: [post({ title: 'x'.repeat(300) })],
      community: {
        name: 'hive-2',
        team: [{ account: 'Alice', role: 'Admin', title: 'Lead' }]
      }
    })
    expect(context.recent[0].title).toHaveLength(120)
    expect(context.recent[0].title.endsWith('…')).toBe(true)
    expect(context.roles).toEqual([{ role: 'admin', count: 1 }])
  })
})
