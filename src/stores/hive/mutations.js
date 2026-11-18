import { LocalStorage, SessionStorage } from 'quasar'
import { persistQueue } from './state'
import { createQueueMeta, normalizeQueueMeta, QUEUE_STATUS } from '../../services/queue'
import { isOnline, notifyOfflineSigningBlocked } from '../../services/connectivity'

function ensureQueueMeta (state) {
  if (!Array.isArray(state.queueMeta)) state.queueMeta = []
  return state.queueMeta
}

export function updateLoggedInUser (username) {
  this.user.username = username
  SessionStorage.set('loggedInUser', username)
}

export function updateLoginType (type) {
  this.user.loginType = type
  SessionStorage.set('loginType', type)
}

export function updateNotifications (notifications) {
  this.user.notifications = notifications
  SessionStorage.set('notifications', notifications)
}

export function updateUnreadNotificationCount (count) {
  this.user.unreadNotificationCount = count
  SessionStorage.set('unreadNotificationCount', count)
}

export function updateNotificationsLastRead (value) {
  this.user.notificationsLastRead = value || null
  if (value) SessionStorage.set('notificationsLastRead', value)
  else SessionStorage.remove('notificationsLastRead')
}

/** Apply a successful `notify` setLastRead broadcast without another API call. */
export function markNotificationsReadLocally () {
  this.user.unreadNotificationCount = 0
  SessionStorage.set('unreadNotificationCount', 0)
  const now = new Date().toISOString()
  updateNotificationsLastRead.call(this, now)
}

export function clearNotificationsState () {
  this.user.notifications = []
  this.user.unreadNotificationCount = 0
  this.user.notificationsLastRead = null
  SessionStorage.remove('notifications')
  SessionStorage.remove('unreadNotificationCount')
  SessionStorage.remove('notificationsLastRead')
}

export function updateAccountData (accountData) {
  this.accounts[accountData.name] = accountData
}

export function updateGlobalProps (props) {
  this.globalProps = props
}

export function updateCommunityInfo (communityInfo) {
  this.communityInfo[communityInfo.name] = communityInfo
}

export function updateCommunitySubscriptions (communitySubscriptions) {
  this.user.communities = communitySubscriptions
  SessionStorage.set('communitySubscriptions', communitySubscriptions)
}

export function updateSettings (settings) {
  this.user.settings = settings
  LocalStorage.set('settings', settings)
}

export function addToQueue (newItem) {
  const meta = createQueueMeta()
  if (!isOnline()) {
    // Keep the intent, but mark it failed so nothing can be signed until the
    // connection returns. Send-all resets failed items when the user retries.
    meta.status = QUEUE_STATUS.FAILED
    meta.error = 'You are offline. Reconnect before signing this action.'
    meta.updatedAt = Date.now()
    notifyOfflineSigningBlocked()
  }
  this.queue.push(newItem)
  ensureQueueMeta(this).push(meta)
  persistQueue(this.queue, this.queueMeta)
}

export function removeFromQueue (itemToRemove) {
  const index = this.queue.indexOf(itemToRemove)
  if (index === -1) return
  this.queue.splice(index, 1)
  ensureQueueMeta(this).splice(index, 1)
  persistQueue(this.queue, this.queueMeta)
}

export function removeQueueItemAt (index) {
  if (index < 0 || index >= this.queue.length) return
  this.queue.splice(index, 1)
  ensureQueueMeta(this).splice(index, 1)
  persistQueue(this.queue, this.queueMeta)
}

export function setQueueStatus (index, status, error = '') {
  if (index < 0 || index >= this.queue.length) return
  const meta = ensureQueueMeta(this)
  const current = normalizeQueueMeta(this.queue, meta)[index]
  meta[index] = {
    ...current,
    status,
    error: typeof error === 'string' ? error : '',
    updatedAt: Date.now()
  }
  meta.splice(0, meta.length, ...normalizeQueueMeta(this.queue, meta))
  persistQueue(this.queue, this.queueMeta)
}

export function setQueueTxId (index, txId) {
  if (index < 0 || index >= this.queue.length) return
  const meta = ensureQueueMeta(this)
  const current = normalizeQueueMeta(this.queue, meta)[index]
  meta[index] = { ...current, txId: txId || '', updatedAt: Date.now() }
  persistQueue(this.queue, this.queueMeta)
}

export function resetFailedQueueStatuses () {
  const meta = ensureQueueMeta(this)
  const normalized = normalizeQueueMeta(this.queue, meta)
  normalized.forEach(entry => {
    if (entry.status === QUEUE_STATUS.FAILED) {
      entry.status = QUEUE_STATUS.PENDING
      entry.error = ''
      entry.updatedAt = Date.now()
    }
  })
  meta.splice(0, meta.length, ...normalized)
  persistQueue(this.queue, this.queueMeta)
}

export function clearCompletedQueue () {
  const meta = ensureQueueMeta(this)
  const normalized = normalizeQueueMeta(this.queue, meta)
  const keep = []
  const keepMeta = []
  this.queue.forEach((item, index) => {
    if (normalized[index].status !== QUEUE_STATUS.SENT) {
      keep.push(item)
      keepMeta.push(normalized[index])
    }
  })
  this.queue = keep
  this.queueMeta = keepMeta
  persistQueue(this.queue, this.queueMeta)
}

export function clearQueue () {
  this.queue = []
  this.queueMeta = []
  persistQueue(this.queue, this.queueMeta)
}

export function acknowledgeQueueRestored () {
  this.queueRestored = false
  this.restoredQueueCount = 0
}

export function updateFollowCount (followCount) {
  if (!followCount?.account) return
  const { account, ...counts } = followCount
  this.followCounts[account] = counts
}
