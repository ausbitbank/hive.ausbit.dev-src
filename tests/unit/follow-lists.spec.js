import { describe, expect, it } from 'vitest'
import {
  buildListSubscription,
  isSubscribed,
  isValidListOwner,
  listMemberCount,
  ownerRelationship
} from '../../src/services/followLists'

const context = {
  following: ['blogowner'],
  muted: ['ignored'],
  blacklisted: ['warned'],
  followedMuteOwners: [{ name: 'hive.blog', description: 'Phishing' }],
  followedBlacklistOwners: [{ name: 'watchlist', description: 'Warnings' }],
  followedMuteLists: [{ owner: 'hive.blog', members: ['a', 'b', 'c'] }],
  followedBlacklistLists: [{ owner: 'watchlist', members: ['d'] }]
}

describe('follow list subscriptions', () => {
  it('validates owner names', () => {
    expect(isValidListOwner('@hive.blog')).toBe(true)
    expect(isValidListOwner('a')).toBe(false)
    expect(isValidListOwner('not a name!')).toBe(false)
  })

  it('maps every relationship flag for the list owner', () => {
    expect(ownerRelationship('@hive.blog', context)).toEqual({
      follows: false,
      ignores: false,
      blacklists: false,
      follows_muted: true,
      follows_blacklists: false
    })
    expect(ownerRelationship('blogowner', context).follows).toBe(true)
  })

  it('preserves existing flags when subscribing or unsubscribing', () => {
    const subscribe = buildListSubscription('viewer', 'hive.blog', 'mute', {
      subscribe: true,
      context: { ...context, following: ['hive.blog'] }
    })
    const payload = JSON.parse(subscribe[2][1].json)[1]
    expect(payload.following).toBe('hive.blog')
    expect(payload.what).toEqual(['blog', 'follow_muted'])

    const unsubscribe = buildListSubscription('viewer', 'hive.blog', 'mute', {
      subscribe: false,
      context: { ...context, following: ['hive.blog'] }
    })
    expect(JSON.parse(unsubscribe[2][1].json)[1].what).toEqual(['blog'])
  })

  it('builds a blacklist subscription and rejects bad owners', () => {
    const op = buildListSubscription('viewer', 'watchlist', 'blacklist', { subscribe: true })
    expect(JSON.parse(op[2][1].json)[1].what).toEqual(['follow_blacklist'])
    expect(buildListSubscription('viewer', 'viewer', 'mute', {})).toBeNull()
    expect(buildListSubscription('viewer', 'x', 'mute', {})).toBeNull()
  })

  it('reports membership and owner subscription state', () => {
    expect(isSubscribed('hive.blog', 'mute', context)).toBe(true)
    expect(isSubscribed('watchlist', 'blacklist', context)).toBe(true)
    expect(isSubscribed('other', 'mute', context)).toBe(false)
    expect(listMemberCount('hive.blog', 'mute', context)).toBe(3)
    expect(listMemberCount('unknown', 'mute', context)).toBeNull()
  })
})
