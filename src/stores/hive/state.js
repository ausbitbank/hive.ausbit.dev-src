import { LocalStorage, SessionStorage } from 'quasar'
import { normalizeQueueAction, normalizeQueueMeta, normalizeQueueMetaEntry, QUEUE_STATUSES } from '../../services/queue'
import { DEFAULT_HIVE_ENGINE_NODE, DEFAULT_MAGI_NODE } from '../../services/hiveNodes'
import { DEFAULT_IMAGE_PROXY } from '../../services/imageProxy'
import dashboardState from './dashboard'
import { readStoredSettings, settingsStorageKey } from '../../services/userSettings'

export { settingsStorageKey }

export const DEFAULT_SETTINGS = {
  voteWeightPost: 100,
  beneficiary: [{ account: 'ausbitbank', weight: 1000 }],
  apiNode: 'https://api.hive.blog',
  ahNode: 'https://api.hive.blog',
  heApiNode: DEFAULT_HIVE_ENGINE_NODE,
  magiApiNode: DEFAULT_MAGI_NODE,
  imageProxy: DEFAULT_IMAGE_PROXY,
  smartlockSessionMinutes: 15
}

export const QUEUE_STORAGE_KEY = 'queuedActions'
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000
export function readSettingsFor (username) {
  return readStoredSettings(username) || { ...DEFAULT_SETTINGS }
}

export function scopedSessionKey (base, username) {
  return String(base) + ':' + (String(username || '').trim().toLowerCase() || 'guest')
}

function readScopedSession (base, username, fallback) {
  try {
    const scoped = SessionStorage.getItem(scopedSessionKey(base, username))
    if (scoped !== null && scoped !== undefined) return scoped
    const legacy = SessionStorage.getItem(base)
    if (legacy !== null && legacy !== undefined) {
      SessionStorage.set(scopedSessionKey(base, username), legacy)
      SessionStorage.remove(base)
      return legacy
    }
  } catch {}
  return fallback
}

function isValidQueueItem (item) {
  return Array.isArray(item) &&
    item.length === 3 &&
    typeof item[0] === 'string' &&
    (item[1] === 'posting' || item[1] === 'active') &&
    Array.isArray(item[2]) &&
    typeof item[2][0] === 'string'
}

function isValidMetaEntry (entry) {
  return entry &&
    typeof entry === 'object' &&
    QUEUE_STATUSES.includes(entry.status)
}

/**
 * Restore the queue together with its per-item status metadata. Legacy queues
 * have no metadata, so aligned pending entries are synthesised for them.
 */
export function restoreQueueState (currentUsername) {
  const empty = { queue: [], meta: [] }
  try {
    const stored = LocalStorage.getItem(QUEUE_STORAGE_KEY)
    if (!stored) return empty

    const savedAt = Number(stored.savedAt)
    const items = stored.items
    if (!Array.isArray(items) || !Number.isFinite(savedAt) || Date.now() - savedAt > QUEUE_TTL_MS) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return empty
    }

    if (stored.owner && stored.owner !== currentUsername) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return empty
    }

    const validItems = items.filter(isValidQueueItem).map(normalizeQueueAction)
    if (validItems.length !== items.length) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      if (validItems.length === 0) return empty
    }

    const storedMeta = Array.isArray(stored.meta) ? stored.meta : []
    const alignedMeta = validItems.map((_, index) => {
      const entry = storedMeta[index]
      const normalized = isValidMetaEntry(entry) ? normalizeQueueMetaEntry(entry) : normalizeQueueMetaEntry(null)
      // A page reload can interrupt a broadcast. Keep the action but make the
      // interruption visible and retryable rather than leaving it stuck.
      if (normalized.status === 'broadcasting') {
        normalized.status = 'failed'
        normalized.error = 'Broadcast was interrupted by a page reload. Retry to send.'
        normalized.updatedAt = Date.now()
      }
      return normalized
    })

    return { queue: validItems, meta: alignedMeta }
  } catch {
    // Corrupt or unavailable storage should never prevent the store loading.
    try { LocalStorage.remove(QUEUE_STORAGE_KEY) } catch {}
    return empty
  }
}

export function restoreQueue (currentUsername) {
  return restoreQueueState(currentUsername).queue
}

export function persistQueue (queue, meta, owner = '') {
  try {
    if (!Array.isArray(queue) || queue.length === 0) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return
    }
    const payload = {
      savedAt: Date.now(),
      owner: String(owner || queue[0]?.[0] || '') || null,
      items: queue
    }
    if (Array.isArray(meta)) {
      payload.meta = normalizeQueueMeta(queue, meta)
    }
    LocalStorage.set(QUEUE_STORAGE_KEY, payload)
  } catch {
    // Ignore quota/private-mode failures; the in-memory queue still works.
  }
}

export default function () {
  const username = SessionStorage.getItem('loggedInUser') || null
  const restored = restoreQueueState(username)
  const activeQueueCount = restored.meta.filter(entry => entry.status !== 'sent').length
  return {
    user: {
      username,
      loginType: SessionStorage.getItem('loginType') || null,
      lastUpdateTime: null,
      following: [],
      followers: [],
      communities: readScopedSession('communitySubscriptions', username, []),
      state: {},
      notifications: readScopedSession('notifications', username, []),
      unreadNotificationCount: Number(readScopedSession('unreadNotificationCount', username, 0)) || 0,
      notificationsLastRead: readScopedSession('notificationsLastRead', username, null),
      settings: readSettingsFor(username)
    },
    queue: restored.queue,
    queueMeta: restored.meta,
    queueRestored: activeQueueCount > 0,
    restoredQueueCount: activeQueueCount,
    accounts: {},
    followCounts: {},
    posts: {},
    communityInfo: {},
    globalProps: {
      empty: true
    },
    // Resolved for the signed-in user (or the guest layout) at boot, so a
    // returning user sees their own dashboard without a flash of the default.
    ...dashboardState(SessionStorage.getItem('loggedInUser') || null)
  }
}
