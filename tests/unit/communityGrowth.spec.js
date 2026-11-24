import { describe, expect, it } from 'vitest'
import { communityGrowthSummary } from '../../src/services/communityGrowth'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

function community (overrides = {}) {
  return {
    name: 'hive-139531',
    subscribers: 1200,
    num_authors: 30,
    sum_pending: 250.5,
    ...overrides
  }
}

function baseline (overrides = {}) {
  return {
    firstAt: NOW - 10 * DAY_MS,
    firstSubscribers: 1000,
    firstAuthors: 20,
    firstPendingRewards: 200,
    lastAt: NOW - DAY_MS,
    lastSubscribers: 1150,
    lastAuthors: 28,
    lastPendingRewards: 240,
    ...overrides
  }
}

describe('community growth summary', () => {
  it('starts a new baseline without inventing a delta', () => {
    const summary = communityGrowthSummary({ community: community(), now: NOW })
    expect(summary.hasData).toBe(true)
    expect(summary.hasBaseline).toBe(false)
    expect(summary.isNew).toBe(true)
    expect(summary.subscriberDelta).toBeNull()
    expect(summary.daysTrackedLabel).toBe('Tracking starts now')
  })

  it('measures growth against the first baseline', () => {
    const summary = communityGrowthSummary({ community: community(), baseline: baseline(), now: NOW })
    expect(summary.hasBaseline).toBe(true)
    expect(summary.isNew).toBe(false)
    expect(summary.subscriberDelta).toBe(200)
    expect(summary.authorDelta).toBe(10)
    expect(summary.pendingDelta).toBe(50.5)
    expect(summary.daysTracked).toBe(10)
    expect(summary.subscriberRatePerDay).toBeCloseTo(20, 6)
    expect(summary.subscriberDeltaLabel).toBe('+200')
    expect(summary.authorDeltaLabel).toBe('+10')
    expect(summary.pendingDeltaLabel).toBe('+50.5 HBD')
    expect(summary.daysTrackedLabel).toBe('10 days')
  })

  it('labels declines with a minus sign', () => {
    const summary = communityGrowthSummary({
      community: community({ subscribers: 950, num_authors: 18, sum_pending: 150 }),
      baseline: baseline(),
      now: NOW
    })
    expect(summary.subscriberDelta).toBe(-50)
    expect(summary.authorDelta).toBe(-2)
    expect(summary.pendingDelta).toBe(-50)
    expect(summary.subscriberDeltaLabel).toBe('-50')
    expect(summary.pendingDeltaLabel).toBe('-50 HBD')
  })

  it('reports no change when totals match the baseline', () => {
    const summary = communityGrowthSummary({
      community: community({ subscribers: 1000, num_authors: 20, sum_pending: 200 }),
      baseline: baseline(),
      now: NOW
    })
    expect(summary.subscriberDelta).toBe(0)
    expect(summary.subscriberDeltaLabel).toBe('No change')
  })

  it('keeps zero values as real numbers', () => {
    const summary = communityGrowthSummary({
      community: community({ subscribers: 0, num_authors: 0, sum_pending: 0 }),
      baseline: baseline({ firstSubscribers: 0, firstAuthors: 0, firstPendingRewards: 0 }),
      now: NOW
    })
    expect(summary.subscribers).toBe(0)
    expect(summary.subscriberDelta).toBe(0)
    expect(summary.hasData).toBe(true)
  })

  it('treats a malformed baseline as new', () => {
    const summary = communityGrowthSummary({
      community: community(),
      baseline: { firstAt: 'nope', firstSubscribers: 1 },
      now: NOW
    })
    expect(summary.hasBaseline).toBe(false)
    expect(summary.isNew).toBe(true)
    expect(summary.subscriberDelta).toBeNull()
  })

  it('handles a missing community record', () => {
    const summary = communityGrowthSummary({ community: null, baseline: baseline(), now: NOW })
    expect(summary.hasData).toBe(false)
    expect(summary.subscribers).toBeNull()
    expect(summary.subscriberDelta).toBeNull()
    expect(summary.pendingDeltaLabel).toBe('—')
  })

  it('accepts the authors and pendingRewards aliases', () => {
    const summary = communityGrowthSummary({
      community: { name: 'hive-1', subscribers: '10', authors: '2', pendingRewards: '1.5' },
      now: NOW
    })
    expect(summary.subscribers).toBe(10)
    expect(summary.authors).toBe(2)
    expect(summary.pendingRewards).toBe(1.5)
  })
})
