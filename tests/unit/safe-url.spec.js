import { describe, expect, it } from 'vitest'
import { safeExternalUrl, safeHrefAttrs } from '../../src/utils/safeUrl'

describe('safeExternalUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(safeExternalUrl('https://example.com/path?q=1#top')).toBe(
      'https://example.com/path?q=1#top'
    )
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/')
    expect(safeExternalUrl('  https://example.com/profile  ')).toBe(
      'https://example.com/profile'
    )
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['file:', 'file:///etc/passwd'],
    ['ftp:', 'ftp://example.com/file'],
    ['tel:', 'tel:+123456789']
  ])('rejects the %s scheme', (_name, value) => {
    expect(safeExternalUrl(value)).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeExternalUrl('//evil.example/path')).toBeNull()
    expect(safeExternalUrl('//evil.example')).toBeNull()
  })

  it('rejects control characters used to smuggle schemes', () => {
    expect(safeExternalUrl('java\nscript:alert(1)')).toBeNull()
    expect(safeExternalUrl('https://example.com/\u0000path')).toBeNull()
    expect(safeExternalUrl('https://example.com/\u001f')).toBeNull()
    expect(safeExternalUrl('https://example.com/\u007f')).toBeNull()
  })

  it('rejects malformed and non-absolute values', () => {
    expect(safeExternalUrl('not a url')).toBeNull()
    expect(safeExternalUrl('example.com/path')).toBeNull()
    expect(safeExternalUrl('https://')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
  })

  it('rejects non-string values', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl(42)).toBeNull()
    expect(safeExternalUrl({ href: 'https://example.com' })).toBeNull()
  })

  it('rejects mailto by default and accepts it when allowMailto is set', () => {
    expect(safeExternalUrl('mailto:user@example.com')).toBeNull()
    expect(safeExternalUrl('mailto:user@example.com', { allowMailto: true })).toBe(
      'mailto:user@example.com'
    )
    expect(safeExternalUrl('mailto:', { allowMailto: true })).toBeNull()
    // allowMailto must not widen support to other schemes.
    expect(safeExternalUrl('javascript:alert(1)', { allowMailto: true })).toBeNull()
  })
})

describe('safeHrefAttrs', () => {
  it('returns hardened anchor attributes for safe URLs', () => {
    expect(safeHrefAttrs('https://example.com/profile')).toEqual({
      href: 'https://example.com/profile',
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  })

  it('returns an empty object for unsafe URLs', () => {
    expect(safeHrefAttrs('javascript:alert(1)')).toEqual({})
    expect(safeHrefAttrs('//evil.example')).toEqual({})
    expect(safeHrefAttrs(null)).toEqual({})
  })

  it('passes the allowMailto option through', () => {
    expect(safeHrefAttrs('mailto:user@example.com')).toEqual({})
    expect(safeHrefAttrs('mailto:user@example.com', { allowMailto: true })).toEqual({
      href: 'mailto:user@example.com',
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  })
})
