import { describe, expect, it, vi } from 'vitest'
import {
  MAX_SHORT_BODY_BYTES,
  SHORT_FORM_FORMATS,
  containerTimeline,
  detectShortForm,
  fetchShortFormFeed,
  fetchShortFormPost,
  getShortFormat,
  isShortFormContainer,
  isTopLevelShortForm,
  shortFormatList,
  shortFormPermlink,
  shortFormQueueItem,
  shortFormQueueSummary,
  shortFormUrl,
  shortImages,
  shortPreview
} from '../../src/services/shortForm'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'post-1',
    parent_author: '',
    parent_permlink: '',
    category: '',
    depth: 0,
    created: '2026-01-01T00:00:00',
    json_metadata: {},
    body: 'hello',
    stats: { gray: false, hide: false },
    ...overrides
  }
}

describe('short-form formats', () => {
  it('lists every format once with a stable profile', () => {
    const list = shortFormatList()
    expect(list.map(format => format.id)).toEqual(SHORT_FORM_FORMATS)
    expect(list.every(format => format.label && format.community)).toBe(true)
    expect(getShortFormat('nope')).toBeNull()
  })
})

describe('detectShortForm', () => {
  it('recognises a snap as a comment on a peak.snaps container', () => {
    const snap = post({
      parent_author: 'peak.snaps',
      parent_permlink: 'snap-container-1795003920',
      depth: 1,
      json_metadata: { app: 'peakd/2026.11.4', tags: ['snaps'] }
    })
    expect(detectShortForm(snap)).toBe('snaps')
    expect(isShortFormContainer(post({ author: 'peak.snaps', permlink: 'snap-container-1795003920' }))).toBe(true)
  })

  it('recognises a wave from the ecency.waves container', () => {
    expect(detectShortForm(post({
      parent_author: 'ecency.waves',
      parent_permlink: 'waves-20261118mhm2lx',
      json_metadata: { app: 'ecency/3.5.11-mobile', type: 'wave' }
    }))).toBe('waves')
  })

  it('recognises a moment from the liketu.moments container', () => {
    expect(detectShortForm(post({
      parent_author: 'liketu.moments',
      parent_permlink: 'liketu-moments-2026-11-12-01'
    }))).toBe('moments')
  })

  it('recognises an inleo thread from its app name and tag', () => {
    const thread = post({ category: 'hive-167922', json_metadata: { app: 'leothreads/0.3', tags: ['inleo', 'leo'] } })
    expect(detectShortForm(thread)).toBe('threads')
  })

  it('recognises a D.Buzz short post', () => {
    const buzz = post({ category: 'hive-193084', json_metadata: { app: 'dBuzz/v3.0.0', shortForm: true } })
    expect(detectShortForm(buzz)).toBe('dbuzz')
  })

  it('returns null for ordinary posts and comments', () => {
    expect(detectShortForm(post({ category: 'life', json_metadata: { app: 'peakd/2026', tags: ['life'] } }))).toBeNull()
    expect(detectShortForm(post({ parent_author: 'bob', parent_permlink: 'a-post' }))).toBeNull()
    expect(isTopLevelShortForm(post({ category: 'life' }))).toBe(false)
    expect(isTopLevelShortForm(post({ category: 'hive-167922', json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] } }))).toBe(true)
  })

  it('accepts string json_metadata from the condenser API', () => {
    const thread = post({ json_metadata: JSON.stringify({ app: 'leothreads/0.3', tags: ['inleo'] }) })
    expect(detectShortForm(thread)).toBe('threads')
  })
})

describe('containerTimeline', () => {
  const root = 'peak.snaps/snap-container-1'
  const discussion = {
    [root]: { author: 'peak.snaps', permlink: 'snap-container-1', depth: 0, replies: ['alice/older', 'bob/newer'] },
    'alice/older': post({ author: 'alice', permlink: 'older', depth: 1, created: '2026-01-01T00:00:00' }),
    'bob/newer': post({ author: 'bob', permlink: 'newer', depth: 1, created: '2026-01-02T00:00:00' }),
    'carol/hidden': post({ author: 'carol', permlink: 'hidden', depth: 1, stats: { gray: true } })
  }

  it('returns direct comments newest first and drops hidden ones', () => {
    const { container, items } = containerTimeline(discussion, root)
    expect(container.author).toBe('peak.snaps')
    expect(items.map(item => item.permlink)).toEqual(['newer', 'older'])
  })

  it('caps the timeline at the requested limit', () => {
    expect(containerTimeline(discussion, root, { limit: 1 }).items).toHaveLength(1)
  })

  it('falls back to depth when the root is absent', () => {
    const partial = { 'alice/older': discussion['alice/older'] }
    expect(containerTimeline(partial, root).items.map(item => item.permlink)).toEqual(['older'])
  })
})

