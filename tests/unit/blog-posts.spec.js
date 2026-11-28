import { describe, expect, it } from 'vitest'
import {
  blogPostCommentCount,
  blogPostDate,
  blogPostExcerpt,
  blogPostHasBodyImage,
  blogPostImage,
  blogPostPathFor,
  blogPostPayout,
  blogPostReadingMinutes,
  blogPostTags,
  blogPostTitle,
  blogPostVoteCount,
  dedupePosts,
  formatBlogDate,
  isBlogPost,
  isVaultHiddenPost,
  sortBlogPosts,
  vaultPublicBody,
  vaultSummary
} from '../../src/services/blogPosts'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    body: 'Hello world.',
    depth: 0,
    parent_author: '',
    created: '2026-11-20T10:00:00',
    json_metadata: {},
    ...overrides
  }
}

describe('blog post helpers', () => {
  it('turns Markdown source into a readable excerpt', () => {
    const excerpt = blogPostExcerpt(post({
      body: '# Heading\n\nA [link](https://example.com) and ![cover](https://example.com/a.png) with **bold** and `code`.'
    }))
    expect(excerpt).toBe('Heading A link and with bold and code.')
  })

  it('only accepts top-level posts', () => {
    expect(isBlogPost(post())).toBe(true)
    expect(isBlogPost(post({ parent_author: 'bob' }))).toBe(false)
    expect(isBlogPost(post({ depth: 2 }))).toBe(false)
    expect(isBlogPost(null)).toBe(false)
  })

  it('uses an https thumbnail or the first metadata image', () => {
    expect(blogPostImage(post({ thumbnail: 'https://images.hive.blog/a.png' }))).toBe('https://images.hive.blog/a.png')
    expect(blogPostImage(post({ json_metadata: JSON.stringify({ image: ['http://insecure/a.png', 'https://cdn.example/b.png'] }) })))
      .toBe('https://cdn.example/b.png')
    expect(blogPostImage(post({ thumbnail: 'http://insecure/a.png' }))).toBe('')
  })

  it('falls back to the first inline body image', () => {
    expect(blogPostImage(post({ body: 'Intro\n\n![cover](https://cdn.example/a.png)\n' }))).toBe('https://cdn.example/a.png')
    expect(blogPostImage(post({ body: '<p><img src="https://cdn.example/b.png" alt="b"></p>' }))).toBe('https://cdn.example/b.png')
  })

  it('keeps parentheses in image filenames out of excerpts', () => {
    const row = post({
      body: '![cover](https://cdn.example/image_cleanup(2).png)\n\nBuild update.'
    })
    expect(blogPostExcerpt(row)).toBe('Build update.')
    expect(blogPostImage(row)).toBe('https://cdn.example/image_cleanup(2).png')
    expect(blogPostHasBodyImage(row)).toBe(true)
  })

  it('detects whether the body already has a visual', () => {
    expect(blogPostHasBodyImage(post({ body: 'Intro ![a](https://cdn.example/a.png)' }))).toBe(true)
    expect(blogPostHasBodyImage(post({ body: '<p><img src="https://cdn.example/a.png"></p>' }))).toBe(true)
    expect(blogPostHasBodyImage(post({ body: 'See https://cdn.example/a.jpg for the photo.' }))).toBe(true)
    expect(blogPostHasBodyImage(post({ body: 'Text only, no images.' }))).toBe(false)
    expect(blogPostHasBodyImage(null)).toBe(false)
  })

  it('keeps the owner at the root and puts contributors on an author path', () => {
    expect(blogPostPathFor(post(), 'alice')).toBe('/a-post')
    expect(blogPostPathFor(post(), 'bob')).toBe('/@alice/a-post')
    expect(blogPostPathFor(post({ permlink: 'about' }), 'alice')).toBe('/p/about')
  })

  it('orders pinned posts first, then newest first', () => {
    const rows = [
      post({ permlink: 'old', created: '2026-01-01T00:00:00' }),
      post({ permlink: 'new', created: '2026-11-01T00:00:00' }),
      post({ permlink: 'pin', created: '2025-01-01T00:00:00' })
    ]
    expect(sortBlogPosts(rows, ['pin']).map(row => row.permlink)).toEqual(['pin', 'new', 'old'])
  })

  it('deduplicates by author and permlink', () => {
    const rows = [post(), post({ title: 'Duplicate' })]
    expect(sortBlogPosts(rows)).toHaveLength(1)
  })

  it('formats a chain date', () => {
    expect(formatBlogDate('2026-11-20T10:00:00')).toBe('Nov 20, 2026')
    expect(formatBlogDate('')).toBe('')
    expect(formatBlogDate('not a date')).toBe('')
  })
})

