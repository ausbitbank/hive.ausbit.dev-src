import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const services = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  fetchAccountPosts: vi.fn(),
  fetchPostContent: vi.fn(),
  fetchRankedPosts: vi.fn()
}))

vi.mock('../../src/services/chainData', () => services)

const { useBlogStore } = await import('../../src/stores/blog')

function accountWithAuthors (authors, extra = {}) {
  return {
    name: 'alice',
    created: '2024-01-01T00:00:00',
    posting_json_metadata: JSON.stringify({
      'banksia.io': { blog: { version: 1, claimed: true, authors, ...extra } }
    }),
    json_metadata: '{}'
  }
}

const contributorPost = {
  author: 'bob',
  permlink: 'contrib-post',
  title: 'A guest post',
  body: 'hello',
  created: '2026-01-01T00:00:00',
  depth: 0,
  json_metadata: '{}'
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  services.fetchAccountPosts.mockResolvedValue([])
  services.fetchRankedPosts.mockResolvedValue([])
  services.fetchPostContent.mockResolvedValue(contributorPost)
})

describe('blog tenant load race', () => {
  it('lets a direct contributor-post visit wait for the tenant settings', async () => {
    let resolveAccount
    services.fetchAccount.mockImplementation(() => new Promise(resolve => { resolveAccount = resolve }))

    const blog = useBlogStore()
    blog.accountName = 'alice'
    const loading = blog.load()
    const post = blog.loadPost('contrib-post', { author: 'bob' })

    // The content read wins the race, but loadPost must not judge the post
    // against an empty settings object.
    await Promise.resolve()
    resolveAccount(accountWithAuthors(['bob']))

    await loading
    await expect(post).resolves.toMatchObject({ author: 'bob', permlink: 'contrib-post' })
  })

  it('de-duplicates concurrent tenant loads', async () => {
    services.fetchAccount.mockResolvedValue(accountWithAuthors(['bob']))

    const blog = useBlogStore()
    blog.accountName = 'alice'
    await Promise.all([blog.load(), blog.load(), blog.load()])

    expect(services.fetchAccount).toHaveBeenCalledTimes(1)
  })

  it('resolves a pinned contributor post and skips comments/products', async () => {
    services.fetchAccount.mockResolvedValue(accountWithAuthors(['bob'], { pinned: ['contrib-post', 'a-comment'] }))
    services.fetchPostContent.mockImplementation(async (author, permlink) => {
      if (permlink === 'contrib-post' && author === 'bob') return contributorPost
      if (permlink === 'a-comment') return { ...contributorPost, permlink: 'a-comment', parent_author: 'alice' }
      return null
    })

    const blog = useBlogStore()
    blog.accountName = 'alice'
    await blog.load()

    const permlinks = blog.posts.map(post => post.permlink)
    expect(permlinks).toContain('contrib-post')
    expect(permlinks).not.toContain('a-comment')
    expect(services.fetchPostContent).toHaveBeenCalledWith('bob', 'contrib-post', { force: false })
  })
})

function rowsFor (author, count, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const n = offset + index
    return {
      author,
      permlink: author + '-post-' + n,
      title: author + ' post ' + n,
      body: 'Body ' + n,
      created: new Date(Date.UTC(2026, 10, 27) - n * 3600 * 1000).toISOString().replace('Z', ''),
      depth: 0,
      json_metadata: '{}'
    }
  })
}

describe('blog archive pagination', () => {
  it('pages the owner archive when the blog also has a contributor', async () => {
    services.fetchAccount.mockResolvedValue(accountWithAuthors(['bob']))
    const ownerFirst = rowsFor('alice', 20)
    const ownerNext = rowsFor('alice', 5, 20)
    const contributorFirst = rowsFor('bob', 10)

    services.fetchAccountPosts.mockImplementation(async params => {
      if (params.account === 'bob') return params.start_permlink ? [] : contributorFirst
      return params.start_permlink ? ownerNext : ownerFirst
    })

    const blog = useBlogStore()
    blog.accountName = 'alice'
    await blog.load()

    expect(blog.posts).toHaveLength(30)
    expect(blog.hasMore).toBe(true)

    await blog.loadMore()

    expect(blog.posts).toHaveLength(35)
    expect(blog.hasMore).toBe(false)
    expect(services.fetchAccountPosts).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'alice', start_author: 'alice', start_permlink: 'alice-post-19' }),
      { force: false }
    )
    expect(services.fetchAccountPosts).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'bob', start_author: 'bob', start_permlink: 'bob-post-9' }),
      { force: false }
    )
  })

  it('keeps an unclaimed preview to its first page', async () => {
    services.fetchAccount.mockResolvedValue(accountWithAuthors(['bob'], { claimed: false }))
    services.fetchAccountPosts.mockResolvedValue(rowsFor('alice', 20))

    const blog = useBlogStore()
    blog.accountName = 'alice'
    await blog.load()

    expect(blog.hasMore).toBe(false)
  })
})
