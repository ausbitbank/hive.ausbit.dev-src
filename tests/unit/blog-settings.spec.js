import { describe, expect, it } from 'vitest'
import {
  blogSettingsSize,
  claimBlog,
  defaultBlogSettings,
  mergeBlogMetadata,
  normalizeBlogSettings,
  readBlogSettings,
  removeBlogMetadata,
  sanitizeBlogCss,
  updateBlog
} from '../../src/services/blogSettings'

const THEME = { id: 'paper', name: 'Paper', mode: 'light' }

function accountWith (metadata = {}) {
  return {
    name: 'alice',
    posting_json_metadata: JSON.stringify(metadata),
    json_metadata: ''
  }
}

const ACCOUNT = accountWith({
  profile: { name: 'Alice', about: 'Writer and photographer.' },
  'banksia.io': { theme: THEME }
})

describe('blog settings defaults', () => {
  it('derives a title and description from the Hive profile', () => {
    const settings = defaultBlogSettings(ACCOUNT)
    expect(settings).toMatchObject({
      version: 1,
      claimed: false,
      title: 'Alice',
      description: 'Writer and photographer.',
      theme: 'auto',
      mode: 'auto',
      directory: false,
      ogImage: '',
      layout: 'grid',
      width: 'comfortable',
      typography: 'theme',
      hero: 'cover',
      showTags: true,
      showReadingTime: true,
      portfolio: { enabled: false, title: 'Portfolio', description: '', layout: 'grid', items: [] },
      shop: {
        enabled: false,
        title: 'Shop',
        description: '',
        source: 'account',
        tag: '',
        featured: [],
        layout: 'grid',
        showSoldOut: true,
        sort: 'newest'
      }
    })
  })

  it('does not throw on an empty or partial account', () => {
    expect(defaultBlogSettings(null).title).toBe('')
    expect(defaultBlogSettings({ name: 'bob' }).title).toBe('bob')
  })
})