describe('blog post classification', () => {
  it('hides Vault plumbing but keeps normal posts', () => {
    expect(isVaultHiddenPost(post({ json_metadata: { content_type: 'product' } }))).toBe(true)
    expect(isVaultHiddenPost(post({ json_metadata: '{"content_type":"product"}' }))).toBe(true)
    expect(isVaultHiddenPost(post({ json_metadata: { content_type: 'blog' } }))).toBe(false)
    expect(isVaultHiddenPost(null)).toBe(false)
  })

  it('never archives a Vault product post', () => {
    expect(isBlogPost(post({ json_metadata: { content_type: 'product' } }))).toBe(false)
  })
})

describe('blog presentation helpers', () => {
  it('derives title, reading time and tags safely', () => {
    expect(blogPostTitle(post({ title: '<b>Hello</b>' }))).toBe('Hello')
    expect(blogPostTitle(post({ title: '', parent_author: 'bob' }))).toBe('Comment by @alice')

    expect(blogPostReadingMinutes(post({ body: '' }))).toBe(1)
    expect(blogPostReadingMinutes(post({ body: Array.from({ length: 220 }, () => 'word').join(' ') }))).toBe(1)
    expect(blogPostReadingMinutes(post({ body: Array.from({ length: 660 }, () => 'word').join(' ') }))).toBe(3)

    expect(blogPostTags(post({ json_metadata: { tags: ['hive', 'one', 'one', 'two', 'three', 'four'] } }))).toEqual(['hive', 'one', 'two'])
    expect(blogPostTags(post({ json_metadata: { tags: 'not-an-array' } }))).toEqual([])
  })

  it('clips an excerpt on a word boundary', () => {
    const short = blogPostExcerpt(post({ body: 'one two three' }), 5)
    expect(short).toBe('one t…')
    expect(blogPostExcerpt(post({ body: 'short text' }), 50)).toBe('short text')
  })

  it('accepts a trailing Z and rejects impossible dates', () => {
    expect(formatBlogDate('2026-01-01T00:00:00Z')).toBe('Jan 1, 2026')
    expect(blogPostDate(post())).toBe('2026-11-20T10:00:00')
    expect(blogPostDate(null)).toBe('')
  })

  it('wraps payout, vote and comment helpers', () => {
    expect(blogPostPayout(post({ pending_payout_value: '1.234 HBD' }))).toBe('1.234 HBD')
    expect(blogPostPayout(post({ pending_payout_value: '0.000 HBD' }))).toBe('')
    expect(blogPostVoteCount(post({ stats: { total_votes: '7' } }))).toBe(7)
    expect(blogPostVoteCount(post({ active_votes: [{}, {}] }))).toBe(2)
    expect(blogPostCommentCount(post({ children: 3 }))).toBe(3)
    expect(blogPostCommentCount(post({ children: 'nope' }))).toBe(0)
  })
})

describe('dedupe helpers', () => {
  it('drops malformed rows and keeps the first author/permlink pair', () => {
    const rows = dedupePosts([
      post({ permlink: 'a' }),
      post({ permlink: 'A' }),
      post({ author: '', permlink: 'b' }),
      null,
      post({ author: 'bob', permlink: 'a' })
    ])
    expect(rows.map(row => row.author + '/' + row.permlink)).toEqual(['alice/a', 'bob/a'])
  })

  it('ignores pinned permlinks that are not present', () => {
    const rows = sortBlogPosts([
      post({ permlink: 'old', created: '2026-01-01T00:00:00' }),
      post({ permlink: 'new', created: '2026-03-01T00:00:00' })
    ], ['missing'])
    expect(rows.map(row => row.permlink)).toEqual(['new', 'old'])
  })
})

describe('Vault summary helpers', () => {
  it('parses section and whole-post markers only', () => {
    expect(vaultSummary({ banksia_vault: { v: 1, mode: 'section' } })).toEqual({ mode: 'section' })
    expect(vaultSummary('{"banksia_vault":{"v":1,"mode":"post"}}')).toEqual({ mode: 'post' })
    expect(vaultSummary({ banksia_vault: { v: 2, mode: 'post' } })).toBeNull()
    expect(vaultSummary({ banksia_vault: { v: 1, mode: 'other' } })).toBeNull()
    expect(vaultSummary('not json')).toBeNull()
    expect(vaultSummary(null)).toBeNull()
  })

  it('cuts the public teaser at the marker', () => {
    const marker = '<!--banksia:vault-->'
    expect(vaultPublicBody('intro ' + marker + ' secret')).toBe('intro ')
    expect(vaultPublicBody('no marker')).toBe('no marker')
    expect(vaultPublicBody('no marker', 'post')).toBe('')
    expect(vaultPublicBody(null)).toBe('')
  })
})
