import { describe, expect, it, vi } from 'vitest'
import {
  SHORT_FORM_BENEFICIARY,
  fetchAccountShortPosts,
  fetchLikedShortPosts,
  fetchReactionNotifications,
  shortFormatProfile
} from '../../src/services/shortFormLikes'

function thread (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'thread-1',
    parent_author: '',
    parent_permlink: '',
    category: 'hive-167922',
    depth: 0,
    created: '2026-01-01T00:00:00',
    json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] },
    body: 'hello',
    ...overrides
  }
}

function notification (id, type, url, msg = {}) {
  return { id, type, url, date: '2026-01-01T00:0' + id + ':00', msg: JSON.stringify(msg) }
}

describe('fetchReactionNotifications', () => {
  it('pages through notifications, dedupes target URLs and skips the account itself', async () => {
    const request = vi.fn(async (method, params) => {
      if (params.last_id) return []
      return [
        notification('1', 'vote', '/@bob/one', { voter: 'alice', author: 'bob', permlink: 'one' }),
        notification('2', 'reply', '/@alice/own', { author: 'bob', permlink: 'own' }),
        notification('3', 'mention', '/@carol/two', { author: 'carol', permlink: 'two' }),
        notification('4', 'mention', '/@carol/two', { author: 'carol', permlink: 'two' }),
        notification('5', 'transfer', '/@bob/ignored'),
        notification('6', 'reblog', '/@dave/three')
      ]
    })

    const rows = await fetchReactionNotifications('@Alice', { request })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('bridge.account_notifications', { account: 'alice', limit: 100 })
    expect(rows).toEqual([
      { author: 'bob', permlink: 'one', created: '2026-01-01T00:01:00', type: 'vote' },
      { author: 'carol', permlink: 'two', created: '2026-01-01T00:03:00', type: 'mention' },
      { author: 'dave', permlink: 'three', created: '2026-01-01T00:06:00', type: 'reblog' }
    ])
  })

  it('passes last_id on the next page and stops when a short page arrives', async () => {
    const request = vi.fn(async (method, params) => {
      if (!params.last_id) {
        return Array.from({ length: 3 }, (_, index) => notification(String(index + 1), 'mention', '/@bob/p' + index))
      }
      return [notification('9', 'mention', '/@bob/last')]
    })
    const rows = await fetchReactionNotifications('alice', { request, pages: 3, limit: 3 })
    expect(rows).toHaveLength(4)
    expect(request).toHaveBeenLastCalledWith('bridge.account_notifications', { account: 'alice', limit: 3, last_id: 3 })
  })

  it('stops quietly when the request fails or returns no rows', async () => {
    const failing = vi.fn(async () => { throw new Error('node down') })
    expect(await fetchReactionNotifications('alice', { request: failing })).toEqual([])

    const empty = vi.fn(async () => [])
    expect(await fetchReactionNotifications('alice', { request: empty })).toEqual([])
  })
})

describe('fetchAccountShortPosts', () => {
  it('keeps only short forms and stops on a short page', async () => {
    const request = vi.fn(async () => [
      thread({ permlink: 'one' }),
      { author: 'alice', permlink: 'long', category: 'life', json_metadata: { tags: ['life'] }, body: 'long' },
      { author: 'peak.snaps', permlink: 'snap-container-1', category: 'hive-124838' }
    ])

    const rows = await fetchAccountShortPosts('@Alice', request)
    expect(rows.map(row => row.permlink)).toEqual(['one'])
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('bridge.get_account_posts', { sort: 'posts', account: 'alice', limit: 20 })
  })

  it('pages with the last post as the cursor when a full page arrives', async () => {
    const request = vi.fn(async (method, params) => {
      if (!params.start_permlink) {
        return Array.from({ length: 20 }, (_, index) => thread({ permlink: 'p' + index }))
      }
      return [thread({ permlink: 'last' })]
    })

    const rows = await fetchAccountShortPosts('alice', request)
    expect(rows).toHaveLength(21)
    expect(request).toHaveBeenLastCalledWith('bridge.get_account_posts', {
      sort: 'posts',
      account: 'alice',
      limit: 20,
      start_author: 'alice',
      start_permlink: 'p19'
    })
  })

  it('returns an empty list for a missing account or failing reads', async () => {
    expect(await fetchAccountShortPosts('', vi.fn())).toEqual([])
    const failing = vi.fn(async () => { throw new Error('node down') })
    expect(await fetchAccountShortPosts('alice', failing)).toEqual([])
  })
})

describe('fetchLikedShortPosts', () => {
  it('requires an account and a request function', async () => {
    expect(await fetchLikedShortPosts('', { request: vi.fn() })).toEqual([])
    expect(await fetchLikedShortPosts('alice', {})).toEqual([])
  })

  it('dedupes candidates, enriches comments and sorts newest first', async () => {
    const request = vi.fn(async (method, params) => {
      if (method === 'bridge.account_notifications') {
        return [
          notification('1', 'mention', '/@bob/mention', { author: 'bob', permlink: 'mention' })
        ]
      }
      if (method === 'bridge.get_account_posts') {
        return [
          thread({ permlink: 'own-old', created: '2026-01-01T00:00:00' }),
          thread({ permlink: 'own-new', created: '2026-01-03T00:00:00' })
        ]
      }
      if (method === 'bridge.get_post') {
        if (params.author === 'bob') {
          return {
            author: 'bob',
            permlink: 'mention',
            parent_author: 'peak.snaps',
            parent_permlink: 'snap-container-1',
            depth: 1,
            created: '2026-01-02T00:00:00',
            json_metadata: { tags: ['snaps'] }
          }
        }
        if (params.author === 'peak.snaps') {
          return { author: 'peak.snaps', permlink: 'snap-container-1', title: 'Snaps' }
        }
      }
      return null
    })

    const rows = await fetchLikedShortPosts('alice', { request })
    expect(rows.map(row => row.permlink)).toEqual(['own-new', 'mention', 'own-old'])
    expect(rows[1]._container).toEqual({ author: 'peak.snaps', permlink: 'snap-container-1', title: 'Snaps' })
    expect(rows.every(row => row.format)).toBe(true)
  })

  it('drops containers, failures and candidates over the limit', async () => {
    const request = vi.fn(async (method, _params) => {
      if (method === 'bridge.account_notifications') {
        return [
          notification('1', 'mention', '/@peak.snaps/container', {}),
          notification('2', 'mention', '/@bob/missing', {})
        ]
      }
      if (method === 'bridge.get_account_posts') return []
      if (method === 'bridge.get_post') return null
      return null
    })

    expect(await fetchLikedShortPosts('alice', { request, limit: 5 })).toEqual([])

    const many = vi.fn(async (method, _params) => {
      if (method === 'bridge.account_notifications') return []
      if (method === 'bridge.get_account_posts') {
        return Array.from({ length: 30 }, (_, index) => thread({
          permlink: 'p' + index,
          created: '2026-01-01T00:00:' + String(index).padStart(2, '0')
        }))
      }
      return null
    })
    const limited = await fetchLikedShortPosts('alice', { request: many, limit: 5 })
    expect(limited).toHaveLength(5)
  })
})

describe('shortFormatProfile', () => {
  it('returns the public profile and the app beneficiary constant', async () => {
    expect(shortFormatProfile('threads').label).toBe('Threads')
    expect(shortFormatProfile('nope')).toBeNull()
    expect(SHORT_FORM_BENEFICIARY).toBe('ausbitbank')
  })
})
