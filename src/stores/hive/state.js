import { LocalStorage, SessionStorage } from 'quasar'

export const DEFAULT_SETTINGS = {
  darkBackground: true,
  voteWeightPost: 100,
  voteWeightComment: 100,
  beneficiary: [{ account: 'ausbitbank', weight: 1000 }],
  apiNode: 'https://api.hive.blog',
  ahNode: 'https://api.hive.blog',
  heApiNode: 'https://herpc.dtools.dev'
}

export const QUEUE_STORAGE_KEY = 'queuedActions'
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

function isValidQueueItem (item) {
  return Array.isArray(item) &&
    item.length === 3 &&
    typeof item[0] === 'string' &&
    (item[1] === 'posting' || item[1] === 'active') &&
    Array.isArray(item[2]) &&
    typeof item[2][0] === 'string'
}

// Queued broadcast operations never contain private keys, so they are safe to
// keep in LocalStorage. Entries expire after 24 hours to avoid replaying stale
// actions long after they were queued. The owner check prevents a queue saved
// by one account from being replayed by a different account.
export function restoreQueue (currentUsername) {
  try {
    const stored = LocalStorage.getItem(QUEUE_STORAGE_KEY)
    if (!stored) return []

    const savedAt = Number(stored.savedAt)
    const items = stored.items
    if (!Array.isArray(items) || !Number.isFinite(savedAt) || Date.now() - savedAt > QUEUE_TTL_MS) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return []
    }

    if (stored.owner && stored.owner !== currentUsername) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return []
    }

    const validItems = items.filter(isValidQueueItem)
    if (validItems.length !== items.length) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      if (validItems.length === 0) return []
    }
    return validItems
  } catch {
    // Corrupt or unavailable storage should never prevent the store loading.
    try { LocalStorage.remove(QUEUE_STORAGE_KEY) } catch {}
    return []
  }
}

export function persistQueue (queue) {
  try {
    if (!Array.isArray(queue) || queue.length === 0) {
      LocalStorage.remove(QUEUE_STORAGE_KEY)
      return
    }
    LocalStorage.set(QUEUE_STORAGE_KEY, {
      savedAt: Date.now(),
      owner: typeof queue[0]?.[0] === 'string' ? queue[0][0] : null,
      items: queue
    })
  } catch {
    // Ignore quota/private-mode failures; the in-memory queue still works.
  }
}

export default function () {
  const username = SessionStorage.getItem('loggedInUser') || null
  const restoredQueue = restoreQueue(username)
  return {
    user: {
      username,
      loginType: SessionStorage.getItem('loginType') || null,
      lastUpdateTime: null,
      following: [],
      followers: [],
      communities: SessionStorage.getItem('communitySubscriptions') || [],
      state: {},
      notifications: SessionStorage.getItem('notifications') || [],
      unreadNotificationCount: 0,
      settings: LocalStorage.getItem('settings') || { ...DEFAULT_SETTINGS }
    },
    queue: restoredQueue,
    queueRestored: restoredQueue.length > 0,
    restoredQueueCount: restoredQueue.length,
    accounts: {},
    followCounts: {},
    posts: {},
    communityInfo: {},
    globalProps: {
      empty: true
    }
  }
}
