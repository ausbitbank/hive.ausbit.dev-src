// Pure helpers for the notification inbox.

export const NOTIFICATION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'votes', label: 'Votes' },
  { value: 'replies', label: 'Replies' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'other', label: 'Other' }
]

const FILTER_TYPES = {
  votes: ['vote', 'unvote'],
  replies: ['reply'],
  mentions: ['mention'],
  other: ['follow', 'reblog', 'transfer', 'promoted', 'unfollow']
}

export function plainNotificationMessage (value, max = 160) {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

export function notificationActor (message) {
  const match = String(message || '').match(/@([a-z0-9][a-z0-9.-]*)/i)
  return match ? match[1] : ''
}

/** Turn a bridge notification URL into a safe in-app path. */
export function notificationPath (url) {
  const cleaned = String(url || '').trim().replace(/^\/+/, '')
  if (!cleaned || /^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return '/'
  return '/' + cleaned
}

export function notificationCategory (notification) {
  const type = String(notification?.type || '').toLowerCase()
  for (const [category, types] of Object.entries(FILTER_TYPES)) {
    if (types.includes(type)) return category
  }
  return 'other'
}

export function notificationTypeLabel (notification) {
  const type = String(notification?.type || 'activity').toLowerCase()
  const known = {
    vote: 'Vote',
    unvote: 'Unvote',
    reply: 'Reply',
    mention: 'Mention',
    follow: 'Follow',
    reblog: 'Reblog',
    transfer: 'Transfer',
    promoted: 'Promotion'
  }
  return known[type] || type.replace(/_/g, ' ')
}

/** Parse Hive dates that may use either `YYYY-MM-DD HH:mm:ss` or ISO `T` form. */
export function notificationTimestamp (value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const text = String(value).trim()
  const normalised = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(text)
    ? text.replace(' ', 'T') + 'Z'
    : text
  const parsed = Date.parse(normalised)
  return Number.isFinite(parsed) ? parsed : 0
}

export function unreadNotificationIds (notifications, lastReadAt, unreadCount = 0) {
  const list = Array.isArray(notifications) ? notifications : []
  const lastRead = notificationTimestamp(lastReadAt)
  if (lastRead > 0) {
    return new Set(
      list
        .filter(item => notificationTimestamp(item?.date) > lastRead)
        .map(item => item.id)
    )
  }
  // `unread_notifications` gives a count but not per-item flags. The API
  // returns newest first, so the first N entries are the unread ones.
  const count = Math.max(0, Math.min(Number(unreadCount) || 0, list.length))
  return new Set(list.slice(0, count).map(item => item.id))
}

export function filterNotifications (notifications, {
  filter = 'all',
  unreadOnly = false,
  unreadIds = new Set()
} = {}) {
  const list = Array.isArray(notifications) ? notifications : []
  return list.filter(item => {
    if (filter !== 'all' && notificationCategory(item) !== filter) return false
    if (unreadOnly && !unreadIds.has(item.id)) return false
    return true
  })
}

/** Merge a page into an existing list, de-duplicating by id and newest first. */
export function mergeNotifications (existing, incoming) {
  const byId = new Map()
  for (const item of Array.isArray(existing) ? existing : []) {
    if (item?.id) byId.set(item.id, item)
  }
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (item?.id) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => {
    const timeA = notificationTimestamp(a.date)
    const timeB = notificationTimestamp(b.date)
    if (timeB !== timeA) return timeB - timeA
    return String(b.id).localeCompare(String(a.id))
  })
}
