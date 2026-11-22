import { describe, expect, it } from 'vitest'
import { draftsQueueSummary } from '../../src/services/draftsQueueSummary'

const NOW = Date.UTC(2026, 0, 10, 12, 0, 0)
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function draft (overrides = {}) {
  return {
    id: 'draft-' + Math.random().toString(36).slice(2),
    title: 'Untitled draft',
    body: '',
    updatedAt: NOW,
    archivedAt: null,
    ...overrides
  }
}

function action (type = 'vote') {
  return ['alice', 'posting', [type, {}]]
}

function meta (status, extra = {}) {
  return {
    status,
    error: '',
    txId: '',
    addedAt: NOW,
    updatedAt: NOW,
    ...extra
  }
}

describe('drafts and queue summary', () => {
  it('counts active drafts and picks the oldest and newest', () => {
    const summary = draftsQueueSummary({
      now: NOW,
      drafts: [
        draft({ title: 'Newest', updatedAt: NOW - MINUTE }),
        draft({ title: 'Oldest', updatedAt: NOW - 5 * DAY }),
        draft({ title: 'Middle', updatedAt: NOW - 2 * DAY }),
        draft({ title: 'Archived', updatedAt: NOW - 10 * DAY, archivedAt: NOW - DAY })
      ]
    })

    expect(summary.draftCount).toBe(3)
    expect(summary.archivedCount).toBe(1)
    expect(summary.totalDraftCount).toBe(4)
    expect(summary.oldestDraft).toEqual({
      title: 'Oldest',
      updatedAt: NOW - 5 * DAY,
      ageLabel: '5d ago'
    })
    expect(summary.newestDraft.title).toBe('Newest')
    expect(summary.newestDraft.ageLabel).toBe('1 min ago')
    expect(summary.hasDrafts).toBe(true)
    expect(summary.hasData).toBe(true)
  })

  it('falls back to the body first line for an untitled draft', () => {
    const summary = draftsQueueSummary({
      now: NOW,
      drafts: [draft({ title: '', body: '# A body title\nMore text', updatedAt: NOW - HOUR })]
    })
    expect(summary.oldestDraft.title).toBe('A body title')
    expect(summary.oldestDraft.ageLabel).toBe('1h ago')
  })

  it('counts queue statuses and names the next action', () => {
    const queue = [
      action('comment'),
      action('vote'),
      action('transfer'),
      action('custom_json')
    ]
    const queueMeta = [
      meta('sent'),
      meta('pending'),
      meta('failed'),
      meta('broadcasting')
    ]
    const summary = draftsQueueSummary({ now: NOW, queue, queueMeta })

    expect(summary.queueCount).toBe(4)
    expect(summary.pendingCount).toBe(1)
    expect(summary.failedCount).toBe(1)
    expect(summary.sentCount).toBe(1)
    expect(summary.broadcastingCount).toBe(1)
    expect(summary.activeQueueCount).toBe(3)
    expect(summary.hasQueue).toBe(true)
    expect(summary.nextQueueLabel).toBe('Vote · Queued')
  })

  it('offers a failed item for retry when nothing else is pending', () => {
    const summary = draftsQueueSummary({
      now: NOW,
      queue: [action('transfer')],
      queueMeta: [meta('failed')]
    })
    expect(summary.nextQueueLabel).toBe('Transfer · Failed')
  })

  it('reports an empty state when there is nothing local', () => {
    const summary = draftsQueueSummary({ now: NOW })
    expect(summary).toMatchObject({
      draftCount: 0,
      archivedCount: 0,
      oldestDraft: null,
      newestDraft: null,
      queueCount: 0,
      pendingCount: 0,
      failedCount: 0,
      sentCount: 0,
      broadcastingCount: 0,
      nextQueueLabel: '',
      hasDrafts: false,
      hasQueue: false,
      hasData: false
    })
    expect(draftsQueueSummary({ now: NOW, drafts: null, queue: null, queueMeta: null }).hasData).toBe(false)
  })

  it('handles malformed dates and missing queue metadata', () => {
    const summary = draftsQueueSummary({
      now: NOW,
      drafts: [
        draft({ title: 'No date', updatedAt: 'not-a-date' }),
        draft({ title: 'Zero date', updatedAt: 0 })
      ],
      queue: [action('vote')],
      queueMeta: []
    })

    expect(summary.oldestDraft).toEqual({
      title: 'No date',
      updatedAt: null,
      ageLabel: 'Unknown age'
    })
    expect(summary.newestDraft.title).toBe('No date')
    // A queue item without metadata is treated as a pending action.
    expect(summary.pendingCount).toBe(1)
    expect(summary.nextQueueLabel).toBe('Vote · Queued')
  })
})
