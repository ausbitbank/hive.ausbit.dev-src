import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bridgeRequest: vi.fn(),
  fetchFollowingNames: vi.fn(),
  loadCached: vi.fn((_key, fetcher) => fetcher())
}))

vi.mock('../../src/services/api', () => ({
  bridgeRequest: mocks.bridgeRequest
}))

vi.mock('../../src/services/chainData', () => ({
  fetchFollowingNames: mocks.fetchFollowingNames
}))

vi.mock('../../src/services/cache', () => ({
  loadCached: mocks.loadCached
}))

const {
  fetchModerationListEntries,
  fetchModerationListNames,
  fetchModerationListSnapshot,
  fetchViewerModerationContext,
  MODERATION_LIST_MAX,
  moderationListCacheKey
} = await import('../../src/services/moderationData')

beforeEach(() => {
  mocks.bridgeRequest.mockReset()
  mocks.fetchFollowingNames.mockReset()
  mocks.loadCached.mockReset()
  mocks.loadCached.mockImplementation((_key, fetcher) => fetcher())
})

describe('moderation list reads', () => {
  it('normalizes, lowercases and dedupes rows while keeping descriptions', async () => {
    mocks.bridgeRequest.mockResolvedValue([
      { name: 'Alice', muted_list_description: '' },
      { name: 'alice', muted_list_description: 'duplicate' },
      { name: 'bob', blacklist_description: 'Spam ring' },
      { name: '' }
    ])

    const entries = await fetchModerationListEntries('@viewer', 'muted')
    expect(entries).toEqual([
      { name: 'alice', description: '' },
      { name: 'bob', description: 'Spam ring' }
    ])
    expect(mocks.bridgeRequest).toHaveBeenCalledWith('get_follow_list', {
      observer: 'viewer',
      follow_type: 'muted'
    })
  })

  it('maps entries to names', async () => {
    mocks.bridgeRequest.mockResolvedValue([{ name: 'Alice' }, { name: 'bob' }])
    await expect(fetchModerationListNames('viewer', 'blacklisted')).resolves.toEqual(['alice', 'bob'])
  })

  it('reports a bounded list index instead of silently truncating it', async () => {
    mocks.bridgeRequest.mockResolvedValue(
      Array.from({ length: MODERATION_LIST_MAX + 2 }, (_, index) => ({ name: 'user' + index }))
    )

    const snapshot = await fetchModerationListSnapshot('viewer', 'muted')
    expect(snapshot.entries).toHaveLength(MODERATION_LIST_MAX)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.total).toBe(MODERATION_LIST_MAX + 2)
  })

  it('does not mark an exactly-capped list as truncated', async () => {
    mocks.bridgeRequest.mockResolvedValue(
      Array.from({ length: MODERATION_LIST_MAX }, (_, index) => ({ name: 'user' + index }))
    )

    const snapshot = await fetchModerationListSnapshot('viewer', 'muted')
    expect(snapshot.entries).toHaveLength(MODERATION_LIST_MAX)
    expect(snapshot.truncated).toBe(false)
  })

  it('rejects a malformed list instead of pretending it is empty', async () => {
    mocks.bridgeRequest.mockResolvedValue({ error: 'schema stub' })
    await expect(fetchModerationListEntries('viewer', 'muted')).rejects.toThrow('Unexpected moderation list response')
  })

  it('rejects an unsupported list type', () => {
    expect(() => fetchModerationListEntries('viewer', 'blog')).toThrow('Unsupported moderation list type')
  })

  it('returns an empty list without a network call for a missing account', async () => {
    await expect(fetchModerationListEntries('', 'muted')).resolves.toEqual([])
    expect(mocks.bridgeRequest).not.toHaveBeenCalled()
  })

  it('uses a viewer-and-type cache key', () => {
    expect(moderationListCacheKey('@Alice', 'muted')).toBe('moderation:list:muted:alice')
  })
})

