import { describe, expect, it } from 'vitest'
import { applyMetadata, buildMetadataTemplate, MARKER } from '../../scripts/lib/prerender-meta.mjs'

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

// Vite/Quasar minifies the built index and removes optional attribute quotes.
const MINIFIED_SHELL = '<!DOCTYPE html><html lang=en><head><meta charset=utf-8><title>hive.ausbit.dev — Hive block explorer</title><meta name=description content="A block explorer and toolkit for the Hive blockchain."><link rel=canonical href=https://hive.ausbit.dev/ ><meta property=og:title content="hive.ausbit.dev — Hive block explorer"><meta property=og:description content="A block explorer and toolkit for the Hive blockchain."><meta property=og:type content=website><meta property=og:url content=https://hive.ausbit.dev/ ><meta name=twitter:card content=summary_large_image><meta name=twitter:title content="hive.ausbit.dev — Hive block explorer"><meta name=twitter:description content="A block explorer and toolkit for the Hive blockchain."><script data-cfasync="false" type=module crossorigin src="/assets/index.js"></script></head><body><div id=q-app></div></body></html>'

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

function count (html, pattern) {
  return (html.match(new RegExp(pattern, 'gi')) || []).length
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
    expect(html).toContain('data-seo-shell')
    expect(html).toContain('<h1>New &lt;title&gt;</h1>')
    expect(html).toContain('<a href="/witnesses">Witnesses</a>')
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

  it('replaces unquoted attributes emitted by the minifier', () => {
    const html = applyMetadata(MINIFIED_SHELL, {
      title: 'Latest Hive blocks',
      description: 'Live block list',
      canonical: 'https://hive.ausbit.dev/blocks',
      ogTitle: 'Latest Hive blocks',
      ogDescription: 'Live block list',
      ogUrl: 'https://hive.ausbit.dev/blocks'
    })
    expect(html).toContain('<title>Latest Hive blocks</title>')
    expect(html).toContain('<meta name="description" content="Live block list">')
    expect(html).toContain('<link rel="canonical" href="https://hive.ausbit.dev/blocks">')
    expect(count(html, '<link[^>]*rel="canonical"')).toBe(1)
    expect(count(html, '<meta[^>]*name="description"')).toBe(1)
    expect(count(html, '<meta[^>]*property="og:title"')).toBe(1)
    expect(html).toContain('<h1>Latest Hive blocks</h1>')
    expect(html).toContain('<a href="/created">Browse posts</a>')
  })

  it('removes duplicate tags instead of appending a second set', () => {
    const duplicated = MINIFIED_SHELL.replace(
      '<link rel=canonical href=https://hive.ausbit.dev/ >',
      '<link rel=canonical href=https://hive.ausbit.dev/ ><link rel="canonical" href="https://hive.ausbit.dev/duplicate">'
    ).replace(
      '<meta name=description content="A block explorer and toolkit for the Hive blockchain.">',
      '<meta name=description content="A block explorer and toolkit for the Hive blockchain."><meta name="description" content="second description">'
    )
    const html = applyMetadata(duplicated, META)
    expect(count(html, '<link[^>]*rel=("?)canonical')).toBe(1)
    expect(count(html, '<meta[^>]*name=("?)description')).toBe(1)
    expect(html).not.toContain('second description')
  })
})

describe('buildMetadataTemplate', () => {
  it('emits an SSI template without duplicating the static defaults', () => {
    const html = buildMetadataTemplate(MINIFIED_SHELL, {
      title: 'hive.ausbit.dev — Hive block explorer',
      description: 'A block explorer and toolkit for the Hive blockchain.'
    })
    expect(html).toContain('<!--# echo var="page_title"')
    expect(html).toContain('<!--# echo var="page_path"')
    expect(html).toContain('<!--# echo var="page_description"')
    expect(html).toContain('<!--# echo var="page_type"')
    expect(html).toContain('<!--# echo var="page_image"')
    expect(html).toContain('<h1><!--# echo var="page_title"')
    expect(html).toContain('<a href="/blocks">Blocks</a>')
    expect(count(html, '<link[^>]*rel=("?)canonical')).toBe(1)
    expect(count(html, '<meta[^>]*name=("?)description')).toBe(1)
    expect(html).not.toContain('<script type="application/ld+json">')
    expect(html).toContain('/assets/index.js')
  })
})
