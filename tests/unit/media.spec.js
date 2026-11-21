import { describe, expect, it } from 'vitest'
import {
  altFromFileName,
  collectImageUrls,
  deriveDescription,
  extractBodyImages,
  extractMentionedUsers,
  isImageUrl,
  markdownImage,
  normalizeImageUrl
} from '../../src/utils/media'

describe('body image extraction', () => {
  it('reads markdown and HTML images in document order and deduplicates', () => {
    const body = [
      '# Hello',
      '![First shot](https://images.hive.blog/one.jpg)',
      'Some text.',
      '<img src="https://files.peakd.com/two.png" alt="Second">',
      '![Duplicate](https://images.hive.blog/one.jpg)'
    ].join('\n\n')
    expect(extractBodyImages(body)).toEqual([
      { url: 'https://images.hive.blog/one.jpg', alt: 'First shot' },
      { url: 'https://files.peakd.com/two.png', alt: 'Second' }
    ])
    expect(collectImageUrls(body)).toEqual([
      'https://images.hive.blog/one.jpg',
      'https://files.peakd.com/two.png'
    ])
  })

  it('decodes entities and trims prose punctuation from image URLs', () => {
    expect(normalizeImageUrl('https://example.com/a.png),')).toBe('https://example.com/a.png')
    expect(normalizeImageUrl('<https://example.com/a.png>')).toBe('https://example.com/a.png')
    expect(normalizeImageUrl('https://example.com/a.png?x=1&amp;y=2')).toBe('https://example.com/a.png?x=1&y=2')
    expect(normalizeImageUrl('javascript:alert(1)')).toBe('')
  })

  it('builds safe markdown image links', () => {
    expect(markdownImage({ alt: 'A [bracket]', url: 'https://images.hive.blog/x.jpg' }))
      .toBe('![A bracket](https://images.hive.blog/x.jpg)')
    expect(isImageUrl('https://example.com/photo.webp')).toBe(true)
    expect(isImageUrl('https://example.com/page')).toBe(false)
    expect(altFromFileName('my-holiday_photo.jpg')).toBe('my holiday photo')
  })
})

describe('post text helpers', () => {
  it('derives a plain description and truncates on a word boundary', () => {
    const body = '## Heading\n\n![shot](https://example.com/a.jpg)\n\nThis is **the** first paragraph with [a link](https://example.com).\n\nSecond paragraph.'
    expect(deriveDescription(body, 60)).toBe('Heading This is the first paragraph with a link. Second…')
    expect(deriveDescription('', 60)).toBe('')
  })

  it('extracts mentions without taking code, URLs or emails', () => {
    const body = 'Thanks @alice and @Bob. Email me@example.com. `@inline` https://x.com/@url\n```\n@code\n```\nAgain @alice.'
    expect(extractMentionedUsers(body)).toEqual(['alice', 'bob'])
  })
})
