import { describe, expect, it } from 'vitest'
import { portfolioImages, portfolioPostTags } from '../../src/services/blogPortfolio'

const POST = {
  author: 'alice',
  permlink: 'a-post',
  title: 'A post',
  body: [
    'Intro',
    '![Garden](https://cdn.example/garden.png)',
    '<img src="https://cdn.example/notes.png" alt="Notes">',
    '![Garden again](https://cdn.example/garden.png)',
    'http://insecure.example/x.png',
    '![No](http://insecure.example/y.png)'
  ].join('\n'),
  json_metadata: JSON.stringify({
    image: ['https://cdn.example/cover.png'],
    tags: ['hive-123456', 'art', 'photo']
  })
}

describe('portfolio images', () => {
  it('collects https metadata, Markdown and HTML images without duplicates', () => {
    expect(portfolioImages(POST)).toEqual([
      { url: 'https://cdn.example/cover.png', alt: '' },
      { url: 'https://cdn.example/garden.png', alt: 'Garden' },
      { url: 'https://cdn.example/notes.png', alt: 'Notes' }
    ])
  })

  it('filters insecure and community tags', () => {
    expect(portfolioPostTags(POST)).toEqual(['art', 'photo'])
  })

  it('handles empty posts', () => {
    expect(portfolioImages(null)).toEqual([])
    expect(portfolioImages({})).toEqual([])
    expect(portfolioPostTags(null)).toEqual([])
  })
})
