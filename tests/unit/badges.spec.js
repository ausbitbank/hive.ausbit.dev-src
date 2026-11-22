import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/chainData', () => ({
  fetchAccounts: vi.fn()
}))

vi.mock('../../src/services/api', () => ({
  apiGetFollowers: vi.fn()
}))

import { fetchAccounts } from '../../src/services/chainData'
import { apiGetFollowers } from '../../src/services/api'
import {
  clearBadgeCache,
  fetchBadgeSuggestions,
  fetchHiveBuzzBadges,
  fetchPeakdBadgeAccountNames,
  fetchPeakdBadges,
  hivebuzzLevelBadge,
  isSafeBadgeImage,
  normalizeBadge,
  resolveProfileBadges
} from '../../src/services/badges'
import { credentialFor, isCredentialBadge } from '../../src/data/badges/credentials'

function jsonResponse (value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function peakdAccount (name, profile) {
  return {
    name,
    posting_json_metadata: JSON.stringify({ profile })
  }
}

beforeEach(() => {
  clearBadgeCache()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('credential allowlist', () => {
  it('only recognises curated issuer badges', () => {
    expect(isCredentialBadge('peakd', 'badge-069069')).toBe(true)
    expect(credentialFor('peakd', 'badge-069069').issuer).toBe('NFT Showroom')
    expect(isCredentialBadge('peakd', 'badge-100100')).toBe(false)
    expect(isCredentialBadge('peakd', 'Verified')).toBe(false)
  })
})

describe('PeakD badges', () => {
  it('proxies membership, filters incomplete metadata and marks credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      expect(String(url)).toBe('/api/badges/peakd?account=alice')
      return jsonResponse({ account: 'alice', badges: ['badge-069069', 'badge-100421', 'badge-100100'] })
    }))
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-069069', { name: 'NFT Showroom Verified Artist', about: '<p>Verified artist</p>', profile_image: 'https://files.peakd.com/file/a.png' }),
      peakdAccount('badge-100421', { about: 'No name or image' }),
      peakdAccount('badge-100100', { name: 'Hive Witness - Top 100', profile_image: 'https://files.peakd.com/file/b.png' })
    ])

    const badges = await fetchPeakdBadges('alice')
    expect(badges).toHaveLength(2)
    const credential = badges.find(badge => badge.id === 'badge-069069')
    expect(credential.verified).toBe(true)
    expect(credential.issuer).toBe('NFT Showroom')
    expect(credential.description).toBe('Verified artist')
    expect(badges.find(badge => badge.id === 'badge-100100').verified).toBe(false)
  })

  it('falls back to Hive followers when the proxy fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('proxy down') }))
    apiGetFollowers.mockResolvedValue([{ follower: 'badge-424242' }, { follower: 'alice' }])
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-424242', { name: 'Hive Devs', profile_image: 'https://files.peakd.com/file/dev.png' })
    ])
    const names = await fetchPeakdBadgeAccountNames('alice')
    expect(names).toEqual(['badge-424242'])
    expect(apiGetFollowers).toHaveBeenCalledWith('alice', '', 'blog', 1000)
  })

  it('omits images on unknown hosts and invalid accounts make no request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ badges: ['badge-424242'] }))
    vi.stubGlobal('fetch', fetchMock)
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-424242', { name: 'Hive Devs', profile_image: 'https://evil.example/a.png' })
    ])
    expect(await fetchPeakdBadges('alice')).toEqual([])
    expect(await fetchPeakdBadges('Not A Name')).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches membership for an hour', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ badges: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchPeakdBadgeAccountNames('alice')
    await fetchPeakdBadgeAccountNames('alice')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('HiveBuzz badges', () => {
  it('keeps only collected badges and sanitises descriptions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      { id: 'first-post', title: 'First post', state: 'on', description: '<b>Posted</b> once', url: 'https://hivebuzz.me/badges/first-post.png' },
      { id: 'off-badge', title: 'Off', state: 'off', url: 'https://hivebuzz.me/badges/off.png' },
      { id: 'exp-badge', title: 'Expired', state: 'exp', url: 'https://hivebuzz.me/badges/exp.png' }
    ])))
    const badges = await fetchHiveBuzzBadges('alice')
    expect(badges).toHaveLength(1)
    expect(badges[0].description).toBe('Posted once')
    expect(badges[0].verified).toBe(false)
    expect(badges[0].url).toBe('https://hivebuzz.me/@alice')
    expect(hivebuzzLevelBadge('alice').image).toBe('https://hivebuzz.me/api/level/alice')
  })

  it('shows earned and unearned badges in the Studio suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).includes('/badges/')) {
        return jsonResponse([
          { id: 'first-post', title: 'First post', state: 'on', url: 'https://hivebuzz.me/a.png' },
          { id: 'future', title: 'Future', state: 'off', url: 'https://hivebuzz.me/b.png' }
        ])
      }
      return jsonResponse({ badges: [] })
    }))
    const suggestions = await fetchBadgeSuggestions('alice')
    expect(suggestions.hivebuzz).toHaveLength(2)
    expect(suggestions.hivebuzz.filter(badge => badge.earned)).toHaveLength(1)
  })
})

describe('profile badge resolution', () => {
  it('resolves selected badges plus the optional level and omits misses', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      const value = String(url)
      if (value.startsWith('/api/badges/peakd')) {
        return jsonResponse({ badges: ['badge-069069'] })
      }
      return jsonResponse([
        { id: 'first-post', title: 'First post', state: 'on', url: 'https://hivebuzz.me/a.png' }
      ])
    }))
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-069069', { name: 'NFT Showroom Verified Artist', profile_image: 'https://files.peakd.com/a.png' })
    ])
    const theme = {
      profile: {
        badges: {
          showLevel: true,
          selected: [
            { source: 'peakd', id: 'badge-069069' },
            { source: 'hivebuzz', id: 'first-post' },
            { source: 'hivebuzz', id: 'missing' }
          ]
        }
      }
    }
    const badges = await resolveProfileBadges(theme, 'alice')
    expect(badges.map(badge => badge.source + ':' + badge.id)).toEqual([
      'hivebuzz:level',
      'peakd:badge-069069',
      'hivebuzz:first-post'
    ])
  })

  it('normalises untrusted fields', () => {
    const badge = normalizeBadge({
      source: 'peakd',
      id: 'badge-069069',
      title: '<b>Title</b>',
      issuer: '<i>Issuer</i>',
      description: '<script>alert(1)</script>Hello',
      image: 'https://files.peakd.com/a.png',
      url: 'https://peakd.com/b/badge-069069',
      kind: 'credential',
      verified: true
    })
    expect(badge.title).toBe('Title')
    expect(badge.issuer).toBe('Issuer')
    expect(badge.description).toBe('Hello')
    expect(isSafeBadgeImage(badge.image)).toBe(true)
    expect(isSafeBadgeImage('https://evil.example/a.png')).toBe(false)
  })
})
