import { describe, expect, it } from 'vitest'
import { byRecentActivity, isFeaturedSkin, skinActivityStamp } from '../../src/themes/wall'

function skin ({ tags = [], selected = [] } = {}) {
  return {
    tags,
    profile: { badges: { selected } }
  }
}

describe('theme wall helpers', () => {
  it('matches the featured tag case-insensitively', () => {
    expect(isFeaturedSkin(skin({ tags: ['featured'] }))).toBe(true)
    expect(isFeaturedSkin(skin({ tags: ['Featured'] }))).toBe(true)
    expect(isFeaturedSkin(skin({ tags: ['dark', 'custom'] }))).toBe(false)
  })

  it('features skins with a curated credential badge', () => {
    expect(isFeaturedSkin(skin({ selected: [{ source: 'peakd', id: 'badge-069069' }] }))).toBe(true)
    expect(isFeaturedSkin(skin({ selected: [{ source: 'hivebuzz', id: '2' }] }))).toBe(false)
  })

  it('orders Recent by profile metadata update, with last_post as fallback', () => {
    const rows = [
      { account: { name: 'old', last_account_update: '2026-01-01T00:00:00', last_post: '2026-03-01T00:00:00' } },
      { account: { name: 'new', last_account_update: '2026-04-01T00:00:00', last_post: '2026-02-01T00:00:00' } },
      { account: { name: 'fallback', last_post: '2026-05-01T00:00:00' } }
    ]

    expect(skinActivityStamp(rows[0].account)).toBe('2026-01-01T00:00:00')
    expect([...rows].sort(byRecentActivity).map(row => row.account.name)).toEqual(['fallback', 'new', 'old'])
  })
})
