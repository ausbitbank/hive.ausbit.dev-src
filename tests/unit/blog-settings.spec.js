import { describe, expect, it } from 'vitest'
import {
  blogSettingsSize,
  claimBlog,
  defaultBlogSettings,
  mergeBlogMetadata,
  normalizeBlogSettings,
  readBlogSettings,
  removeBlogMetadata,
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
      showReadingTime: true
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

  it('rejects unknown fields rather than silently accepting them', () => {
    const result = normalizeBlogSettings({ version: 1, claimed: true, title: 'x', surprise: true })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('surprise is not a recognised blog field')
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
