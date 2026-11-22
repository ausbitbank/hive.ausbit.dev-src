// Pure shaping for the dashboard's drafts-and-queue widget.
//
// Drafts live in localStorage and the signing queue lives in the Pinia store,
// but both are plain arrays. This helper turns them into the counts and the
// single "what next" line the widget shows. No Vue imports.

import { draftDisplayTitle } from './drafts'
import {
  nextActionableIndex,
  normalizeQueueMeta,
  operationLabel,
  queueCounts,
  statusMeta
} from './queue'

function timestamp (value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function ageLabel (time, now) {
  if (time === null) return 'Unknown age'
  const diff = Math.max(0, Number(now) - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes + ' min ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + 'd ago'
  const months = Math.floor(days / 30)
  if (months < 12) return months + 'mo ago'
  return Math.floor(months / 12) + 'y ago'
}

function draftRow (draft, time, now) {
  return {
    title: draftDisplayTitle(draft),
    updatedAt: time,
    ageLabel: ageLabel(time, now)
  }
}

function pickDraft (rows, direction) {
  const timed = rows.filter(row => row.time !== null)
  if (!timed.length) return rows.length ? { draft: rows[0].draft, time: null } : null
  return timed.reduce((best, row) => {
    if (direction === 'oldest') return row.time < best.time ? row : best
    return row.time > best.time ? row : best
  })
}

/**
 * Summarise local drafts and the signing queue.
 *
 * `draftCount` only counts active (non-archived) drafts; archived drafts are
 * reported separately so the widget can say "3 drafts, 1 archived". Queue
 * metadata is aligned with the queue before counting, matching the queue page.
 */
export function draftsQueueSummary ({
  drafts = [],
  queue = [],
  queueMeta = [],
  now = Date.now()
} = {}) {
  const reference = Number(now)
  const currentTime = Number.isFinite(reference) && reference > 0 ? reference : Date.now()
  const draftList = (Array.isArray(drafts) ? drafts : []).filter(Boolean)
  const activeDrafts = draftList.filter(draft => !draft.archivedAt)
  const archivedCount = draftList.length - activeDrafts.length

  const rows = activeDrafts.map(draft => ({
    draft,
    time: timestamp(draft.updatedAt)
  }))
  const oldest = pickDraft(rows, 'oldest')
  const newest = pickDraft(rows, 'newest')

  const queueList = Array.isArray(queue) ? queue : []
  const meta = normalizeQueueMeta(queueList, Array.isArray(queueMeta) ? queueMeta : [], currentTime)
  const counts = queueCounts(meta)
  const nextIndex = nextActionableIndex(meta, { includeFailed: true })
  const nextStatus = nextIndex >= 0 ? meta[nextIndex] : null
  const nextQueueLabel = nextIndex >= 0
    ? operationLabel(queueList[nextIndex]) + ' · ' + statusMeta(nextStatus.status).label
    : ''

  const draftCount = activeDrafts.length
  const queueCount = counts.total
  const activeQueueCount = counts.pending + counts.broadcasting + counts.failed

  return {
    draftCount,
    archivedCount,
    totalDraftCount: draftList.length,
    oldestDraft: oldest ? draftRow(oldest.draft, oldest.time, currentTime) : null,
    newestDraft: newest ? draftRow(newest.draft, newest.time, currentTime) : null,
    queueCount,
    pendingCount: counts.pending,
    failedCount: counts.failed,
    sentCount: counts.sent,
    broadcastingCount: counts.broadcasting,
    activeQueueCount,
    nextQueueLabel,
    hasDrafts: draftCount > 0,
    hasQueue: queueCount > 0,
    hasPendingQueue: activeQueueCount > 0,
    hasData: draftCount > 0 || queueCount > 0
  }
}