describe('preview, images and urls', () => {
  it('drops images, links and markdown noise from previews', () => {
    const body = '## Title\n\n![](https://img/x.jpg) Hello [world](https://x) **bold**'
    expect(shortPreview(body)).toBe('Title Hello world bold')
  })

  it('truncates long previews with an ellipsis', () => {
    const preview = shortPreview('a'.repeat(300), 20)
    expect(preview).toHaveLength(20)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('lists only http(s) image urls', () => {
    const images = shortImages(post({ json_metadata: { image: ['https://a/1.png', 'ftp://bad', 42] } }))
    expect(images).toEqual(['https://a/1.png'])
  })

  it('prefers the inleo canonical url for threads', () => {
    const thread = post({ json_metadata: { canonical_url: 'https://inleo.io/threads/view/alice/post-1' } })
    expect(shortFormUrl(thread, 'threads')).toBe('https://inleo.io/threads/view/alice/post-1')
    expect(shortFormUrl(post(), 'snaps')).toBe('https://peakd.com/@alice/post-1')
  })
})

describe('shortFormQueueItem', () => {
  const container = { author: 'peak.snaps', permlink: 'snap-container-1' }

  it('posts a snap as a comment on the container without reward options', () => {
    const [owner, key, op] = shortFormQueueItem({
      format: 'snaps',
      username: 'Alice',
      body: '  a quick snap  ',
      parent: container,
      permlink: 'snap-x'
    })
    expect(owner).toBe('alice')
    expect(key).toBe('posting')
    expect(op[0]).toBe('comment')
    expect(op[1]).toMatchObject({
      parent_author: 'peak.snaps',
      parent_permlink: 'snap-container-1',
      author: 'alice',
      permlink: 'snap-x',
      title: '',
      body: 'a quick snap'
    })
    expect(op[1].comment_options).toBeUndefined()
    const metadata = JSON.parse(op[1].json_metadata)
    expect(metadata.tags).toEqual(['hive-124838', 'snaps'])
  })

  it('posts a thread as a top-level post with reward options in the community', () => {
    const [, , op] = shortFormQueueItem({ format: 'threads', username: 'alice', body: 'gm', permlink: 't-1' })
    expect(op[1].parent_author).toBe('')
    expect(op[1].parent_permlink).toBe('hive-167922')
    expect(op[1].comment_options).toMatchObject({ author: 'alice', permlink: 't-1' })
    const metadata = JSON.parse(op[1].json_metadata)
    expect(metadata).toMatchObject({ type: 'post' })
    expect(metadata.tags[0]).toBe('hive-167922')
    expect(metadata.tags).toContain('inleo')
  })

  it('flags D.Buzz posts with shortForm metadata', () => {
    const [, , op] = shortFormQueueItem({ format: 'dbuzz', username: 'alice', body: 'buzz', permlink: 'b-1' })
    expect(JSON.parse(op[1].json_metadata).shortForm).toBe(true)
    expect(op[1].parent_permlink).toBe('hive-193084')
  })

  it('replies target the parent post instead of the container', () => {
    const [, , op] = shortFormQueueItem({
      format: 'moments',
      username: 'alice',
      body: 'nice',
      parent: container,
      reply: { author: 'bob', permlink: 'bob-moment' },
      permlink: 'r-1'
    })
    expect(op[1]).toMatchObject({ parent_author: 'bob', parent_permlink: 'bob-moment' })
    expect(op[1].comment_options).toBeUndefined()
  })

  it('requires a container for container formats', () => {
    expect(() => shortFormQueueItem({ format: 'waves', username: 'alice', body: 'x', permlink: 'w-1' }))
      .toThrow(/container/)
  })

  it('rejects empty bodies, bad accounts, oversized bodies and bad permlinks', () => {
    expect(() => shortFormQueueItem({ format: 'snaps', username: 'alice', body: '   ', parent: container })).toThrow(/Write/)
    expect(() => shortFormQueueItem({ format: 'snaps', username: 'A', body: 'x', parent: container })).toThrow(/account/)
    expect(() => shortFormQueueItem({
      format: 'snaps',
      username: 'alice',
      body: 'x'.repeat(MAX_SHORT_BODY_BYTES + 1),
      parent: container
    })).toThrow(/limit/)
    expect(() => shortFormQueueItem({ format: 'snaps', username: 'alice', body: 'x', parent: container, permlink: 'Bad Link' })).toThrow(/permlink/)
    expect(() => shortFormQueueItem({ format: 'unknown', username: 'alice', body: 'x' })).toThrow(/Unknown/)
  })

  it('summarises a queued post for the signing queue', () => {
    const item = shortFormQueueItem({ format: 'snaps', username: 'alice', body: 'x', parent: container, permlink: 's-1' })
    expect(shortFormQueueSummary(item)).toBe('Reply to @peak.snaps/s-1')
    const thread = shortFormQueueItem({ format: 'threads', username: 'alice', body: 'x', permlink: 't-1' })
    expect(shortFormQueueSummary(thread)).toBe('Post to hive-167922')
  })
})

describe('shortFormPermlink', () => {
  it('creates a slug with a random suffix for container formats', () => {
    expect(shortFormPermlink({ format: 'snaps', body: 'Hello Hive World!', random: () => 0.5 }))
      .toMatch(/^hive-snaps-hello-hive-world-[0-9a-f]{8}$/)
  })

  it('creates a timestamped permlink for threads', () => {
    const permlink = shortFormPermlink({ format: 'threads', body: 'gm', now: new Date('2026-01-01T00:00:00Z') })
    expect(permlink).toMatch(/^gm-/)
  })
})

describe('feed readers', () => {
  it('reads container formats from the newest containers', async () => {
    const request = vi.fn(async (method) => {
      if (method === 'bridge.get_account_posts') {
        return [
          { author: 'ecency.waves', permlink: 'waves-2', title: 'Wave 2' },
          { author: 'ecency.waves', permlink: 'not-a-container' }
        ]
      }
      if (method === 'bridge.get_discussion') {
        return {
          'ecency.waves/waves-2': { author: 'ecency.waves', permlink: 'waves-2', replies: ['alice/w1'] },
          'alice/w1': post({ author: 'alice', depth: 1, parent_author: 'ecency.waves', created: '2026-01-03T00:00:00' })
        }
      }
      throw new Error('unexpected ' + method)
    })
    const items = await fetchShortFormFeed('waves', { request, limit: 5 })
    expect(items).toHaveLength(1)
    expect(items[0]._container.permlink).toBe('waves-2')
    expect(request).toHaveBeenCalledWith('bridge.get_account_posts', expect.objectContaining({ account: 'ecency.waves' }), undefined)
  })

  it('filters ranked posts down to real threads and D.Buzz posts', async () => {
    const thread = post({ category: 'hive-167922', permlink: 'thread', json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] } })
    const buzz = post({ category: 'hive-193084', permlink: 'buzz', json_metadata: { app: 'dBuzz/v3.0.0', shortForm: true } })
    const threadFeed = vi.fn(async (method, params) => (
      params.start_permlink ? [] : [thread, post({ category: 'life', permlink: 'other' })]
    ))
    const threads = await fetchShortFormFeed('threads', { request: threadFeed, limit: 10 })
    expect(threads.map(item => item.permlink)).toEqual(['thread'])
    expect(threadFeed).toHaveBeenCalledWith('bridge.get_ranked_posts', expect.objectContaining({ tag: 'inleo', limit: 20 }), undefined)

    const buzzFeed = vi.fn(async (method, params) => (
      params.start_permlink ? [] : [buzz, post({ category: 'hive-193084', permlink: 'longform', json_metadata: { tags: ['dbuzz'] } })]
    ))
    const buzzes = await fetchShortFormFeed('dbuzz', { request: buzzFeed, limit: 10 })
    expect(buzzes.map(item => item.permlink)).toEqual(['buzz'])
  })

  it('pages ranked posts until enough matches are collected', async () => {
    const calls = []
    const request = vi.fn(async (method, params) => {
      calls.push(params)
      if (params.start_permlink) return []
      return [
        post({ permlink: 'skip-1', category: 'life' }),
        post({ permlink: 'thread-a', category: 'hive-167922', json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] } })
      ]
    })
    const items = await fetchShortFormFeed('threads', { request, limit: 5 })
    expect(items.map(item => item.permlink)).toEqual(['thread-a'])
    // One page of only 2 posts cannot supply 5 matches, so a second page is read.
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ start_author: 'alice', start_permlink: 'thread-a' })
  })

  it('rejects an unknown format', async () => {
    await expect(fetchShortFormFeed('nope')).rejects.toThrow(/Unknown/)
  })
})

describe('fetchShortFormPost', () => {
  it('flattens the reply tree with depths', async () => {
    const request = vi.fn(async method => {
      if (method === 'bridge.get_post') {
        return post({ category: 'hive-167922', json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] } })
      }
      return {
        'alice/post-1': { author: 'alice', permlink: 'post-1', replies: ['bob/r1'] },
        'bob/r1': post({ author: 'bob', permlink: 'r1', replies: ['carol/r2'] }),
        'carol/r2': post({ author: 'carol', permlink: 'r2' })
      }
    })
    const result = await fetchShortFormPost('alice', 'post-1', { request })
    expect(result.format).toBe('threads')
    expect(result.replies.map(reply => [reply.permlink, reply._depth])).toEqual([['r1', 1], ['r2', 2]])
  })

  it('returns null when the post cannot be read', async () => {
    expect(await fetchShortFormPost('alice', 'gone', { request: async () => null })).toBeNull()
  })
})
