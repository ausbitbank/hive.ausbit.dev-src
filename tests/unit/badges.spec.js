import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/chainData', () => ({
  fetchAccounts: vi.fn()
}))

vi.mock('../../src/services/api', () => ({
  apiGetFollowers: vi.fn(),
  bridgeRequest: vi.fn()
}))

import { fetchAccounts } from '../../src/services/chainData'
import { apiGetFollowers, bridgeRequest } from '../../src/services/api'
import {
  PEAKD_FOLLOWER_PAGE_SIZE,
  checkPeakdMembership,
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

describe('PeakD membership', () => {
  it('confirms selected badge accounts directly with the follow relationship', async () => {
    bridgeRequest.mockImplementation(async (_method, [badge]) => ({ follows: badge === 'badge-069069' }))
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-069069', { name: 'NFT Showroom Verified Artist', about: '<p>Verified artist</p>', profile_image: 'https://files.peakd.com/file/a.png' })
    ])
    const theme = {
      profile: {
        badges: {
          showLevel: false,
          selected: [
            { source: 'peakd', id: 'badge-069069' },
            { source: 'peakd', id: 'badge-100100' }
          ]
        }
      }
    }
    const badges = await resolveProfileBadges(theme, 'alice')
    expect(badges).toHaveLength(1)
    expect(badges[0].id).toBe('badge-069069')
    expect(badges[0].verified).toBe(true)
    expect(badges[0].issuer).toBe('NFT Showroom')
    expect(bridgeRequest).toHaveBeenCalledWith('get_relationship_between_accounts', ['badge-069069', 'alice'])
    expect(bridgeRequest).toHaveBeenCalledWith('get_relationship_between_accounts', ['badge-100100', 'alice'])
    expect(fetchAccounts).toHaveBeenCalledWith(['badge-069069'], { force: false })
  })

  it('caches a membership answer for an hour', async () => {
    bridgeRequest.mockResolvedValue({ follows: true })
    expect(await checkPeakdMembership('badge-069069', 'alice')).toBe(true)
    expect(await checkPeakdMembership('badge-069069', 'alice')).toBe(true)
    expect(bridgeRequest).toHaveBeenCalledTimes(1)
  })

  it('paginates followers for the Studio picker', async () => {
    const page = Array.from({ length: PEAKD_FOLLOWER_PAGE_SIZE }, (_, index) => ({ follower: 'user-' + index }))
    page[PEAKD_FOLLOWER_PAGE_SIZE - 1] = { follower: 'badge-424242' }
    apiGetFollowers
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([{ follower: 'badge-069069' }, { follower: 'alice' }])

    const names = await fetchPeakdBadgeAccountNames('alice')
    expect(names).toEqual(['badge-424242', 'badge-069069'])
    expect(apiGetFollowers).toHaveBeenNthCalledWith(1, 'alice', '', 'blog', PEAKD_FOLLOWER_PAGE_SIZE)
    expect(apiGetFollowers).toHaveBeenNthCalledWith(2, 'alice', 'badge-424242', 'blog', PEAKD_FOLLOWER_PAGE_SIZE)
  })

  it('omits images on unknown hosts and ignores invalid accounts', async () => {
    apiGetFollowers.mockResolvedValue([{ follower: 'badge-424242' }])
    fetchAccounts.mockResolvedValue([
      peakdAccount('badge-424242', { name: 'Hive Devs', profile_image: 'https://evil.example/a.png' })
    ])
    expect(await fetchPeakdBadges('alice')).toEqual([])
    expect(await fetchPeakdBadges('Not A Name')).toEqual([])
    expect(apiGetFollowers).toHaveBeenCalledTimes(1)
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
    apiGetFollowers.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      { id: 'first-post', title: 'First post', state: 'on', url: 'https://hivebuzz.me/a.png' },
      { id: 'future', title: 'Future', state: 'off', url: 'https://hivebuzz.me/b.png' }
    ])))
    const suggestions = await fetchBadgeSuggestions('alice')
    expect(suggestions.hivebuzz).toHaveLength(2)
    expect(suggestions.hivebuzz.filter(badge => badge.earned)).toHaveLength(1)
  })
})

describe('profile badge resolution', () => {
  it('resolves selected badges plus the optional level and omits misses', async () => {
    bridgeRequest.mockImplementation(async (_method, [badge]) => ({ follows: badge === 'badge-069069' }))
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      { id: 'first-post', title: 'First post', state: 'on', url: 'https://hivebuzz.me/a.png' }
    ])))
    apiGetFollowers.mockResolvedValue([])
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
