import { describe, expect, it } from 'vitest'
import {
  blogAccountFromHost,
  blogBaseUrl,
  blogPostFallbackPath,
  blogPostPath,
  blogPostPathFor,
  blogPostUrl,
  blogSettingsUrl,
  decodeBlogLabel,
  encodeBlogLabel,
  isReservedBlogLabel,
  isValidHiveAccountName,
  normalizeHostname,
  resolveBlogHost
} from '../../src/services/blogHost'

describe('blog host encoding', () => {
  it('normalises a Host value', () => {
    expect(normalizeHostname('HTTPS://Alice.Banksia.IO:443/path?q=1')).toBe('alice.banksia.io')
    expect(normalizeHostname('alice.banksia.io.')).toBe('alice.banksia.io')
    expect(normalizeHostname('')).toBe('')
  })

  it('encodes a dotted Hive name as one DNS label', () => {
    expect(encodeBlogLabel('alice')).toBe('alice')
    expect(encodeBlogLabel('HIVE.FUND')).toBe('hive--fund')
    expect(encodeBlogLabel('not a name')).toBe('')
    expect(encodeBlogLabel('a')).toBe('')
  })

  it('decodes the double-hyphen escape back to dots', () => {
    expect(decodeBlogLabel('alice')).toBe('alice')
    expect(decodeBlogLabel('hive--fund')).toBe('hive.fund')
    expect(decodeBlogLabel('bad--')).toBe('')
    expect(decodeBlogLabel('bad--name')).toBe('bad.name')
    expect(decodeBlogLabel('-bad')).toBe('')
  })

  it('validates Hive account names with the same shape used elsewhere', () => {
    expect(isValidHiveAccountName('alice')).toBe(true)
    expect(isValidHiveAccountName('hive.fund')).toBe(true)
    expect(isValidHiveAccountName('hive-fund')).toBe(true)
    expect(isValidHiveAccountName('a')).toBe(false)
    expect(isValidHiveAccountName('alice--bob')).toBe(false)
    expect(isValidHiveAccountName('alice..bob')).toBe(false)
    expect(isValidHiveAccountName('alice-.bob')).toBe(false)
    expect(isValidHiveAccountName('a.b')).toBe(false)
    expect(isValidHiveAccountName('alice.b')).toBe(false)
    expect(isValidHiveAccountName('-alice')).toBe(false)
  })
})

describe('resolveBlogHost', () => {
  it('leaves the apex and legacy hosts alone', () => {
    for (const host of ['banksia.io', 'www.banksia.io', 'hive.ausbit.dev', 'www.hive.ausbit.dev', 'localhost']) {
      expect(resolveBlogHost(host).mode).toBe('apex')
    }
  })

  it('resolves a first-level account host', () => {
    expect(resolveBlogHost('alice.banksia.io')).toMatchObject({
      mode: 'blog',
      label: 'alice',
      account: 'alice'
    })
    expect(blogAccountFromHost('https://alice.banksia.io/post')).toBe('alice')
  })

  it('resolves a dotted account through the double-hyphen label', () => {
    expect(resolveBlogHost('hive--fund.banksia.io')).toMatchObject({
      mode: 'blog',
      account: 'hive.fund'
    })
  })

  it('reserves service and route labels', () => {
    expect(isReservedBlogLabel('files')).toBe(true)
    expect(resolveBlogHost('files.banksia.io')).toMatchObject({ mode: 'apex', reason: 'reserved' })
    expect(resolveBlogHost('www.banksia.io')).toMatchObject({ mode: 'apex' })
    expect(resolveBlogHost('api.banksia.io')).toMatchObject({ mode: 'apex', reason: 'reserved' })
  })

  it('rejects deeper subdomains rather than guessing an account', () => {
    expect(resolveBlogHost('a.b.banksia.io')).toMatchObject({ mode: 'unsupported', reason: 'nested' })
  })

  it('supports localhost for local development', () => {
    expect(resolveBlogHost('alice.localhost')).toMatchObject({ mode: 'blog', account: 'alice' })
    expect(resolveBlogHost('alice.localhost', { allowLocalhost: false }).mode).toBe('apex')
  })

  it('leaves unknown hosts on the explorer', () => {
    expect(resolveBlogHost('blog.example.com')).toMatchObject({ mode: 'apex', reason: 'unknown-host' })
  })
})

describe('blog URLs', () => {
  it('builds the public origin and post paths', () => {
    expect(blogBaseUrl('alice')).toBe('https://alice.banksia.io')
    expect(blogBaseUrl('hive.fund')).toBe('https://hive--fund.banksia.io')
    expect(blogBaseUrl('not a name')).toBe('')
    expect(blogPostPath('my-post')).toBe('/my-post')
    expect(blogPostPath('bad path')).toBe('/')
    expect(blogPostPathFor('my-post', 'alice', 'alice')).toBe('/my-post')
    expect(blogPostPathFor('my-post', 'bob', 'alice')).toBe('/@bob/my-post')
    expect(blogPostPathFor('about', 'alice', 'alice')).toBe('/p/about')
    expect(blogPostPathFor('shop', 'alice', 'alice')).toBe('/p/shop')
    expect(blogPostPathFor('portfolio', 'alice', 'alice')).toBe('/p/portfolio')
    expect(blogPostPathFor('rss', 'alice', 'alice')).toBe('/p/rss')
    expect(blogPostPathFor('report.pdf', 'alice', 'alice')).toBe('/p/report.pdf')
    expect(blogPostFallbackPath('about')).toBe('/p/about')
    expect(blogPostUrl('alice', 'my-post')).toBe('https://alice.banksia.io/my-post')
  })

  it('reserves service and blog route labels', () => {
    for (const label of ['settings', 'shop', 'portfolio', 'checkout', 'cart', 'orders', 'subscribe', 'subscriptions', 'wallet']) {
      expect(resolveBlogHost(label + '.banksia.io').mode, label).not.toBe('blog')
    }
  })

  it('builds the apex settings URL', () => {
    expect(blogSettingsUrl('alice')).toBe('https://banksia.io/settings/blog?account=alice')
    expect(blogSettingsUrl('')).toBe('https://banksia.io/settings/blog')
  })
})
