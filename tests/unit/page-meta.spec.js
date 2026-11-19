import { beforeEach, describe, expect, it } from 'vitest'
import {
  setPageMeta,
  setJsonLd,
  stripHtml,
  SITE_NAME,
  BASE_URL,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE
} from '../../src/utils/pageMeta'

function metaContent (selector) {
  return document.head.querySelector(selector)?.getAttribute('content')
}

function linkHref (selector) {
  return document.head.querySelector(selector)?.getAttribute('href')
}

describe('setPageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('sets the title, description, canonical and social tags', () => {
    const result = setPageMeta({
      title: 'HIVE block explorer',
      description: 'Explore the Hive blockchain.',
      image: 'https://cdn.example/cover.png',
      url: '/browse',
      type: 'website'
    })

    expect(document.title).toBe('HIVE block explorer')
    expect(metaContent('meta[name="description"]')).toBe('Explore the Hive blockchain.')
    expect(linkHref('link[rel="canonical"]')).toBe(BASE_URL + '/browse')

    expect(metaContent('meta[property="og:site_name"]')).toBe(SITE_NAME)
    expect(metaContent('meta[property="og:type"]')).toBe('website')
    expect(metaContent('meta[property="og:title"]')).toBe('HIVE block explorer')
    expect(metaContent('meta[property="og:description"]')).toBe('Explore the Hive blockchain.')
    expect(metaContent('meta[property="og:image"]')).toBe('https://cdn.example/cover.png')
    expect(metaContent('meta[property="og:url"]')).toBe(BASE_URL + '/browse')

    expect(metaContent('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(metaContent('meta[name="twitter:title"]')).toBe('HIVE block explorer')
    expect(metaContent('meta[name="twitter:description"]')).toBe('Explore the Hive blockchain.')
    expect(metaContent('meta[name="twitter:image"]')).toBe('https://cdn.example/cover.png')

    expect(result).toEqual({
      title: 'HIVE block explorer',
      description: 'Explore the Hive blockchain.',
      image: 'https://cdn.example/cover.png',
      url: BASE_URL + '/browse'
    })
  })

  it('applies defaults for missing values', () => {
    setPageMeta()

    expect(document.title).toBe(SITE_NAME)
    expect(metaContent('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION)
    expect(linkHref('link[rel="canonical"]')).toBe(BASE_URL + '/')
    expect(metaContent('meta[property="og:image"]')).toBe(BASE_URL + DEFAULT_IMAGE)
    expect(metaContent('meta[property="og:type"]')).toBe('website')
  })

  it('marks noindex pages and drops the canonical', () => {
    setPageMeta({ title: 'Search', url: '/search', noindex: true })

    expect(metaContent('meta[name="robots"]')).toBe('noindex, follow')
    expect(linkHref('link[rel="canonical"]')).toBeUndefined()
    expect(metaContent('meta[property="og:title"]')).toBe('Search')
  })

  it('normalises relative URLs against the site base', () => {
    setPageMeta({
      title: 'Post',
      url: '/@alice/hello-world',
      image: '/images/post.png'
    })

    expect(linkHref('link[rel="canonical"]')).toBe(BASE_URL + '/@alice/hello-world')
    expect(metaContent('meta[property="og:url"]')).toBe(BASE_URL + '/@alice/hello-world')
    expect(metaContent('meta[property="og:image"]')).toBe(BASE_URL + '/images/post.png')
    expect(metaContent('meta[name="twitter:image"]')).toBe(BASE_URL + '/images/post.png')
  })

  it('keeps absolute URLs from other origins', () => {
    setPageMeta({
      title: 'External',
      url: 'https://other.example/page',
      image: 'https://other.example/image.png'
    })

    expect(linkHref('link[rel="canonical"]')).toBe('https://other.example/page')
    expect(metaContent('meta[property="og:image"]')).toBe('https://other.example/image.png')
  })

  it('replaces tags instead of duplicating them across calls', () => {
    setPageMeta({
      title: 'First',
      description: 'First description',
      url: '/first',
      type: 'article'
    })
    setPageMeta({
      title: 'Second',
      description: 'Second description',
      url: '/second',
      type: 'profile'
    })

    expect(document.title).toBe('Second')
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[property="og:type"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[property="og:description"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[property="og:image"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(1)
    expect(document.querySelectorAll('meta[name="twitter:image"]')).toHaveLength(1)

    expect(metaContent('meta[property="og:title"]')).toBe('Second')
    expect(metaContent('meta[property="og:type"]')).toBe('profile')
    expect(metaContent('meta[property="og:description"]')).toBe('Second description')
    expect(linkHref('link[rel="canonical"]')).toBe(BASE_URL + '/second')
  })

  it('strips HTML and truncates long descriptions', () => {
    const longDescription = 'word '.repeat(80)
    setPageMeta({ title: 'Long', description: longDescription, url: '/' })

    const description = metaContent('meta[name="description"]')
    expect(description.endsWith('…')).toBe(true)
    expect(description.length).toBeLessThanOrEqual(201)
    expect(description).not.toContain('<')

    setPageMeta({
      title: '<b>Markup</b> title',
      description: '<p>Hello <strong>world</strong> &amp; friends</p>',
      url: '/'
    })

    expect(document.title).toBe('Markup title')
    expect(metaContent('meta[name="description"]')).toBe('Hello world & friends')
  })
})

describe('setJsonLd', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('adds a JSON-LD script', () => {
    const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Hello' }

    const script = setJsonLd(jsonLd)

    expect(script).toBeInstanceOf(HTMLScriptElement)
    expect(script.id).toBe('page-json-ld')
    expect(script.type).toBe('application/ld+json')
    expect(JSON.parse(script.textContent)).toEqual(jsonLd)
    expect(document.querySelectorAll('script#page-json-ld')).toHaveLength(1)
  })

  it('replaces an existing JSON-LD script', () => {
    const first = setJsonLd({ '@type': 'Article', headline: 'First' })
    const second = setJsonLd({ '@type': 'ProfilePage', name: 'Alice' })

    expect(second).toBe(first)
    expect(document.querySelectorAll('script#page-json-ld')).toHaveLength(1)
    expect(JSON.parse(second.textContent)).toEqual({
      '@type': 'ProfilePage',
      name: 'Alice'
    })
  })

  it('removes the JSON-LD script when called without data', () => {
    setJsonLd({ '@type': 'Article' })

    expect(setJsonLd(null)).toBeNull()
    expect(document.getElementById('page-json-ld')).toBeNull()
  })

  it('removes JSON-LD when setPageMeta is called without jsonLd', () => {
    setPageMeta({ title: 'With data', jsonLd: { '@type': 'Article' } })
    expect(document.getElementById('page-json-ld')).not.toBeNull()

    setPageMeta({ title: 'Without data' })
    expect(document.getElementById('page-json-ld')).toBeNull()
  })
})

describe('pageMeta stripHtml helper', () => {
  it('strips markup/entities and truncates by max length', () => {
    expect(stripHtml('<p>Hello <strong>world</strong> &amp; friends</p>', 200)).toBe(
      'Hello world & friends'
    )
    expect(stripHtml('<p>Hello <strong>world</strong></p>', 8)).toBe('Hello…')
    expect(stripHtml('<p>one</p><p>two</p>', 200)).toBe('one two')
  })
})
