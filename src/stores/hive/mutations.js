import { LocalStorage, SessionStorage } from 'quasar'
import { persistQueue, readSettingsFor, scopedSessionKey, settingsStorageKey } from './state'
import { createQueueMeta, normalizeQueueAction, normalizeQueueMeta, QUEUE_STATUS } from '../../services/queue'
import { queueAuthorityError } from '../../services/queueAuthority'
import { isOnline, notifyOfflineSigningBlocked } from '../../services/connectivity'
import { resetTelemetry } from '../../services/telemetry'
import { setImageProxyMode } from '../../services/imageProxy'

function sessionKeyFor (state, base) {
  return scopedSessionKey(base, state.user?.username || '')
}

function ensureQueueMeta (state) {
  if (!Array.isArray(state.queueMeta)) state.queueMeta = []
  return state.queueMeta
}

export function updateLoggedInUser (username) {
  const previous = this.user.username
  this.user.username = username
  SessionStorage.set('loggedInUser', username)
  if (previous !== username) this.user.settings = readSettingsFor(username)
  if (previous !== username) resetTelemetry()
  if (previous !== username && previous) {
    // Do not carry one account's queue or community list into another account.
    // The queue is scoped to a single owner and may request active keys.
    this.queue = []
    this.queueMeta = []
    persistQueue([], [], username || '')
    this.user.communities = []
    SessionStorage.remove('communitySubscriptions')
    this.user.notifications = []
    this.user.unreadNotificationCount = 0
    this.user.notificationsLastRead = null
    SessionStorage.remove('notifications')
    SessionStorage.remove('unreadNotificationCount')
    SessionStorage.remove('notificationsLastRead')
  }
  // Each account has its own dashboard; reload when the identity changes so
  // signing in shows the account layout and signing out returns to the guest's.
  if (previous !== username && typeof this.loadDashboard === 'function') {
    this.loadDashboard(username || null)
  }
}

export function updateLoginType (type) {
  this.user.loginType = type
  SessionStorage.set('loginType', type)
}

export function updateNotifications (notifications) {
  this.user.notifications = notifications
  SessionStorage.set(sessionKeyFor(this, 'notifications'), notifications)
}

export function updateUnreadNotificationCount (count) {
  this.user.unreadNotificationCount = count
  SessionStorage.set(sessionKeyFor(this, 'unreadNotificationCount'), count)
}

export function updateNotificationsLastRead (value) {
  this.user.notificationsLastRead = value || null
  if (value) SessionStorage.set(sessionKeyFor(this, 'notificationsLastRead'), value)
  else SessionStorage.remove(sessionKeyFor(this, 'notificationsLastRead'))
}

/** Apply a successful `notify` setLastRead broadcast without another API call. */
export function markNotificationsReadLocally () {
  this.user.unreadNotificationCount = 0
  SessionStorage.set(sessionKeyFor(this, 'unreadNotificationCount'), 0)
  const now = new Date().toISOString()
  updateNotificationsLastRead.call(this, now)
}

export function clearNotificationsState () {
  this.user.notifications = []
  this.user.unreadNotificationCount = 0
  this.user.notificationsLastRead = null
  SessionStorage.remove(sessionKeyFor(this, 'notifications'))
  SessionStorage.remove(sessionKeyFor(this, 'unreadNotificationCount'))
  SessionStorage.remove(sessionKeyFor(this, 'notificationsLastRead'))
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
  SessionStorage.set(sessionKeyFor(this, 'communitySubscriptions'), communitySubscriptions)
}

export function updateSettings (settings) {
  this.user.settings = settings
  LocalStorage.set(settingsStorageKey(this.user.username), settings)
  setImageProxyMode(settings?.imageProxy)
}

export function addToQueue (newItem, options = {}) {
  const meta = createQueueMeta(Date.now(), options)
  const normalized = normalizeQueueAction(newItem)
  const authorityError = queueAuthorityError(normalized, this.user?.username)
  if (!isOnline()) {
    // Keep the intent, but mark it failed so nothing can be signed until the
    // connection returns. Send-all resets failed items when the user retries.
    meta.status = QUEUE_STATUS.FAILED
    meta.error = 'You are offline. Reconnect before signing this action.'
    meta.updatedAt = Date.now()
    notifyOfflineSigningBlocked()
  } else if (authorityError) {
    // Fail closed: the item stays visible, but it can never request the wrong
    // key or sign as another account.
    meta.status = QUEUE_STATUS.FAILED
    meta.error = authorityError
    meta.updatedAt = Date.now()
  }
  this.queue.push(normalized)
  ensureQueueMeta(this).push(meta)
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
  return normalized
}

export function removeFromQueue (itemToRemove) {
  const index = this.queue.indexOf(itemToRemove)
  if (index === -1) return
  this.queue.splice(index, 1)
  ensureQueueMeta(this).splice(index, 1)
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
}

export function removeQueueItemAt (index) {
  if (index < 0 || index >= this.queue.length) return
  this.queue.splice(index, 1)
  ensureQueueMeta(this).splice(index, 1)
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
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
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
}

export function setQueueTxId (index, txId) {
  if (index < 0 || index >= this.queue.length) return
  const meta = ensureQueueMeta(this)
  const current = normalizeQueueMeta(this.queue, meta)[index]
  meta[index] = { ...current, txId: txId || '', updatedAt: Date.now() }
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
}

export function resetFailedQueueStatuses () {
  const meta = ensureQueueMeta(this)
  const normalized = normalizeQueueMeta(this.queue, meta)
  normalized.forEach((entry, index) => {
    const action = this.queue[index]
    const active = Array.isArray(action) && action[1] === 'active'
    // Retrying an active-key action can double-spend if the first broadcast was
    // accepted but the response was lost. Leave active failures for an explicit
    // per-item retry; send-all only resumes posting actions.
    if (entry.status === QUEUE_STATUS.FAILED && !active) {
      entry.status = QUEUE_STATUS.PENDING
      entry.error = ''
      entry.updatedAt = Date.now()
    }
  })
  meta.splice(0, meta.length, ...normalized)
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
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
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
}

export function clearQueue () {
  this.queue = []
  this.queueMeta = []
  persistQueue(this.queue, this.queueMeta, this.user?.username || '')
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
