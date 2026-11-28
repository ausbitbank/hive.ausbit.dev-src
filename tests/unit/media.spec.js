import { describe, expect, it } from 'vitest'
import {
  altFromFileName,
  collectImageUrls,
  deriveDescription,
  extractBodyImages,
  extractMentionedUsers,
  imageFilesFromTransfer,
  insertImageMarkdown,
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

  it('ignores image syntax inside fenced and inline code', () => {
    const body = [
      '```md',
      '![fenced](https://images.hive.blog/fenced.jpg)',
      '```',
      'Real ![shot](https://images.hive.blog/real.jpg)',
      'Inline `![inline](https://images.hive.blog/inline.jpg)` code.'
    ].join('\n')
    expect(extractBodyImages(body)).toEqual([
      { url: 'https://images.hive.blog/real.jpg', alt: 'shot' }
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

  it('collects pasted or dropped image files from both files and items', () => {
    const fromFiles = { name: 'clipboard.png', type: 'image/png' }
    const fromItems = { name: 'dragged.jpg', type: 'image/jpeg' }
    const duplicate = fromFiles
    const text = { name: 'notes.txt', type: 'text/plain' }

    expect(imageFilesFromTransfer({
      files: [fromFiles, text],
      items: [
        { kind: 'file', getAsFile: () => fromItems },
        { kind: 'string', getAsFile: () => text },
        { kind: 'file', getAsFile: () => duplicate }
      ]
    })).toEqual([fromFiles, fromItems])
    expect(imageFilesFromTransfer(null)).toEqual([])
  })

  it('inserts uploaded images at the saved selection with paragraph spacing', () => {
    const images = [
      { alt: 'One', url: 'https://images.hive.blog/one.jpg' },
      { alt: 'Two', url: 'https://images.hive.blog/two.jpg' }
    ]

    expect(insertImageMarkdown('Hello world', images, { start: 5, end: 5 })).toEqual({
      body: 'Hello\n\n![One](https://images.hive.blog/one.jpg)\n\n![Two](https://images.hive.blog/two.jpg)\n\n world',
      cursor: 91
    })

    expect(insertImageMarkdown('', images).body)
      .toBe('![One](https://images.hive.blog/one.jpg)\n\n![Two](https://images.hive.blog/two.jpg)')

    expect(insertImageMarkdown('Keep me', [], { start: 0, end: 0 }))
      .toEqual({ body: 'Keep me', cursor: 0 })
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
