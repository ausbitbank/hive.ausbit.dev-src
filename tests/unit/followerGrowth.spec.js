import { describe, expect, it } from 'vitest'
import { followerGrowthSummary } from '../../src/services/followerGrowth'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

function baseline (overrides = {}) {
  return {
    firstAt: NOW - 10 * DAY_MS,
    firstFollowers: 100,
    firstFollowing: 40,
    lastAt: NOW - DAY_MS,
    lastFollowers: 130,
    lastFollowing: 45,
    ...overrides
  }
}

describe('follower growth summary', () => {
  it('starts a new baseline with the current counts', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 120, following_count: 45 },
      now: NOW
    })
    expect(summary.followers).toBe(120)
    expect(summary.following).toBe(45)
    expect(summary.hasCounts).toBe(true)
    expect(summary.hasBaseline).toBe(false)
    expect(summary.isNew).toBe(true)
    expect(summary.followerDelta).toBeNull()
    expect(summary.followingDelta).toBeNull()
    expect(summary.daysTracked).toBe(0)
    expect(summary.followerRatePerDay).toBeNull()
    expect(summary.daysTrackedLabel).toBe('Tracking starts now')
  })

  it('measures growth since the first baseline', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 140, following_count: 46 },
      baseline: baseline(),
      now: NOW
    })
    expect(summary.hasBaseline).toBe(true)
    expect(summary.isNew).toBe(false)
    expect(summary.followerDelta).toBe(40)
    expect(summary.followingDelta).toBe(6)
    expect(summary.daysTracked).toBe(10)
    expect(summary.followerRatePerDay).toBeCloseTo(4, 6)
    expect(summary.followingRatePerDay).toBeCloseTo(0.6, 6)
    expect(summary.followerDeltaLabel).toBe('+40')
    expect(summary.followingDeltaLabel).toBe('+6')
    expect(summary.followerRateLabel).toBe('+4/day')
    expect(summary.daysTrackedLabel).toBe('10 days')
  })

  it('measures a decline and labels it with a minus sign', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 90, following_count: 30 },
      baseline: baseline(),
      now: NOW
    })
    expect(summary.followerDelta).toBe(-10)
    expect(summary.followingDelta).toBe(-10)
    expect(summary.followerRatePerDay).toBeCloseTo(-1, 6)
    expect(summary.followerDeltaLabel).toBe('-10')
    expect(summary.followingDeltaLabel).toBe('-10')
  })

  it('reports no change when the counts match the baseline', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 100, following_count: 40 },
      baseline: baseline({ lastFollowers: 100, lastFollowing: 40 }),
      now: NOW
    })
    expect(summary.followerDelta).toBe(0)
    expect(summary.followingDelta).toBe(0)
    expect(summary.followerDeltaLabel).toBe('No change')
    expect(summary.followingDeltaLabel).toBe('No change')
  })

  it('handles a missing follow count without inventing zeros', () => {
    const summary = followerGrowthSummary({ followCount: null, baseline: baseline(), now: NOW })
    expect(summary.followers).toBeNull()
    expect(summary.following).toBeNull()
    expect(summary.hasCounts).toBe(false)
    expect(summary.hasBaseline).toBe(true)
    expect(summary.followerDelta).toBeNull()
    expect(summary.followingDelta).toBeNull()
    expect(summary.followerRatePerDay).toBeNull()
    expect(summary.followerDeltaLabel).toBe('—')
  })

  it('keeps zero counts as real values', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 0, following_count: '0' },
      baseline: baseline({ firstFollowers: 0, firstFollowing: '0' }),
      now: NOW
    })
    expect(summary.followers).toBe(0)
    expect(summary.following).toBe(0)
    expect(summary.followerDelta).toBe(0)
    expect(summary.hasCounts).toBe(true)
  })

  it('treats a malformed baseline as a new baseline', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 50, following_count: 20 },
      baseline: { firstAt: 'not-a-date', firstFollowers: 10, firstFollowing: 5 },
      now: NOW
    })
    expect(summary.hasBaseline).toBe(false)
    expect(summary.isNew).toBe(true)
    expect(summary.daysTracked).toBe(0)
    expect(summary.followerDelta).toBeNull()
    expect(summary.followerRatePerDay).toBeNull()
  })

  it('keeps deltas but no rates when no day has elapsed yet', () => {
    const summary = followerGrowthSummary({
      followCount: { follower_count: 110, following_count: 42 },
      baseline: baseline({
        firstAt: NOW,
        firstFollowers: 100,
        firstFollowing: 40,
        lastAt: NOW,
        lastFollowers: 100,
        lastFollowing: 40
      }),
      now: NOW
    })
    expect(summary.hasBaseline).toBe(true)
    expect(summary.daysTracked).toBe(0)
    expect(summary.isNew).toBe(true)
    expect(summary.followerDelta).toBe(10)
    expect(summary.followingDelta).toBe(2)
    expect(summary.followerRatePerDay).toBeNull()
    expect(summary.daysTrackedLabel).toBe('Tracking starts now')
  })
})
