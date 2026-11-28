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
