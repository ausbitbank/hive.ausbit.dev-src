import { LocalStorage, SessionStorage } from 'quasar'
import { persistQueue } from './state'

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
  this.queue.push(newItem)
  persistQueue(this.queue)
}

export function removeFromQueue (itemToRemove) {
  this.queue = this.queue.filter(a => a !== itemToRemove)
  persistQueue(this.queue)
}

export function clearQueue () {
  this.queue = []
  persistQueue(this.queue)
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
