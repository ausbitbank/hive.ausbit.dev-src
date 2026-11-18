import { describe, expect, it } from 'vitest'
import { applyMetadata, MARKER } from '../../scripts/lib/prerender-meta.mjs'

const SHELL = `<!DOCTYPE html>
<html>
  <head>
    <title>Old title</title>
    <meta name="description" content="Old description">
    <link rel="canonical" href="https://example.com/">
    <meta property="og:title" content="Old OG">
    <meta property="og:type" content="website">
    <script type="module" src="/assets/app.js"></script>
  </head>
  <body>
    <div id="q-app"></div>
    <a href="https://hive.io">Powered by Hive</a>
  </body>
</html>`

const META = {
  title: 'New <title>',
  description: 'A new description',
  canonical: 'https://example.com/browse',
  ogTitle: 'OG title',
  ogDescription: 'OG description',
  ogUrl: 'https://example.com/browse',
  ogImage: 'https://example.com/image.png',
  ogType: 'article',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Twitter title',
  twitterDescription: 'Twitter description',
  twitterImage: 'https://example.com/twitter.png',
  jsonLd: JSON.stringify({ '@type': 'Article', name: 'Test' })
}

describe('applyMetadata', () => {
  it('replaces metadata but preserves the application shell', () => {
    const html = applyMetadata(SHELL, META)
    expect(html).toContain('<title>New &lt;title&gt;</title>')
    expect(html).toContain('<meta name="description" content="A new description">')
    expect(html).toContain('<link rel="canonical" href="https://example.com/browse">')
    expect(html).toContain('<meta property="og:type" content="article">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain('<script type="module" src="/assets/app.js"></script>')
    expect(html).toContain('<div id="q-app"></div>')
    expect(html).not.toContain('q-header')
    expect(html).not.toContain('Prerendered live content')
  })

  it('adds JSON-LD and the metadata-only marker', () => {
    const html = applyMetadata(SHELL, META)
    expect(html).toContain(MARKER)
    expect(html).toContain('<script type="application/ld+json">')
    expect(html).toContain('"@type":"Article"')
  })

  it('leaves missing metadata tags untouched', () => {
    const html = applyMetadata(SHELL, { title: 'Only title', jsonLd: '' })
    expect(html).toContain('<title>Only title</title>')
    expect(html).toContain('Old description')
    expect(html).not.toContain('<script type="application/ld+json">')
  })
})
