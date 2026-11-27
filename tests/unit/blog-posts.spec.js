import { describe, expect, it } from 'vitest'
import {
  blogPostExcerpt,
  blogPostHasBodyImage,
  blogPostImage,
  blogPostPathFor,
  formatBlogDate,
  isBlogPost,
  sortBlogPosts
} from '../../src/services/blogPosts'

function post (overrides = {}) {
  return {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    body: 'Hello world.',
    created: '2026-11-20T10:00:00',
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