describe('normalizeBlogSettings', () => {
  it('accepts a complete valid object', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'Alice writes',
      description: 'Notes from the garden.',
      theme: 'terminal',
      mode: 'dark',
      accent: '#39ff88',
      layout: 'magazine',
      width: 'narrow',
      typography: 'serif',
      hero: 'minimal',
      showTags: false,
      showReadingTime: false,
      nav: [{ label: 'Start here', href: '/start' }],
      pinned: ['a-post'],
      authors: ['alice', 'bob'],
      community: 'hive-123456',
      showPayout: true,
      showComments: true,
      customDomain: 'blog.alice.example',
      directory: true,
      ogImage: 'https://images.hive.blog/og.png',
      updatedAt: '2026-11-27T00:00:00.000Z'
    }, { account: ACCOUNT })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.settings).toMatchObject({
      claimed: true,
      title: 'Alice writes',
      theme: 'terminal',
      accent: '#39ff88',
      layout: 'magazine',
      width: 'narrow',
      typography: 'serif',
      hero: 'minimal',
      showTags: false,
      showReadingTime: false,
      pinned: ['a-post'],
      authors: ['alice', 'bob'],
      community: 'hive-123456',
      customDomain: 'blog.alice.example'
    })
  })

  it('warns about unknown fields without rejecting the blog', () => {
    const result = normalizeBlogSettings({ version: 1, claimed: true, title: 'x', surprise: true })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings.join(' ')).toContain('surprise is not a recognised blog field')
  })

  it('keeps a blog claimed when a newer client writes an unknown key', () => {
    const account = accountWith({
      'banksia.io': {
        blog: {
          version: 1,
          claimed: true,
          title: 'Alice writes',
          futureField: { anything: true },
          shop: { enabled: true, featured: ['alice/managed-hosting'] }
        }
      }
    })
    const read = readBlogSettings(account)
    expect(read.claimed).toBe(true)
    expect(read.settings.shop.featured).toEqual(['alice/managed-hosting'])
    expect(read.warnings.join(' ')).toContain('futureField is not a recognised blog field')
  })

  it('rejects HTML and invalid themes/colours', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: '<script>alert(1)</script>',
      theme: 'Not A Theme',
      accent: 'red'
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('title must be plain text')
    expect(result.errors.join(' ')).toContain('theme must be')
    expect(result.errors.join(' ')).toContain('accent must be')
  })

  it('rejects non-https or script navigation links', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      nav: [{ label: 'Bad', href: 'javascript:alert(1)' }, { label: 'Good', href: 'https://example.com' }]
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('nav[].href must be')
  })

  it('deduplicates pinned posts and contributors', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      pinned: ['a-post', 'a-post', 'b-post'],
      authors: ['Alice', 'alice', 'bob']
    }, { account: ACCOUNT })
    expect(result.ok).toBe(true)
    expect(result.settings.pinned).toEqual(['a-post', 'b-post'])
    expect(result.settings.authors).toEqual(['alice', 'bob'])
  })

  it('rejects an invalid community and custom domain', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      community: 'not-a-community',
      customDomain: 'https://blog.example.com/path'
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('community must look like hive-123456')
    expect(result.errors.join(' ')).toContain('customDomain must be a bare hostname')
  })

  it('rejects a non-boolean directory flag', () => {
    const result = normalizeBlogSettings({ version: 1, claimed: true, title: 'x', directory: 'yes' })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('directory must be a boolean')
  })

  it('rejects unknown layout, width, typography or hero values', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      layout: 'carousel',
      width: 'huge',
      typography: 'comic',
      hero: 'none'
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('layout must be one of')
    expect(result.errors.join(' ')).toContain('width must be one of')
    expect(result.errors.join(' ')).toContain('typography must be one of')
    expect(result.errors.join(' ')).toContain('hero must be one of')
  })

  it('requires an https social card URL', () => {
    const ok = normalizeBlogSettings({ version: 1, claimed: true, title: 'x', ogImage: 'https://images.hive.blog/og.png' })
    expect(ok.ok).toBe(true)
    expect(ok.settings.ogImage).toBe('https://images.hive.blog/og.png')
    const bad = normalizeBlogSettings({ version: 1, claimed: true, title: 'x', ogImage: 'http://images.hive.blog/og.png' })
    expect(bad.ok).toBe(false)
    expect(bad.errors.join(' ')).toContain('ogImage must be an https URL')
  })

  it('defaults to hero, pinned and archive sections', () => {
    const settings = defaultBlogSettings(ACCOUNT)
    expect(settings.blocks).toEqual([
      { type: 'hero', visible: true },
      { type: 'pinned', visible: true },
      { type: 'archive', visible: true }
    ])
    expect(settings.css).toBe('')
    expect(settings.logo).toBe('')
    expect(settings.heroImage).toBe('')
    expect(settings.favicon).toBe('')
  })

  it('accepts custom sections and branding URLs', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      blocks: [
        { type: 'text', visible: true, title: 'Welcome', body: 'Hello **world**.' },
        { type: 'archive', visible: true, layout: 'list' }
      ],
      logo: 'https://images.hive.blog/logo.png',
      heroImage: 'https://images.hive.blog/hero.png',
      favicon: 'https://images.hive.blog/favicon.png'
    })
    expect(result.ok).toBe(true)
    expect(result.settings.blocks).toHaveLength(2)
    expect(result.settings.blocks[0]).toMatchObject({ type: 'text', title: 'Welcome' })
    expect(result.settings.logo).toBe('https://images.hive.blog/logo.png')
    expect(result.settings.heroImage).toBe('https://images.hive.blog/hero.png')
    expect(result.settings.favicon).toBe('https://images.hive.blog/favicon.png')
  })

  it('sanitizes custom CSS', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      css: '@import url(https://evil.example/x.css); a{background:url(data:image/png;base64,xx)} b{background:url(http://x.example/y.png)} c{background:url(https://ok.example/z.png)}'
    })
    expect(result.ok).toBe(true)
    expect(result.settings.css).not.toContain('@import')
    expect(result.settings.css).not.toContain('data:')
    expect(result.settings.css).toContain('url("https://x.example/y.png")')
    expect(result.settings.css).toContain('url("https://ok.example/z.png")')
    expect(result.settings.css).toContain('url("about:blank")')
  })

  it('rejects duplicate fixed sections and unknown section types', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      blocks: [
        { type: 'hero' },
        { type: 'hero' },
        { type: 'carousel' }
      ]
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('more than one hero section')
    expect(result.errors.join(' ')).toContain('blocks[].type must be one of')
  })

  it('accepts portfolio and shop settings', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      portfolio: {
        enabled: true,
        title: 'Selected work',
        description: 'A small gallery.',
        layout: 'masonry',
        items: ['a-post', 'a-post', 'b-post']
      },
      shop: {
        enabled: true,
        title: 'Shop',
        description: 'Buy directly from Hive.',
        source: 'tag',
        tag: 'Hosting',
        featured: ['alice/managed-hosting', 'Alice/managed-hosting', 'bob/art'],
        layout: 'list',
        showSoldOut: false,
        sort: 'price-asc'
      }
    })
    expect(result.ok).toBe(true)
    expect(result.settings.portfolio).toMatchObject({
      enabled: true,
      title: 'Selected work',
      layout: 'masonry',
      items: ['a-post', 'b-post']
    })
    expect(result.settings.shop).toEqual({
      enabled: true,
      title: 'Shop',
      description: 'Buy directly from Hive.',
      source: 'tag',
      tag: 'hosting',
      featured: ['alice/managed-hosting', 'bob/art'],
      layout: 'list',
      showSoldOut: false,
      sort: 'price-asc'
    })
  })

  it('rejects invalid shop enums, tags and product references', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      shop: {
        source: 'everywhere',
        tag: 'Not a tag!',
        featured: ['alice', '../escape', 'alice/managed-hosting'],
        layout: 'carousel',
        showSoldOut: 'no',
        sort: 'oldest'
      }
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('shop.source must be one of')
    expect(result.errors.join(' ')).toContain('shop.tag must be a Hive tag')
    expect(result.errors.join(' ')).toContain('shop.featured contains an invalid product reference')
    expect(result.errors.join(' ')).toContain('shop.layout must be one of')
    expect(result.errors.join(' ')).toContain('shop.showSoldOut must be a boolean')
    expect(result.errors.join(' ')).toContain('shop.sort must be one of')
  })

  it('caps featured shop products and warns about unknown nested fields', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      shop: {
        featured: Array.from({ length: 13 }, (_, index) => 'alice/product-' + index),
        futureLayout: true
      }
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('shop.featured supports at most 12 products')
    expect(result.warnings.join(' ')).toContain('shop.futureLayout is not a recognised field')
    expect(result.settings.shop.featured).toHaveLength(12)
  })

  it('rejects an invalid portfolio layout and too many items', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x',
      portfolio: {
        layout: 'carousel',
        items: Array.from({ length: 13 }, (_, index) => 'post-' + index)
      }
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('portfolio.layout must be one of')
    expect(result.errors.join(' ')).toContain('portfolio.items supports at most 12 entries')
  })

  it('caps the total blog object size', () => {
    const result = normalizeBlogSettings({
      version: 1,
      claimed: true,
      title: 'x'.repeat(80),
      description: 'y'.repeat(240),
      css: 'x'.repeat(8000),
      blocks: Array.from({ length: 10 }, (_, index) => ({
        type: 'text',
        visible: true,
        title: 'Section ' + index,
        body: 'b'.repeat(1200)
      }))
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('12000 bytes or fewer')
  })
})