describe('viewer moderation context', () => {
  function listFor (observer, followType) {
    if (observer === 'viewer' && followType === 'muted') return [{ name: 'alice' }]
    if (observer === 'viewer' && followType === 'blacklisted') return [{ name: 'mallory' }]
    if (observer === 'viewer' && followType === 'follow_muted') {
      return [{ name: 'hive.blog', muted_list_description: 'Phishing accounts' }]
    }
    if (observer === 'viewer' && followType === 'follow_blacklist') {
      return [{ name: 'watchlist', blacklist_description: 'Warnings' }]
    }
    if (observer === 'hive.blog' && followType === 'muted') return [{ name: 'alice' }, { name: 'spam' }]
    return []
  }

  it('resolves the viewer lists, follows and subscribed list members', async () => {
    mocks.bridgeRequest.mockImplementation((_method, params) => (
      Promise.resolve(listFor(params.observer, params.follow_type))
    ))
    mocks.fetchFollowingNames.mockResolvedValue(['Bob', '@carol'])

    const context = await fetchViewerModerationContext('@Viewer')
    expect(context.status).toBe('ready')
    expect(context.muted).toEqual(['alice'])
    expect(context.blacklisted).toEqual(['mallory'])
    expect(context.following).toEqual(['bob', 'carol'])
    expect(context.followedMuteOwners).toEqual([
      { name: 'hive.blog', description: 'Phishing accounts' }
    ])
    expect(context.followedBlacklistOwners).toEqual([
      { name: 'watchlist', description: 'Warnings' }
    ])
    expect(context.followedMuteLists).toEqual([
      { owner: 'hive.blog', members: ['alice', 'spam'] }
    ])
    expect(context.listErrors).toBe(0)
    expect(context.listTruncated).toEqual([])
  })

  it('records a partial subscribed list index in the viewer context', async () => {
    const large = Array.from({ length: MODERATION_LIST_MAX + 1 }, (_, index) => ({ name: 'user' + index }))
    mocks.bridgeRequest.mockImplementation((_method, params) => {
      if (params.observer === 'viewer' && params.follow_type === 'follow_muted') {
        return Promise.resolve([{ name: 'hive.blog' }])
      }
      if (params.observer === 'hive.blog' && params.follow_type === 'muted') {
        return Promise.resolve(large)
      }
      return Promise.resolve([])
    })
    mocks.fetchFollowingNames.mockResolvedValue([])

    const context = await fetchViewerModerationContext('viewer')
    expect(context.listTruncated).toEqual([{
      owner: 'hive.blog',
      type: 'muted',
      indexed: MODERATION_LIST_MAX,
      total: MODERATION_LIST_MAX + 1
    }])
    expect(context.followedMuteLists[0].members).toHaveLength(MODERATION_LIST_MAX)
  })

  it('counts a failed subscribed list instead of failing the whole context', async () => {
    mocks.bridgeRequest.mockImplementation((_method, params) => {
      if (params.observer === 'hive.blog' && params.follow_type === 'muted') {
        return Promise.reject(new Error('node down'))
      }
      return Promise.resolve(listFor(params.observer, params.follow_type))
    })
    mocks.fetchFollowingNames.mockResolvedValue([])

    const context = await fetchViewerModerationContext('viewer')
    expect(context.status).toBe('ready')
    expect(context.listErrors).toBe(1)
    expect(context.followedMuteLists).toEqual([])
  })

  it('does not fail the whole context when a blacklist warning list is unavailable', async () => {
    mocks.bridgeRequest.mockImplementation((_method, params) => {
      if (params.observer === 'viewer' && params.follow_type === 'blacklisted') {
        return Promise.reject(new Error('node down'))
      }
      return Promise.resolve(listFor(params.observer, params.follow_type))
    })
    mocks.fetchFollowingNames.mockResolvedValue([])

    const context = await fetchViewerModerationContext('viewer')
    expect(context.status).toBe('ready')
    expect(context.blacklisted).toEqual([])
    expect(context.muted).toEqual(['alice'])
  })

  it('counts lists beyond the resolution cap', async () => {
    mocks.bridgeRequest.mockImplementation((_method, params) => (
      Promise.resolve(
        params.observer === 'viewer' && params.follow_type === 'follow_muted'
          ? [{ name: 'one' }, { name: 'two' }]
          : []
      )
    ))
    mocks.fetchFollowingNames.mockResolvedValue([])

    const context = await fetchViewerModerationContext('viewer', { maxFollowedLists: 0 })
    expect(context.listErrors).toBe(2)
  })

  it('returns a ready empty context for a missing account', async () => {
    const context = await fetchViewerModerationContext('')
    expect(context.status).toBe('ready')
    expect(context.muted).toEqual([])
    expect(mocks.bridgeRequest).not.toHaveBeenCalled()
  })
})
