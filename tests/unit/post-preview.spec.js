import { describe, expect, it, vi } from 'vitest'
import { postImage, postSummary } from '../../src/utils/postPreview'
import { prefetchRoute, resetPrefetchCache } from '../../src/router/prefetch'

describe('postImage', () => {
  it('prefers metadata thumbnails, then image arrays', () => {
    expect(postImage({
      json_metadata: JSON.stringify({ thumbnails: ['https://cdn.example/thumb.jpg'], image: ['https://cdn.example/full.jpg'] })
    })).toBe('https://cdn.example/thumb.jpg')
    expect(postImage({
      json_metadata: JSON.stringify({ image: ['https://cdn.example/full.jpg'] })
    })).toBe('https://cdn.example/full.jpg')
  })

  it('decodes HTML entities in image URLs', () => {
    expect(postImage({
      json_metadata: JSON.stringify({ image: 'https://cdn.example/a.jpg?x=1&amp;y=2' })
    })).toBe('https://cdn.example/a.jpg?x=1&y=2')
  })

  it('finds markdown, HTML and bare body images', () => {
    expect(postImage({ body: '![alt](https://cdn.example/markdown.png)' })).toBe('https://cdn.example/markdown.png')
    expect(postImage({ body: '<p><img src="https://cdn.example/html.webp" alt=""></p>' })).toBe('https://cdn.example/html.webp')
    expect(postImage({ body: 'Look https://cdn.example/bare.gif here' })).toBe('https://cdn.example/bare.gif')
  })

  it('returns an empty string when no image exists', () => {
    expect(postImage(null)).toBe('')
    expect(postImage({ body: 'Plain text only.' })).toBe('')
  })

  it('requests a small Cloudinary variant for card images', () => {
    expect(postImage({
      json_metadata: JSON.stringify({
        image: 'https://res.cloudinary.com/demo/image/upload/v1234/photo.jpg'
      })
    })).toBe('https://res.cloudinary.com/demo/image/upload/w_480,q_auto:eco,f_auto/v1234/photo.jpg')

    expect(postImage({
      json_metadata: JSON.stringify({
        image: 'https://res.cloudinary.com/demo/image/upload/w_320,q_auto/v1234/photo.jpg'
      })
    })).toBe('https://res.cloudinary.com/demo/image/upload/w_320,q_auto/v1234/photo.jpg')
  })
})

describe('postSummary', () => {
  it('strips markdown, links, images and code', () => {
    const summary = postSummary({
      body: '# Heading\n\n![image](https://cdn.example/a.png)\n\nA [link](https://example.com) and `code`.\n\n```js\nconst x = 1\n```'
    }, 200)
    expect(summary).toContain('Heading')
    expect(summary).toContain('A link and')
    expect(summary).not.toContain('https://')
    expect(summary).not.toContain('const x')
  })

  it('decodes entities and truncates at a word boundary', () => {
    const summary = postSummary({ body: 'One &amp; two three four five six seven eight nine ten' }, 24)
    expect(summary).toContain('One & two')
    expect(summary.endsWith('…')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(27)
  })

  it('returns an empty string for missing bodies', () => {
    expect(postSummary(null)).toBe('')
    expect(postSummary({ body: '' })).toBe('')
  })
})

describe('prefetchRoute', () => {
  it('loads each matched route loader once', async () => {
    resetPrefetchCache()
    const loader = vi.fn(() => Promise.resolve())
    const router = { resolve: vi.fn(() => ({ matched: [{ components: { default: loader } }] })) }

    expect(prefetchRoute(router, '/browse')).toBe(true)
    expect(prefetchRoute(router, '/browse')).toBe(false)
    await Promise.resolve()
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('ignores paths without a matched route', () => {
    resetPrefetchCache()
    const router = { resolve: vi.fn(() => ({ matched: [] })) }
    expect(prefetchRoute(router, '/missing')).toBe(false)
  })
})
