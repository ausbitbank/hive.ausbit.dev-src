import { describe, expect, it } from 'vitest'
import { buildDownvoteCsv, buildDownvoteReport, reportFilename } from '../../src/services/downvoteReport'

const rows = [
  {
    index: 10,
    voter: 'bob',
    author: 'alice',
    permlink: 'post',
    target: 'alice/post',
    weight: -10000,
    time: Date.parse('2026-11-28T10:00:00Z'),
    timestamp: '2026-11-28T10:00:00',
    impactUsd: 2,
    impactSource: 'chain',
    impactConfidence: 'exact',
    postAgeHours: 4,
    payoutState: 'paid',
    afterPayout: false,
    effective: true
  },
  {
    index: 11,
    voter: 'carol',
    author: 'alice',
    permlink: 'other',
    target: 'alice/other',
    weight: -5000,
    time: Date.parse('2026-11-28T11:00:00Z'),
    timestamp: '2026-11-28T11:00:00',
    impactUsd: 0.5,
    impactSource: 'estimate',
    impactConfidence: 'estimated',
    postAgeHours: 8,
    payoutState: 'pending',
    afterPayout: false,
    effective: true
  }
]

const notes = {
  'i:11': { note: '=spam claim, repeated', tags: ['no reason given'], updatedAt: '2026-11-28T12:00:00Z' }
}

const impact = {
  totalUsd: 2.5,
  finalizedUsd: 2,
  pendingUsd: 0.5,
  exactCoverage: 0.5,
  exactCount: 1,
  effectiveCount: 2,
  afterPayoutCount: 0,
  authorUsd: 2,
  curatorUsd: 0.5,
  topVoters: [
    { key: 'bob', count: 1, totalUsd: 2, exactCount: 1, effectiveCount: 1 },
    { key: 'carol', count: 1, totalUsd: 0.5, exactCount: 0, effectiveCount: 1 }
  ],
  topTargets: [
    { key: 'alice/post', count: 1, totalUsd: 2 },
    { key: 'alice/other', count: 1, totalUsd: 0.5 }
  ]
}

describe('downvote exports', () => {
  it('writes CSV impact provenance, notes and tags', () => {
    const csv = buildDownvoteCsv(rows, { notes, username: 'alice', direction: 'received' })
    const lines = csv.split('\n')
    expect(lines[0]).toContain('impact_source')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('exact')
    expect(lines[2]).toContain('estimated')
    expect(lines[2]).toContain('no reason given')
    expect(lines[2]).toContain('"\'=spam claim, repeated"')
  })

  it('builds a readable Markdown case file with totals, patterns and notes', () => {
    const markdown = buildDownvoteReport({
      username: 'alice',
      direction: 'received',
      rangeLabel: 'Last 30 days',
      summary: { count: 2, distinctTargets: 2, distinctVoters: 2 },
      impact,
      rows,
      notes,
      patterns: {
        repeatTargeting: [{ key: 'bob', count: 2, share: 0.5, totalUsd: 2 }],
        postPayoutSignals: { rows: [] }
      },
      rewardsComparison: { lossUsd: 2, rewardsUsd: 10, sharePercent: 16.7 }
    })
    expect(markdown).toContain('# Downvote report for @alice')
    expect(markdown).toContain('Estimated / exact deducted: **$2.50**')
    expect(markdown).toContain('Exact coverage: **50%**')
    expect(markdown).toContain('@bob')
    expect(markdown).toContain('Repeat targeting')
    expect(markdown).toContain('=spam claim')
    expect(markdown).toContain('Comments are context, not proof')
  })

  it('produces a dated, direction-specific filename', () => {
    expect(reportFilename('alice', 'received', 'csv', new Date('2026-11-28T12:00:00Z')))
      .toBe('banksia-downvotes-alice-received-2026-11-28.csv')
  })
})
