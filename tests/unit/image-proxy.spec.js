import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_PROXY,
  decodeBase58,
  decodeProxiedImageUrl,
  getImageProxyMode,
  imageProxyBase,
  normalizeImageProxyMode,
  resizeImageUrl,
  rewriteProxiedImageUrl,
  rewriteSrcset,
  setImageProxyMode,
  shortFormImageUrl
} from '../../src/services/imageProxy'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const SOURCE = 'https://images.hive.blog/DQmabfs4mUa1RZ85rKi3LHPMRnZr29oWRTSbVgT9EbgmLjo/1.jpg'
const HASH = '4PYjjVwJ1UdtKm1ixfRE6SfgaSiANQC1qU1d2n4M6mJ9tGtovKC5MtLA5jwtdVtdWyAXuLKii8Ym1zorCTTELFz14mBW56tCm8ZwbQHCcgE'
const PROXIED = 'https://i.ecency.com/p/' + HASH + '?format=match&mode=fit&width=800'

function encodeBase58 (value) {
  const bytes = new TextEncoder().encode(value)
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i += 1) digits.push(0)
  return digits.reverse().map(digit => BASE58_ALPHABET[digit]).join('')
}

function proxied (source) {
  return 'https://i.ecency.com/p/' + encodeBase58(source) + '?format=match&mode=fit&width=800'
}

afterEach(() => setImageProxyMode(DEFAULT_IMAGE_PROXY))

describe('image proxy mode', () => {
  it('defaults to the Hive image host and normalises unknown values', () => {
    expect(DEFAULT_IMAGE_PROXY).toBe('hive')
    expect(normalizeImageProxyMode(undefined)).toBe('hive')
    expect(normalizeImageProxyMode('ECENCY')).toBe('ecency')
    expect(normalizeImageProxyMode('direct')).toBe('direct')
    expect(normalizeImageProxyMode('elsewhere')).toBe('hive')
    expect(getImageProxyMode()).toBe('hive')
    expect(setImageProxyMode('ecency')).toBe('ecency')
    expect(getImageProxyMode()).toBe('ecency')
    expect(imageProxyBase('hive')).toBe('https://images.hive.blog')
    expect(imageProxyBase('ecency')).toBe('https://i.ecency.com')
    expect(imageProxyBase('direct')).toBe('')
  })
})

describe('proxied image URLs', () => {
  it('decodes the base58 source URL both proxy hosts use', () => {
    expect(new TextDecoder().decode(decodeBase58(HASH))).toBe(SOURCE)
    expect(decodeProxiedImageUrl(PROXIED)).toBe(SOURCE)
  })

  it('unwraps nested proxy URLs', () => {
    const nested = proxied(PROXIED)
    expect(decodeProxiedImageUrl(nested)).toBe(SOURCE)
  })

  it('moves the same transform between proxy hosts', () => {
    expect(rewriteProxiedImageUrl(PROXIED, 'hive'))
      .toBe('https://images.hive.blog/p/' + HASH + '?format=match&mode=fit&width=800')
    expect(rewriteProxiedImageUrl(PROXIED.replace('i.ecency.com', 'images.hive.blog'), 'ecency'))
      .toBe(PROXIED)
    expect(rewriteProxiedImageUrl(PROXIED, 'direct')).toBe(SOURCE)
  })

  it('drops the AVIF format the Hive host cannot produce', () => {
    const avif = 'https://i.ecency.com/p/' + HASH + '?format=avif&mode=fit&width=800'
    expect(rewriteProxiedImageUrl(avif, 'hive'))
      .toBe('https://images.hive.blog/p/' + HASH + '?format=match&mode=fit&width=800')
  })

  it('loads query-string sources directly because the Hive host refuses them', () => {
    const source = 'https://files.peakd.com/file/peakd-hive/alice/photo.png?w=100'
    expect(rewriteProxiedImageUrl(proxied(source), 'hive')).toBe(source)
  })

  it('leaves non-proxied URLs untouched', () => {
    expect(rewriteProxiedImageUrl('https://files.peakd.com/a.png', 'direct'))
      .toBe('https://files.peakd.com/a.png')
  })

  it('rewrites every srcset candidate', () => {
    const srcset = 'https://i.ecency.com/p/' + HASH + '?format=match&width=320 320w, ' +
      'https://i.ecency.com/p/' + HASH + '?format=match&width=800 800w'
    expect(rewriteSrcset(srcset, 'hive')).toBe(
      'https://images.hive.blog/p/' + HASH + '?format=match&width=320 320w, ' +
      'https://images.hive.blog/p/' + HASH + '?format=match&width=800 800w'
    )
  })
})

describe('resizeImageUrl', () => {
  const peakd = 'https://files.peakd.com/file/peakd-hive/alice/photo.png'

  it('uses the selected proxy for known Hive image hosts', () => {
    expect(resizeImageUrl(peakd, 480, 0, 'hive')).toBe('https://images.hive.blog/480x0/' + peakd)
    expect(resizeImageUrl(peakd, 480, 0, 'ecency')).toBe('https://i.ecency.com/480x0/' + peakd)
    expect(resizeImageUrl(peakd, 480, 0, 'direct')).toBe(peakd)
  })

  it('leaves unknown hosts and sized avatars alone', () => {
    expect(resizeImageUrl('https://cdn.example/photo.png', 480, 0, 'hive'))
      .toBe('https://cdn.example/photo.png')
    expect(resizeImageUrl('https://i.ecency.com/u/alice/avatar/large', 64, 0, 'hive'))
      .toBe('https://i.ecency.com/u/alice/avatar/large')
  })

  it('keeps query-string sources direct on the Hive host', () => {
    expect(resizeImageUrl(peakd + '?w=100', 480, 0, 'hive')).toBe(peakd + '?w=100')
  })

  it('retargets an already-proxied card image', () => {
    expect(resizeImageUrl(PROXIED, 480, 0, 'hive'))
      .toBe('https://images.hive.blog/p/' + HASH + '?format=match&mode=fit&width=800')
  })
})

describe('shortFormImageUrl', () => {
  it('proxies gallery images to the selected host', () => {
    const url = 'https://cdn.liketu.com/liketu/alice/photo.webp'
    expect(shortFormImageUrl(url, 900, 560, 'hive')).toBe('https://images.hive.blog/900x560/' + url)
    expect(shortFormImageUrl(url, 900, 560, 'ecency')).toBe('https://i.ecency.com/900x560/' + url)
    expect(shortFormImageUrl(url, 900, 560, 'direct')).toBe(url)
  })

  it('keeps hosts that already serve sized assets', () => {
    const url = 'https://files.peakd.com/file/peakd-hive/alice/photo.png'
    expect(shortFormImageUrl(url, 600, 800, 'hive')).toBe(url)
  })
})