describe('reading blog settings from chain metadata', () => {
  it('reads the banksia.io namespace', () => {
    const read = readBlogSettings(accountWith({
      'banksia.io': { theme: THEME, blog: { version: 1, claimed: true, title: 'On chain' } }
    }))
    expect(read.claimed).toBe(true)
    expect(read.settings.title).toBe('On chain')
    expect(read.error).toBe('')
  })

  it('reads the legacy namespace', () => {
    const read = readBlogSettings(accountWith({
      'hive.ausbit.dev': { blog: { version: 1, claimed: true, title: 'Legacy' } }
    }))
    expect(read.claimed).toBe(true)
    expect(read.settings.title).toBe('Legacy')
  })

  it('degrades to defaults when the namespace is absent or malformed', () => {
    expect(readBlogSettings(ACCOUNT).claimed).toBe(false)
    const malformed = readBlogSettings({ name: 'alice', posting_json_metadata: '{not json' })
    expect(malformed.settings.title).toBe('alice')
    expect(malformed.claimed).toBe(false)
  })
})

describe('writing blog settings', () => {
  it('merges the blog without dropping the profile or theme', () => {
    const merged = mergeBlogMetadata(ACCOUNT.posting_json_metadata, { version: 1, claimed: true, title: 'New' })
    expect(merged.ok).toBe(true)
    const value = JSON.parse(merged.text)
    expect(value.profile.name).toBe('Alice')
    expect(value['banksia.io'].theme).toEqual(THEME)
    expect(value['banksia.io'].blog.title).toBe('New')
  })

  it('migrates a legacy namespace and removes the duplicate', () => {
    const merged = mergeBlogMetadata(JSON.stringify({
      profile: { name: 'Alice' },
      'hive.ausbit.dev': { theme: THEME }
    }), { version: 1, claimed: true, title: 'New' })
    expect(merged.ok).toBe(true)
    const value = JSON.parse(merged.text)
    expect(value['hive.ausbit.dev']).toBeUndefined()
    expect(value['banksia.io'].theme).toEqual(THEME)
    expect(value.profile.name).toBe('Alice')
  })

  it('builds a claiming account_update2 with posting authority only', () => {
    const result = claimBlog(ACCOUNT, { title: 'Alice writes' })
    expect(result.ok).toBe(true)
    expect(result.operation[0]).toBe('account_update2')
    expect(result.operation[1].account).toBe('alice')
    expect(result.operation[1].json_metadata).toBe('')

    const value = JSON.parse(result.operation[1].posting_json_metadata)
    expect(value['banksia.io'].blog.claimed).toBe(true)
    expect(value['banksia.io'].blog.title).toBe('Alice writes')
    expect(value['banksia.io'].theme).toEqual(THEME)
    expect(value.profile.name).toBe('Alice')
  })

  it('updates an existing blog and stamps updatedAt', () => {
    const current = readBlogSettings(accountWith({
      'banksia.io': { blog: { version: 1, claimed: true, title: 'Old' } }
    })).settings
    const result = updateBlog(accountWith({
      'banksia.io': { blog: { version: 1, claimed: true, title: 'Old' } }
    }), { ...current, title: 'New' })
    expect(result.ok).toBe(true)
    const value = JSON.parse(result.operation[1].posting_json_metadata)
    expect(value['banksia.io'].blog.title).toBe('New')
    expect(value['banksia.io'].blog.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('removes the blog while keeping the theme', () => {
    const removed = removeBlogMetadata(JSON.stringify({
      'banksia.io': { theme: THEME, blog: { version: 1, claimed: true, title: 'X' } }
    }))
    expect(removed.ok).toBe(true)
    const value = JSON.parse(removed.text)
    expect(value['banksia.io'].blog).toBeUndefined()
    expect(value['banksia.io'].theme).toEqual(THEME)
  })

  it('reports the blog object size', () => {
    expect(blogSettingsSize({ title: 'x' })).toBe(JSON.stringify({ title: 'x' }).length)
    expect(blogSettingsSize(null)).toBe(4)
  })
})

describe('sanitizeBlogCss', () => {
  it('returns empty for non-strings and blank input', () => {
    expect(sanitizeBlogCss(null)).toBe('')
    expect(sanitizeBlogCss(12)).toBe('')
    expect(sanitizeBlogCss('')).toBe('')
  })

  it('strips style tags, imports and script-era CSS', () => {
    const css = sanitizeBlogCss([
      '</style><script>alert(1)</script>',
      '@import url("https://evil.example/a.css");',
      'a { width: expression(alert(1)); background: url(javascript:alert(1)); }',
      'b { behavior: url(x.htc); -moz-binding: url(x.xml); }'
    ].join('\n'))
    expect(css).not.toMatch(/<\/?style/i)
    expect(css).not.toMatch(/@import/i)
    expect(css).not.toMatch(/expression\s*\(/i)
    expect(css).not.toMatch(/javascript\s*:/i)
    expect(css).not.toMatch(/vbscript\s*:/i)
    expect(css).not.toMatch(/behavior\s*:/i)
    expect(css).not.toMatch(/-moz-binding/i)
    // Raw script tags are left as text but the style tag that could break out
    // of the `<style>` element is gone.
    expect(css).not.toContain('</style>')
  })

  it('defeats CSS-escape and data-URL spellings', () => {
    const css = sanitizeBlogCss([
      '@\\69mport url(https://evil.example/x.css);',
      'a { background: image-set("data:image/svg+xml,<svg/>"); }',
      'b { width: expr\\65 ssion(alert(1)); }'
    ].join('\n'))
    expect(css).not.toMatch(/@\s*import/i)
    expect(css).not.toContain('data:')
    expect(css).not.toMatch(/expression\s*\(/i)
    expect(css).not.toContain('\\')
  })

  it('allows https and root-relative urls, upgrades http and blocks the rest', () => {
    expect(sanitizeBlogCss('a { background: url(https://cdn.example/a.png) }'))
      .toContain('url("https://cdn.example/a.png")')
    expect(sanitizeBlogCss('a { background: url(/images/a.png) }'))
      .toContain('url("/images/a.png")')
    expect(sanitizeBlogCss('a { background: url(http://cdn.example/a.png) }'))
      .toContain('url("https://cdn.example/a.png")')
    expect(sanitizeBlogCss('a { background: url(//cdn.example/a.png) }'))
      .toContain('url("about:blank")')
    expect(sanitizeBlogCss('a { background: url(data:image/png;base64,aaaa) }'))
      .toContain('url("about:blank")')
    expect(sanitizeBlogCss("a { background: url('javascript:alert(1)') }"))
      .toContain('url("about:blank")')
  })

  it('caps the stylesheet length', () => {
    const css = sanitizeBlogCss('a{color:red}'.repeat(2000))
    expect(css.length).toBe(8000)
  })
})
